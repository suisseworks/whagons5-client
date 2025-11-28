import { DB } from "@/store/indexedDB/DB";
import { api as apiClient } from '../api/whagonsApi';

let worker: Worker | null = null;
let workerListenerAttached = false;
let nextRid = 1;
const pending: Map<number, { resolve: (v: any) => void; reject: (e: any) => void; timeout: any } > = new Map();
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));





function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./crypto-worker.ts', import.meta.url), { type: 'module' });
  }
  if (!workerListenerAttached) {
    const onMsg = (ev: MessageEvent) => {
      const rid = ev.data?.rid;
      if (typeof rid === 'number' && pending.has(rid)) {
        const entry = pending.get(rid)!;
        pending.delete(rid);
        try { clearTimeout(entry.timeout); } catch {}
        entry.resolve(ev.data);
        return;
      }
      // Fallback: legacy listeners will handle
    };
    worker.addEventListener('message', onMsg);
    workerListenerAttached = true;
  }
  return worker;
}

export interface WrappedKEKEnvelope {
  alg: string; // e.g., 'P256+AESGCM'
  eph_pub: string; // base64-encoded ephemeral public key from server
  iv: string; // base64-encoded IV
  ct: string; // base64-encoded ciphertext (wrapped KEK)
  salt: string; // base64-encoded salt for HKDF
}


export class CryptoHandler {
  static inited = false;
  static kid: string | null = null;
  static expIso: string | null = null;
  static initPromise: Promise<void> | null = null;

  public static reset(): void {
    CryptoHandler.inited = false;
    CryptoHandler.kid = null;
    CryptoHandler.expIso = null;
  }

  public static async init(){
    // If already initialized, return immediately
    if (CryptoHandler.inited) {
      const kekPresent = await hasKEK().catch(() => false);
      if (kekPresent) return;
      console.warn('[CryptoHandler] Worker KEK missing despite init flag; resetting state');
      CryptoHandler.reset();
    }

    // If initialization is in progress, wait for it to complete
    if (CryptoHandler.initPromise) {
      return CryptoHandler.initPromise;
    }

    // Start initialization and store the promise to prevent concurrent executions
    CryptoHandler.initPromise = (async () => {
      try {
        const metaR = DB.getStoreRead('crypto_meta' as any);
        const get = metaR.get('device');
        const prev = await new Promise<any>((resolve) => { get.onsuccess = () => resolve(get.result || {}); get.onerror = () => resolve({}); });

        // Ensure stable deviceId persisted in crypto_meta
        let deviceId: string = prev?.deviceId || ((crypto as any).randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
        if (!prev?.deviceId) {
          const metaW0 = DB.getStoreWrite('crypto_meta' as any);
          metaW0.put({ key: 'device', ...prev, deviceId });
        }

        const dkPub = await getDevicePublicKey();

        // Upsert device and receive KEK payload in same response
        const reg = await apiClient.post('/devices', { dk_pub: dkPub, curve: 'p256', device_id: deviceId });
        const dkid = reg.data?.data?.dkid;
        // Always fetch wrapped KEK via endpoint (ignore rawKEK)
        const kekResp = await apiClient.post(`/devices/${dkid}/kek`);
        const envelope = kekResp.data?.data?.wrappedKEK;
        const kid = kekResp.data?.data?.kid;
        const expIso = kekResp.data?.data?.expiresAt;

        await provisionWrappedKEK(envelope);
        await CryptoHandler.waitForWorkerKek('provision');

        // Persist identifiers and KEK metadata
        const metaW = DB.getStoreWrite('crypto_meta' as any);
        metaW.put({ key: 'device', ...prev, dkid, deviceId, kid, expiresAt: expIso ? new Date(expIso).getTime() : undefined });

        // Set the static properties
        CryptoHandler.kid = kid;
        CryptoHandler.expIso = expIso;

        // Mark as initialized
        CryptoHandler.inited = true;

      } catch (error) {
        // Reset the promise on error so future calls can retry
        CryptoHandler.initPromise = null;
        console.error('[CryptoHandler] Initialization failed:', error);
        throw error;
      } finally {
        // Clear the promise reference when done (success or failure)
        CryptoHandler.initPromise = null;
      }
    })();

    return CryptoHandler.initPromise;
  }

  private static async waitForWorkerKek(label: string, timeoutMs = 20000): Promise<void> {
    const start = performance.now();
    let attempt = 0;
    while (performance.now() - start < timeoutMs) {
      attempt += 1;
      const has = await hasKEK().catch(() => false);
      if (has) {
        if (attempt > 1) {
          console.info(`[CryptoHandler] ${label} KEK ready after ${attempt} checks (${Math.round(performance.now() - start)}ms)`);
        }
        return;
      }
      const elapsed = Math.round(performance.now() - start);
      if (attempt === 1 || attempt % 4 === 0) {
        console.debug(`[CryptoHandler] waiting for worker KEK (attempt ${attempt}, elapsed ${elapsed}ms, ${label})`);
      }
      await sleep(Math.min(600, 150 + attempt * 75));
    }
    throw new Error(`[CryptoHandler] KEK not ready after ${Math.round(performance.now() - start)}ms (${label})`);
  }
}
function sendRequest<T = any>(op: string, payload: Record<string, any>, timeoutMs: number = 15000): Promise<T> {
  const w = getWorker();
  const rid = nextRid++;
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (pending.has(rid)) {
        pending.delete(rid);
        reject(new Error(`${op} timeout`));
      }
    }, timeoutMs);
    pending.set(rid, { resolve: resolve as any, reject, timeout });
    w.postMessage({ t: op, rid, ...payload });
  });
}



