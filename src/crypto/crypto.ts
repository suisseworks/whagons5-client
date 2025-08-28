import { DB } from "@/store/indexedDB/DB";
import { api as apiClient } from '../api/whagonsApi';

let worker: Worker | null = null;





function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./crypto-worker.ts', import.meta.url), { type: 'module' });
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

  public static async init(){
    // If already initialized, return immediately
    if (CryptoHandler.inited) return;

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

export function encryptRow(store: string, id: any, row: any): Promise<any> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const onMsg = (ev: MessageEvent) => {
      w.removeEventListener('message', onMsg);
      if (ev.data?.ok) {
        resolve(ev.data.env);
      } else {
        console.warn('[crypto] ENCRYPT error', store, ev.data?.error);
        reject(new Error(ev.data?.error || 'encrypt error'));
      }
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ t: 'ENCRYPT', store, id, row });
  });
}

export function decryptRow(store: string, env: any): Promise<any> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const onMsg = (ev: MessageEvent) => {
      w.removeEventListener('message', onMsg);
      if (ev.data?.ok) {
        resolve(ev.data.row);
      } else {
        console.warn('[crypto] DECRYPT error', store, ev.data?.error);
        reject(new Error(ev.data?.error || 'decrypt error'));
      }
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ t: 'DECRYPT', store, env });
  });
}

export function ensureCEK(store: string, wrappedCEK?: { iv: string, ct: string } | null): Promise<{ ok: boolean; error?: string; detail?: any; wrappedCEK?: { iv: string, ct: string } | null }> {
  const w = getWorker();
  return new Promise((resolve) => {
    const onMsg = (ev: MessageEvent) => {
      w.removeEventListener('message', onMsg);
      resolve(ev.data);
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ t: 'ENSURE_CEK', store, wrappedCEK });
  });
}

export function zeroizeKeys(): Promise<boolean> {
  const w = getWorker();
  return new Promise((resolve) => {
    const onMsg = (ev: MessageEvent) => { w.removeEventListener('message', onMsg); resolve(!!ev.data?.ok); };
    w.addEventListener('message', onMsg);
    w.postMessage({ t: 'ZEROIZE' });
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


