/// <reference lib="webworker" />

type Envelope = { id: any, enc: { alg: string, iv: string, ct: string, tag?: string, aad?: { table: string, id: string | number, version?: number | string, tenant?: string | number, user?: string | number } }, meta?: any };

const storeToCEK: Map<string, CryptoKey> = new Map();
let kekKey: CryptoKey | null = null;
let deviceKeyPair: CryptoKeyPair | null = null;
let deviceKeysLoaded = false; // track whether we've loaded/persisted device keys

self.addEventListener('message', async (ev: MessageEvent) => {
  const msg = ev.data;
  try {
    // Debug: echo incoming message briefly (type only to avoid logging data)
    // @ts-ignore
    switch (msg.t) {
      case 'HAS_KEK': {
        // Report if KEK is currently provisioned in this worker
        // @ts-ignore
        console.log("[crypto-worker] hasKek?", kekKey!== null);
        postMessage({ ok: true, has: !!kekKey });
        break;
      }
      case 'GET_DEVICE_PUB': {
        await ensureDeviceKeysLoaded();
        const pubRaw = await crypto.subtle.exportKey('raw', deviceKeyPair!.publicKey);
        postMessage({ ok: true, dk_pub: bytesToBase64(new Uint8Array(pubRaw)) });
        break;
      }
      case 'IMPORT_DEVICE_KEYS': {
        try {
          const priv = await crypto.subtle.importKey('jwk', msg.privJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
          const pub = await crypto.subtle.importKey('raw', base64ToBytes(msg.pubRawB64), { name: 'ECDH', namedCurve: 'P-256' }, true, []);
          deviceKeyPair = { privateKey: priv, publicKey: pub } as CryptoKeyPair;
          await persistCurrentDeviceKeys();
          deviceKeysLoaded = true;
          postMessage({ ok: true });
        } catch (err: any) {
          postMessage({ ok: false, error: String(err?.message || err) });
        }
        break;
      }
      case 'EXPORT_DEVICE_KEYS': {
        try {
          await ensureDeviceKeysLoaded();
          const privJwk = await crypto.subtle.exportKey('jwk', deviceKeyPair!.privateKey);
          const pubRaw = await crypto.subtle.exportKey('raw', deviceKeyPair!.publicKey);
          const pubRawB64 = bytesToBase64(new Uint8Array(pubRaw));
          await idbPutDeviceRecord({ key: 'device', privJwk, pubRawB64, curve: 'p256' });
          postMessage({ ok: true, privJwk, pubRawB64 });
        } catch (err: any) {
          postMessage({ ok: false, error: String(err?.message || err) });
        }
        break;
      }
      case 'PROVISION_KEK': {
        try {
      
        } catch {}
        // Accept dev rawKEK bypass
        if (msg.rawKEK) {
          // KEK must support encrypt/decrypt because we wrap CEKs using AES-GCM encrypt
          kekKey = await crypto.subtle.importKey('raw', base64ToBytes(msg.rawKEK), { name: 'AES-GCM' }, false, ['wrapKey','unwrapKey','encrypt','decrypt']);
       
          postMessage({ ok: true });
          break;
        }
        // P-256 unwrap path: msg.wrappedKEK = { alg: 'P256+AESGCM', eph_pub, iv, ct, salt }
        try {
          await ensureDeviceKeysLoaded();
          const w = msg.wrappedKEK;
        
          const serverPub = await crypto.subtle.importKey('raw', base64ToBytes(w.eph_pub), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
          const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: serverPub }, deviceKeyPair!.privateKey, 256);
          try {
            const sharedBytes = new Uint8Array(shared);
            const pfx = Array.from(sharedBytes.slice(0, 8)).map(x => x.toString(16).padStart(2, '0')).join('');
       
          } catch {}
          // HKDF to AES-GCM key
          const hkdfKey = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
          const aesKey = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: base64ToBytes(w.salt), info: new Uint8Array() }, hkdfKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
          const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(w.iv) }, aesKey, base64ToBytes(w.ct));
          // Same here: allow AES-GCM encrypt/decrypt for CEK (re)wrapping operations
          kekKey = await crypto.subtle.importKey('raw', pt, { name: 'AES-GCM' }, false, ['wrapKey','unwrapKey','encrypt','decrypt']);

          postMessage({ ok: true });
        } catch (err: any) {
          // @ts-ignore
          console.warn('[crypto-worker] PROVISION_KEK error', String(err?.message || err));
          postMessage({ ok: false, error: String(err?.message || err) });
        }
        break;
      }
      case 'REWRAP_CEK_BLOB': {
        // Input: { wrappedCEK: { iv, ct }, newWrappedKEK: { alg, eph_pub, iv, ct, salt } }
        try {
          if (!kekKey) throw new Error('KEK not provisioned');
          const w = msg.newWrappedKEK;
          const serverPub = await crypto.subtle.importKey('raw', base64ToBytes(w.eph_pub), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
          if (!deviceKeyPair) throw new Error('device key not ready');
          const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: serverPub }, deviceKeyPair.privateKey, 256);
          const hkdfKey = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
          // Derive AES key used to decrypt the wrapped KEK payload (same as PROVISION_KEK)
          const unwrapKey = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: base64ToBytes(w.salt), info: new Uint8Array() }, hkdfKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
          // Decrypt new raw KEK bytes
          const newRawKek = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(w.iv) }, unwrapKey, base64ToBytes(w.ct));
          const newKek = await crypto.subtle.importKey('raw', newRawKek, { name: 'AES-GCM' }, false, ['encrypt']);

          // Decrypt CEK with current kekKey
          const oldIv = base64ToBytes(msg.wrappedCEK.iv);
          const oldCt = base64ToBytes(msg.wrappedCEK.ct);
          const cekRaw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: oldIv }, kekKey, oldCt);
          // Encrypt CEK with new kek
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, newKek, cekRaw);
          postMessage({ ok: true, wrappedCEK: { iv: bytesToBase64(iv), ct: bytesToBase64(new Uint8Array(ct)) } });
        } catch (err: any) {
          postMessage({ ok: false, error: String(err?.message || err) });
        }
        break;
      }
      case 'REWRAP_CEK_BLOB_RAW': {
        // Input: { wrappedCEK: { iv, ct }, newRawKEK: string(base64) }
        try {
          if (!kekKey) throw new Error('KEK not provisioned');
          const newKek = await crypto.subtle.importKey('raw', base64ToBytes(msg.newRawKEK), { name: 'AES-GCM' }, false, ['encrypt']);
          const oldIv = base64ToBytes(msg.wrappedCEK.iv);
          const oldCt = base64ToBytes(msg.wrappedCEK.ct);
          const cekRaw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: oldIv }, kekKey, oldCt);
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, newKek, cekRaw);
          postMessage({ ok: true, wrappedCEK: { iv: bytesToBase64(iv), ct: bytesToBase64(new Uint8Array(ct)) } });
        } catch (err: any) {
          postMessage({ ok: false, error: String(err?.message || err) });
        }
        break;
      }
      case 'UNWRAP_CEK': {
        // Not implemented in demo; CEKs are generated locally per store
        postMessage({ ok: true });
        break;
      }
      case 'ENSURE_CEK': {
        const store: string = msg.store;
        if (storeToCEK.has(store)) { postMessage({ ok: true }); break; }
        // @ts-ignore
        if (msg.wrappedCEK) {
          // If a wrapped CEK exists but KEK is not yet provisioned, do NOT generate
          // a new random CEK, as that would make existing ciphertext undecryptable.
          if (!kekKey) { postMessage({ ok: false, error: 'KEK not provisioned', detail: { store, reason: 'missing_kek' } }); break; }
          // Unwrap CEK
          try {
            const iv = base64ToBytes(msg.wrappedCEK.iv);
            const ct = base64ToBytes(msg.wrappedCEK.ct);
            const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, kekKey, ct);
            const cek = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt','decrypt']);
            storeToCEK.set(store, cek);
            // @ts-ignore
            postMessage({ ok: true });
          } catch (unwrapErr: any) {
            const det = { store, ivLen: (msg.wrappedCEK?.iv || '').length, ctLen: (msg.wrappedCEK?.ct || '').length };
            // @ts-ignore
            console.warn('[crypto-worker] ENSURE_CEK unwrap error', det, String(unwrapErr?.message || unwrapErr));
            postMessage({ ok: false, error: 'CEK unwrap failed', detail: det });
          }
        } else {
          // Generate CEK and return wrappedCEK for persistence
          const cek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt','decrypt']);
          storeToCEK.set(store, cek);
          if (!kekKey) { postMessage({ ok: true, wrappedCEK: null }); break; }
          const raw = await crypto.subtle.exportKey('raw', cek);
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kekKey, raw);
          postMessage({ ok: true, wrappedCEK: { iv: bytesToBase64(iv), ct: bytesToBase64(new Uint8Array(ct)) } });
        }
        break;
      }
      case 'ENCRYPT': {
        try {
          // @ts-ignore

          const cek = await getOrCreateCEK(msg.store);
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const pt = new TextEncoder().encode(JSON.stringify(msg.row));
          const aadObjBase = buildAad(msg.store, msg.id, msg.row);
          const aadObj = { ...aadObjBase, ...(msg.overrides || {}) };
          const aad = encodeAad(aadObj);
          const ctag = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, cek, pt);
          const ctagBytes = new Uint8Array(ctag);
          const tagLen = 16;
          const ctBytes = ctagBytes.slice(0, ctagBytes.length - tagLen);
          const tagBytes = ctagBytes.slice(ctagBytes.length - tagLen);
          const env: Envelope = { id: msg.id, enc: { alg: 'A256GCM', iv: bytesToBase64(iv), ct: bytesToBase64(ctBytes), tag: bytesToBase64(tagBytes), aad: aadObj }, meta: { updatedAt: Date.now() } };
          // @ts-ignore
          postMessage({ ok: true, env });
        } catch (err: any) {
          // @ts-ignore
          console.warn('[crypto-worker] ENCRYPT error', err?.name || err);
          // Auto-heal: if CEK got into a bad state, regenerate once and retry
          if (String(err?.name || err).includes('OperationError')) {
            try {
              storeToCEK.delete(msg.store);
              const cek = await getOrCreateCEK(msg.store);
              const iv = crypto.getRandomValues(new Uint8Array(12));
              const pt = new TextEncoder().encode(JSON.stringify(msg.row));
              // First retry with AAD, then without AAD as compatibility fallback
              try {
                const aadObjBase = buildAad(msg.store, msg.id, msg.row);
                const aadObj = { ...aadObjBase, ...(msg.overrides || {}) };
                const aad = encodeAad(aadObj);
                const ctag = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, cek, pt);
                const cb = new Uint8Array(ctag);
                const tagLen = 16;
                const ctBytes = cb.slice(0, cb.length - tagLen);
                const tagBytes = cb.slice(cb.length - tagLen);
                const env: Envelope = { id: msg.id, enc: { alg: 'A256GCM', iv: bytesToBase64(iv), ct: bytesToBase64(ctBytes), tag: bytesToBase64(tagBytes), aad: aadObj }, meta: { updatedAt: Date.now() } };
                // @ts-ignore
                postMessage({ ok: true, env });
              } catch (_retryWithAad) {
                const ctag2 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cek, pt);
                const cb2 = new Uint8Array(ctag2);
                const tagLen2 = 16;
                const ctBytes2 = cb2.slice(0, cb2.length - tagLen2);
                const tagBytes2 = cb2.slice(cb2.length - tagLen2);
                const env2: Envelope = { id: msg.id, enc: { alg: 'A256GCM', iv: bytesToBase64(iv), ct: bytesToBase64(ctBytes2), tag: bytesToBase64(tagBytes2) }, meta: { updatedAt: Date.now() } };
                // @ts-ignore
                postMessage({ ok: true, env: env2 });
              }
            } catch (e2: any) {
              postMessage({ ok: false, error: String(e2?.message || e2) });
            }
          } else {
            postMessage({ ok: false, error: String(err?.message || err) });
          }
        }
        break;
      }
      case 'DECRYPT': {
        try {
          // Prefer existing CEK if present; do not generate a new CEK on decrypt path
          let cek = getExistingCEK(msg.store);
          if (!cek) {
            // If no CEK has been ensured for this store yet, we cannot decrypt; surface error
            throw new Error('CEK not ready');
          }
          const iv = base64ToBytes(msg.env.enc.iv);
          const ct = base64ToBytes(msg.env.enc.ct);
          const tag = msg.env.enc.tag ? base64ToBytes(msg.env.enc.tag) : new Uint8Array();
          const aadObj = msg.env.enc.aad || buildAad(msg.store, msg.env.id ?? msg.env?.id, null);
          const aad = msg.env.enc.aad ? encodeAad(aadObj) : undefined as any;
          const ctag = concatBytes(ct, tag);
          let pt: ArrayBuffer;
          try {
            pt = await crypto.subtle.decrypt(aad ? { name: 'AES-GCM', iv, additionalData: aad } : { name: 'AES-GCM', iv }, cek, ctag);
          } catch (inner) {
            // Provide rich error context back to main thread
            const ctx = { store: msg.store, hasAAD: !!aad, ivLen: iv.length, ctLen: ct.length, tagLen: tag.length };
            // @ts-ignore
            console.warn('[crypto-worker] DECRYPT ctx', ctx);
            throw inner;
          }
          const text = new TextDecoder().decode(pt);
          postMessage({ ok: true, row: JSON.parse(text) });
        } catch (err: any) {
          // @ts-ignore
          console.warn('[crypto-worker] DECRYPT error', err?.name || err);
          if (String(err?.name || err).includes('OperationError')) {
            try {
              // Do not generate a new CEK here; decrypt must rely on the correct CEK
              const cek = getExistingCEK(msg.store);
              if (!cek) throw new Error('CEK not ready');
              const iv = base64ToBytes(msg.env.enc.iv);
              const ct = base64ToBytes(msg.env.enc.ct);
              const tag = msg.env.enc.tag ? base64ToBytes(msg.env.enc.tag) : new Uint8Array();
              const aadObj = msg.env.enc.aad || buildAad(msg.store, msg.env.id ?? msg.env?.id, null);
              const aad = msg.env.enc.aad ? encodeAad(aadObj) : undefined as any;
              const ctag = concatBytes(ct, tag);
              const pt = await crypto.subtle.decrypt(aad ? { name: 'AES-GCM', iv, additionalData: aad } : { name: 'AES-GCM', iv }, cek, ctag);
              const text = new TextDecoder().decode(pt);
              postMessage({ ok: true, row: JSON.parse(text) });
            } catch (e2: any) {
              postMessage({ ok: false, error: String(e2?.message || e2) });
            }
          } else {
            postMessage({ ok: false, error: String(err?.message || err) });
          }
        }
        break;
      }
      case 'ZEROIZE': {
        try {
          kekKey = null;
          storeToCEK.clear();
          // keep deviceKeyPair (registration) unless caller resets it
          postMessage({ ok: true });
        } catch (err: any) {
          postMessage({ ok: false, error: String(err?.message || err) });
        }
        break;
      }
      default:
        postMessage({ ok: false, error: 'unknown message' });
    }
  } catch (e: any) {
    postMessage({ ok: false, error: String(e?.message || e) });
  }
});