export function getDevicePublicKey(): Promise<string> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const onMsg = (ev: MessageEvent) => {
      w.removeEventListener('message', onMsg);
      if (ev.data?.ok && ev.data?.dk_pub) {
        resolve(ev.data.dk_pub);
      } else {
        console.warn('[crypto] GET_DEVICE_PUB error', ev.data?.error);
        reject(new Error(ev.data?.error || 'get device pub error'));
      }
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ t: 'GET_DEVICE_PUB' });
  });
}

export function importDeviceKeys(privJwk: JsonWebKey, pubRawB64: string): Promise<boolean> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const onMsg = (ev: MessageEvent) => {
      w.removeEventListener('message', onMsg);
      if (ev.data?.ok) resolve(true); else reject(new Error(ev.data?.error || 'import device keys error'));
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ t: 'IMPORT_DEVICE_KEYS', privJwk, pubRawB64 });
  });
}

export function exportDeviceKeys(): Promise<{ privJwk: JsonWebKey, pubRawB64: string }> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const onMsg = (ev: MessageEvent) => {
      w.removeEventListener('message', onMsg);
      if (ev.data?.ok) resolve({ privJwk: ev.data.privJwk, pubRawB64: ev.data.pubRawB64 }); else reject(new Error(ev.data?.error || 'export device keys error'));
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ t: 'EXPORT_DEVICE_KEYS' });
  });
}

export function provisionKEK(rawKEKBase64: string): Promise<boolean> {
  const w = getWorker();
  return new Promise((resolve) => {
    const onMsg = (ev: MessageEvent) => { w.removeEventListener('message', onMsg); resolve(!!ev.data?.ok); };
    w.addEventListener('message', onMsg);
    w.postMessage({ t: 'PROVISION_KEK', rawKEK: rawKEKBase64 });
  });
}

export function provisionWrappedKEK(wrappedKEK: WrappedKEKEnvelope): Promise<boolean> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const onMsg = (ev: MessageEvent) => {
      w.removeEventListener('message', onMsg);
      if (ev.data?.ok) {
        resolve(true);
      } else {
        console.warn('[crypto] PROVISION_KEK (wrapped) error', ev.data?.error);
        reject(new Error(ev.data?.error || 'provision wrapped kek error'));
      }
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ t: 'PROVISION_KEK', wrappedKEK });
  });
}

export function encryptRow(store: string, id: any, row: any, overrides?: { tenant?: string | number, user?: string | number, version?: number | string }): Promise<any> {
  return sendRequest('ENCRYPT', { store, id, row, overrides }).then((resp: any) => {
    if (resp?.ok && resp?.env) return resp.env;
    if (resp?.ok && !resp?.env) throw new Error('encrypt ok but missing env');
    throw new Error(resp?.error || 'encrypt error');
  });
}

export function decryptRow(store: string, env: any): Promise<any> {
  return sendRequest('DECRYPT', { store, env }).then((resp: any) => {
    if (resp?.ok) return resp.row;
    throw new Error(resp?.error || 'decrypt error');
  });
}

export function ensureCEK(store: string, wrappedCEK?: { iv: string, ct: string } | null): Promise<{ ok: boolean; error?: string; detail?: any; wrappedCEK?: { iv: string, ct: string } | null }> {
  return sendRequest('ENSURE_CEK', { store, wrappedCEK });
}

export function zeroizeKeys(): Promise<boolean> {
  const w = getWorker();
  return new Promise<boolean>((resolve) => {
    const onMsg = (ev: MessageEvent) => { w.removeEventListener('message', onMsg); resolve(!!ev.data?.ok); };
    w.addEventListener('message', onMsg);
    w.postMessage({ t: 'ZEROIZE' });
  }).then((ok) => {
    CryptoHandler.reset();
    return ok;
  });
}

export function hasKEK(): Promise<boolean> {
  const w = getWorker();
  return new Promise((resolve) => {
    const onMsg = (ev: MessageEvent) => { w.removeEventListener('message', onMsg); resolve(!!ev.data?.has); };
    w.addEventListener('message', onMsg);
    w.postMessage({ t: 'HAS_KEK' });
  });
}

export function rewrapCekBlobWithWrappedKEK(wrappedCEK: { iv: string, ct: string }, newWrappedKEK: WrappedKEKEnvelope): Promise<{ iv: string, ct: string }> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const onMsg = (ev: MessageEvent) => {
      w.removeEventListener('message', onMsg);
      if (ev.data?.ok && ev.data?.wrappedCEK) resolve(ev.data.wrappedCEK); else reject(new Error(ev.data?.error || 'rewrap cek error'));
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ t: 'REWRAP_CEK_BLOB', wrappedCEK, newWrappedKEK });
  });
}

export function rewrapCekBlobWithRawKEK(wrappedCEK: { iv: string, ct: string }, newRawKEKBase64: string): Promise<{ iv: string, ct: string }> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const onMsg = (ev: MessageEvent) => {
      w.removeEventListener('message', onMsg);
      if (ev.data?.ok && ev.data?.wrappedCEK) resolve(ev.data.wrappedCEK); else reject(new Error(ev.data?.error || 'rewrap cek error'));
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ t: 'REWRAP_CEK_BLOB_RAW', wrappedCEK, newRawKEK: newRawKEKBase64 });
  });
}


