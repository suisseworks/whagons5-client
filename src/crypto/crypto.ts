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

export function getDevicePublicKey(): Promise<string> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const onMsg = (ev: MessageEvent) => {
      w.removeEventListener('message', onMsg);
      if (ev.data?.ok && ev.data?.dk_pub) {
        console.debug('[crypto] GET_DEVICE_PUB ok');
        resolve(ev.data.dk_pub);
      } else {
        console.warn('[crypto] GET_DEVICE_PUB error', ev.data?.error);
        reject(new Error(ev.data?.error || 'get device pub error'));
      }
    };
    w.addEventListener('message', onMsg);
    console.debug('[crypto] -> GET_DEVICE_PUB');
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
    console.debug('[crypto] -> PROVISION_KEK (raw)');
    w.postMessage({ t: 'PROVISION_KEK', rawKEK: rawKEKBase64 });
  });
}

export function provisionWrappedKEK(wrappedKEK: WrappedKEKEnvelope): Promise<boolean> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const onMsg = (ev: MessageEvent) => {
      w.removeEventListener('message', onMsg);
      if (ev.data?.ok) {
        console.debug('[crypto] PROVISION_KEK (wrapped) ok');
        resolve(true);
      } else {
        console.warn('[crypto] PROVISION_KEK (wrapped) error', ev.data?.error);
        reject(new Error(ev.data?.error || 'provision wrapped kek error'));
      }
    };
    w.addEventListener('message', onMsg);
    console.debug('[crypto] -> PROVISION_KEK (wrapped)');
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
    console.debug('[crypto] -> ENCRYPT', store, id);
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
    console.debug('[crypto] -> DECRYPT', store, { hasAad: !!env?.enc?.aad });
    w.postMessage({ t: 'DECRYPT', store, env });
  });
}

export function ensureCEK(store: string, wrappedCEK?: { iv: string, ct: string } | null): Promise<{ wrappedCEK?: { iv: string, ct: string } | null }> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const onMsg = (ev: MessageEvent) => {
      w.removeEventListener('message', onMsg);
      if (ev.data?.ok) {
        console.debug('[crypto] ENSURE_CEK ok', store, { generated: !!ev.data?.wrappedCEK });
        resolve({ wrappedCEK: ev.data?.wrappedCEK ?? null });
      } else {
        console.warn('[crypto] ENSURE_CEK error', store, ev.data?.error, ev.data?.detail || null);
        reject(new Error(ev.data?.error || 'ensure cek error'));
      }
    };
    w.addEventListener('message', onMsg);
    console.debug('[crypto] -> ENSURE_CEK', store, { hasWrapped: !!wrappedCEK });
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
    console.debug('[crypto] -> HAS_KEK');
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


