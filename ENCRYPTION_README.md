## WHagons Client-Side Cache Encryption (Quick README)

### Overview
- **CEK per store (AES-256-GCM)**: Encrypts rows in IndexedDB.
- **KEK per device**: Wraps CEKs (AES-256-GCM). Lives only in the WebWorker (memory).
- **Provisioning**: Server wraps KEK using ECDH(P-256)+HKDF(SHA-256)+AES-GCM; worker unwraps it.

### Data model
- **Encrypted rows (per app table)**: Envelope with `{ enc: { alg:'A256GCM', iv, ct, tag, aad? }, meta }`.
- **`cache_keys`**: One record per store `{ store, wrappedCEK:{iv,ct}, kid, createdAt }`.
- **`crypto_meta`**: `{ key:'device', dkid, deviceId, kid, expiresAt, deviceKeys:{ privJwk, pubRawB64 } }`.

### Row envelope
- AES-GCM
  - IV: 12 bytes (base64 ~16 chars)
  - Tag: 16 bytes (stored separately as `tag`)
  - Optional AAD: `{ table, id, version, tenant?, user? }`
- Stored fields: `iv`, `ct` (ciphertext without tag), `tag`, optional `aad`.

### CEK lifecycle (per store)
- Ensure CEK
  - If `cache_keys.store.wrappedCEK` exists: worker unwraps with KEK via AES-GCM decrypt using `iv` and `ct` (which includes tag in bytes).
  - Else: generate CEK, wrap with KEK, persist `{ store, wrappedCEK, kid }` to `cache_keys`.
- Use CEK
  - Encrypt/Decrypt rows with per-row IV and optional AAD.

### KEK provisioning (each reload)
1) Device keys
   - ECDH P-256 keypair persisted in `crypto_meta.device.deviceKeys` (private JWK + raw pub).
   - On boot: import existing or generate+persist.
2) Device upsert
   - `POST /devices` with `{ dk_pub (raw b64), curve:'p256', device_id }` → `dkid`.
3) KEK fetch
   - `POST /devices/{dkid}/kek` → `wrappedKEK` envelope:
     - `{ alg:'P256+AESGCM', eph_pub, iv, ct, salt }`
     - Dev mode may also return `rawKEK` (base64 bypass).
4) Worker unwrap
   - Import `eph_pub` (raw P-256), `deriveBits(256)` with device private key.
   - HKDF: SHA-256, salt=server `salt` (16 bytes), info empty, len=32.
   - AES-GCM decrypt with server `iv`/`ct` (ct includes tag) → raw KEK.
   - Import raw KEK as AES-GCM key for wrap/unwrap/encrypt/decrypt.

### Rotation
- When server returns new `kid`:
  1) Provision OLD KEK first (call `/kek` with `{ preferKid: prevKid }`).
  2) Rewrap all CEKs in `cache_keys` to the NEW KEK (unwrap new KEK if wrapped-only).
  3) Switch worker to the NEW KEK and persist `kid` in `crypto_meta`.

### Critical ordering (Auth bootstrap)
1) `importDeviceKeys()` (or generate and persist).
2) `getDevicePublicKey()` → log prefix.
3) `POST /devices` (upsert) with current pub.
4) `POST /devices/{dkid}/kek` (no `preferKid` unless rewrapping).
5) Provision KEK in worker.
6) For each core store: ensure CEK (unwrap or generate+wrap).

### Key sizes and encodings
- P-256 raw public key: 65 bytes (uncompressed), base64 standard (`+`/`/`).
- HKDF salt: 16 bytes; AES-GCM IV: 12 bytes; Tag: 16 bytes.
- Wrapped KEK `ct` includes the tag (appended during server encrypt; worker treats it as contiguous bytes).

### File locations
- Client
  - `src/providers/AuthProvider.tsx`: boot sequence; device upsert; KEK fetch; CEK ensure.
  - `src/crypto/crypto.ts`: messaging API to web worker.
  - `src/crypto/crypto-worker.ts`: device keys; KEK unwrap; CEK ensure; row enc/dec; rewrap.
  - `src/store/indexedDB/DB.ts`: IDB init; ensureCEKForStore; adapters for row enc/dec.
- Server
  - `app/Http/Controllers/Api/Security/DeviceController.php`: device upsert.
  - `app/Http/Controllers/Api/Security/KEKController.php`: KEK issue/rotate; idempotency; debug fields.
  - `app/Services/Security/CryptoService.php`: wrapForDevice (ECDH → HKDF → AES-GCM).

### Troubleshooting
- PROVISION_KEK OperationError
  - Ensure `importDeviceKeys()` and `/devices` happen before `/kek`.
  - Compare client pub prefix vs server `dk_pub_used_prefix` (same reload).
  - Compare worker “secret prefix” vs server `debug_secret_prefix` (must match).
  - Check sizes: salt b64 len=24 (~16B), iv b64 len=16 (~12B), ct b64 len≈64.
- ENSURE_CEK unwrap OperationError
  - KEK must be provisioned first.
  - If `kid` changed, provision OLD KEK (preferKid), rewrap, then switch to NEW KEK.
  - Verify `cache_keys.kid` equals active KEK `kid`.
- Row decrypt OperationError
  - Ensure CEK exists for store in worker; verify AAD if present.

### Success on reload
- Worker: PROVISION_KEK ok.
- ensureCEK ok for all target stores; rows decrypt.
- No new `wh_device_keks` unless expired/rotated.
- `cache_keys` kids align with current `kid`.