async function getOrCreateCEK(store: string): Promise<CryptoKey> {
  const hit = storeToCEK.get(store);
  if (hit) return hit;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt','decrypt']);
  storeToCEK.set(store, key);
  return key;
}

function getExistingCEK(store: string): CryptoKey | null {
  return storeToCEK.get(store) ?? null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function encodeAad(obj: any): Uint8Array {
  const json = JSON.stringify(obj);
  return new TextEncoder().encode(json);
}

function buildAad(table: string, id: any, row: any | null): { table: string, id: string | number, version?: number | string, tenant?: string | number, user?: string | number } {
  const version = row?.version ?? (row?.updated_at ? new Date(row.updated_at).getTime() : undefined);
  const tenant = row?.workspace_id ?? row?.tenant ?? undefined;
  const user = row?.user_id ?? row?.updated_by ?? undefined;
  return { table, id, version, tenant, user };
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0); out.set(b, a.length);
  return out;
}

// --- Worker-local IndexedDB to persist device ECDH keypair ---
function openDeviceDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('wh-crypto', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('device')) {
        db.createObjectStore('device', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetDeviceRecord(): Promise<any | null> {
  const db = await openDeviceDB();
  return new Promise((resolve) => {
    const tx = db.transaction('device', 'readonly');
    const st = tx.objectStore('device');
    const rq = st.get('device');
    rq.onsuccess = () => resolve(rq.result || null);
    rq.onerror = () => resolve(null);
  });
}

async function idbPutDeviceRecord(rec: any): Promise<void> {
  const db = await openDeviceDB();
  await new Promise<void>((resolve) => {
    const tx = db.transaction('device', 'readwrite');
    const st = tx.objectStore('device');
    st.put({ key: 'device', ...rec });
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function ensureDeviceKeysLoaded(): Promise<void> {
  if (deviceKeysLoaded && deviceKeyPair) return;
  const rec = await idbGetDeviceRecord();
  if (rec?.privJwk && rec?.pubRawB64) {
    try {
      const priv = await crypto.subtle.importKey('jwk', rec.privJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
      const pub = await crypto.subtle.importKey('raw', base64ToBytes(rec.pubRawB64), { name: 'ECDH', namedCurve: 'P-256' }, true, []);
      deviceKeyPair = { privateKey: priv, publicKey: pub } as CryptoKeyPair;
      deviceKeysLoaded = true;
      return;
    } catch {}
  }
  // Generate new and persist for next loads
  deviceKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  await persistCurrentDeviceKeys();
  deviceKeysLoaded = true;
}

async function persistCurrentDeviceKeys(): Promise<void> {
  if (!deviceKeyPair) return;
  const privJwk = await crypto.subtle.exportKey('jwk', deviceKeyPair.privateKey);
  const pubRaw = await crypto.subtle.exportKey('raw', deviceKeyPair.publicKey);
  const pubRawB64 = bytesToBase64(new Uint8Array(pubRaw));
  await idbPutDeviceRecord({ privJwk, pubRawB64, curve: 'p256' });
}


