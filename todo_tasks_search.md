# Tasks Search — Performance & Indexing TODO

Authoritative encryption spec: `R&D/IndexedDBEncryption.md`.
Goal: Keep task search snappy with encrypted-at-rest storage.

## Must-haves (near-term)
- [x] In-memory decrypted cache for tasks with short TTL to avoid re-decrypt per keystroke
- [ ] UI debounce on search input (200–300ms) to reduce query bursts

## Nice-to-haves (when/if needed at larger scale)
- [ ] Optional in-memory inverted index for `name`/`description` built from decrypted rows at init; refresh on updates
- [ ] Optional persisted n-gram token index in IndexedDB for substring search at very large N (space/cplx tradeoff)

## Secure equality indexes (sensitive fields only)
- [ ] Derive per-table `indexKey = HKDF(CEK, 'index')` in crypto worker
- [ ] Tokenize values: `token = HMAC-SHA256(indexKey, normalized(value))`
- [ ] Maintain `idb:index:tasks:<field>` → `{ token, ids[] }` on writes/deletes
- [ ] Query path: compute token for input value in worker, fetch ids, decrypt only matching rows

## Operational
- [ ] Add perf telemetry: query duration, result count, tasks size thresholds
- [ ] Auto-adjust: switch to in-memory inverted index when task count > threshold (e.g., 10k)
- [ ] Document privacy trade-offs (HMAC index leaks equality/frequency; acceptable for equality lookups)

