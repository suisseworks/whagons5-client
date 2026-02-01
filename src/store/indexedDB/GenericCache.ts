import { DB } from "./DB";
import { api } from "@/store/api/internalApi";

type IdType = number | string;

export interface GenericCacheOptions {
	/** Server table name (e.g., 'wh_tasks') used by integrity endpoints */
	table: string;
	/** REST resource path (e.g., '/tasks') */
	endpoint?: string;
	/** IndexedDB object store name (e.g., 'tasks') */
	store: string;
	/** Row primary key field, defaults to 'id' */
	idField?: string;
	/** Optional list of fields used to build row hash. If omitted, a stable JSON of the row is used. */
	hashFields?: string[];
}

/**
 * Extremely small, generic cache for entity rows stored in IndexedDB.
 * It supports basic CRUD used by RTL publications and a minimal fetchAll.
 */
export class GenericCache {
	// table kept for future integrity APIs; currently unused directly
	private readonly table: string;
	private readonly endpoint?: string;
	private readonly store: string;
	private readonly idField: string;
	private readonly hashFields?: string[];
	private validating = false;

	constructor(options: GenericCacheOptions) {
		this.table = options.table;
		this.endpoint = options.endpoint;
		this.store = options.store;
		this.idField = options.idField ?? "id";
		this.hashFields = options.hashFields;
	}

	// Public getter for table name (needed by cache registry)
	public getTableName(): string {
		return this.table;
	}

	private getId(row: any): IdType {
		return row?.[this.idField];
	}

	private get debug(): boolean {
		return localStorage.getItem('wh-debug-integrity') === 'true';
	}

	private dlog(...args: any[]) {
		if (this.debug) console.log(`[GenericCache:${this.store}]`, ...args);
	}

	// Heuristic: verify row shape roughly matches this cache using hashFields presence
	private rowLooksLikeThisStore(row: any): boolean {
		if (!row || typeof row !== 'object') return false;
		if (!this.hashFields || this.hashFields.length === 0) return true;
		// consider valid if at least one of the hashFields exists on the row
		return this.hashFields.some((f) => Object.prototype.hasOwnProperty.call(row, f));
	}

	/**
	 * Some endpoints return an envelope like:
	 *   { data: {...} } or { row: {...} } or { invitation: {...}, invitation_link: "..." }
	 * This ensures we persist the actual entity row (must contain idField).
	 */
	private unwrapSingleEntity(payload: any): any {
		const maxDepth = 4;
		const seen = new Set<any>();

		const find = (node: any, depth: number): any => {
			if (!node || typeof node !== 'object') return null;
			if (seen.has(node)) return null;
			seen.add(node);

			// If it already looks like a row (has id), keep it.
			if (node?.[this.idField] !== undefined && node?.[this.idField] !== null) return node;
			if (depth <= 0) return null;

			// Common wrapper keys first
			const preferredKeys = ['data', 'row', 'invitation', 'result', 'item'];
			for (const k of preferredKeys) {
				if (Object.prototype.hasOwnProperty.call(node, k)) {
					const hit = find((node as any)[k], depth - 1);
					if (hit) return hit;
				}
			}

			// Otherwise traverse object properties (skip arrays)
			for (const key of Object.keys(node)) {
				const val = (node as any)[key];
				if (!val || typeof val !== 'object') continue;
				if (Array.isArray(val)) continue;
				const hit = find(val, depth - 1);
				if (hit) return hit;
			}

			return null;
		};

		return find(payload, maxDepth) ?? payload;
	}

	async add(row: any): Promise<void> {
		if (!DB.inited) await DB.init();

		const idVal = this.getId(row);
		// If row is soft-deleted, ensure it's removed from local cache instead of added
		if (row && Object.prototype.hasOwnProperty.call(row, 'deleted_at') && row.deleted_at != null) {
			try {
				await DB.delete(this.store, idVal as any);
				return;
			} catch (error) {
				console.warn(`GenericCache.add: attempted to remove soft-deleted row in ${this.store} but failed`, { error, idVal });
				return;
			}
		}
		if (idVal === undefined || idVal === null) {
			console.error(`GenericCache.add: Row missing ID field '${this.idField}'`, row);
			return;
		}

		try {
			await DB.put(this.store, row);
		} catch (error) {
			console.error(`GenericCache.add: Failed to add to ${this.store}`, {
				error,
				row,
				idVal,
				store: this.store
			});
			throw error; // Re-throw so RTL can catch it
		}
	}

	async update(_id: IdType, row: any): Promise<void> {
		if (!DB.inited) await DB.init();
		try {
			const dbg = localStorage.getItem('wh-debug-cache') === 'true';
			if (dbg) {
				console.log(`GenericCache.update: store=${this.store}`, {
					incomingIdParam: _id,
					rowHasId: row && (row.id !== undefined && row.id !== null),
					rowId: row?.id,
					rowKeys: row ? Object.keys(row) : [],
				});
			}
			// If row is soft-deleted, remove from local cache instead of updating
			if (row && Object.prototype.hasOwnProperty.call(row, 'deleted_at') && row.deleted_at != null) {
				const idVal = this.getId(row) ?? _id;
				await DB.delete(this.store, idVal as any);
				return;
			}
			await DB.put(this.store, row);
		} catch (e) {
			console.error(`GenericCache.update: failed for ${this.store}`, { error: e, _id, row });
			throw e;
		}
	}

	async remove(id: IdType): Promise<void> {
		if (!DB.inited) await DB.init();
		await DB.delete(this.store, id as any);
	}

	// --- Remote CRUD helpers ---
	/**
	 * Create on server and return created row (tries common REST response shapes)
	 */
	async createRemote(row: any): Promise<any> {
		// Local-only store (no API endpoint)
		if (!this.endpoint) {
			return row;
		}
		try {
			const resp = await api.post(this.endpoint, row);
			
			const result = this.unwrapSingleEntity(resp.data);
			if (!result) {
				console.error(`[GenericCache:${this.store}] createRemote: No data in response`, resp.data);
				throw new Error(`Server response missing data for ${this.store}`);
			}
			return result;
		} catch (error: any) {
			console.error(`[GenericCache:${this.store}] createRemote error:`, {
				message: error?.message,
				response: error?.response?.data,
				status: error?.response?.status,
				endpoint: this.endpoint,
				payload: row
			});
			throw error;
		}
	}

	/**
	 * Update on server and return updated row (tries common REST response shapes)
	 */
	async updateRemote(id: IdType, updates: any): Promise<any> {
		// Local-only store (no API endpoint)
		if (!this.endpoint) {
			return { ...(updates ?? {}), [this.idField]: id };
		}
		const resp = await api.patch(`${this.endpoint}/${id}`, updates);
		return (resp.data?.data ?? resp.data?.row ?? resp.data);
	}

	/**
	 * Delete on server
	 */
	async deleteRemote(id: IdType): Promise<boolean> {
		// Local-only store (no API endpoint)
		if (!this.endpoint) {
			return true;
		}
		await api.delete(`${this.endpoint}/${id}`);
		return true;
	}

	async getAll(): Promise<any[]> {
		if (!DB.inited) await DB.init();
		const rows = await DB.getAll(this.store);
		return rows;
	}

	async fetchAll(params: Record<string, any> = {}): Promise<boolean> {
		// Local-only store (no API endpoint)
		if (!this.endpoint) {
			return true;
		}
		try {
			const resp = await api.get(this.endpoint, { params });
			
			const rows = (resp.data?.rows ?? resp.data?.data ?? resp.data) as any[];
			
			if (!Array.isArray(rows)) {
				console.error(`[GenericCache:${this.store}] Response is not an array:`, typeof rows, rows);
				return false;
			}
			
			// Only proceed with pruning/updating if we got a successful response (200-299)
			// This prevents clearing local data on API errors or malformed responses
			if (resp.status < 200 || resp.status >= 300) {
				console.warn(`[GenericCache:${this.store}] Non-success status code: ${resp.status}, skipping update`);
				return false;
			}
			
			if (!DB.inited) await DB.init();
			// Signal hydration start/end to coordinate readers
			const end = (DB as any).startHydration?.(this.store) || (() => {});
			try {
				// Determine if this fetch is partial (has filters). If partial, avoid pruning
				// local rows not present in the response to prevent race conditions where
				// a concurrent filtered fetch overwrites a recently added row.
				const isPartialFetch = params && Object.keys(params).length > 0;
				if (!isPartialFetch) {
					// Full fetch: prune local rows that are no longer present in server response
					// Only prune if we have a valid response - empty array is valid (server is empty)
					const existing = await this.getAll();
					const fetchedIdSet = new Set<any>(rows.map((r) => this.getId(r)));
					for (const localRow of existing) {
						const idVal = this.getId(localRow);
						if (!fetchedIdSet.has(idVal)) {
							try { await DB.delete(this.store, idVal as any); } catch {}
						}
					}
				}
				await DB.bulkPut(this.store, rows);
			} finally {
				end();
			}
			return true;
		} catch (e) {
			console.error(`[GenericCache:${this.store}] fetchAll error:`, this.endpoint, e);
			// Don't clear local data on error - preserve existing cache
			return false;
		}
	}

	// --- Integrity validation ---
	async validate(serverGlobalHash?: string | null): Promise<boolean> {
		try {
			if (this.validating) { 
				this.dlog('validate: already running'); 
				return true; 
			}
			this.validating = true;
			const t0 = performance.now();
			
			// CRITICAL: Check if cache is empty FIRST, before checking integrity hashing
			// This ensures we fetch data even when integrity hashing isn't set up
			let preRows: any[] = [];
			try {
				preRows = await this.getAll();
			} catch (e: any) {
				// Handle IndexedDB errors (e.g., object store doesn't exist)
				if (e?.name === 'NotFoundError' || e?.message?.includes('object stores')) {
					// Object store doesn't exist - skip validation
					this.validating = false;
					return true;
				}
				// Re-throw other errors
				throw e;
			}
			if (preRows.length === 0) {
				this.dlog('no local rows; fetchAll bootstrap');
				try {
					await this.fetchAll();
					// Warm-read to ensure writes are committed and CEK is ready before returning
					try { await this.getAll(); } catch {}
				} catch (e: any) {
					// If endpoint doesn't exist (404) or requires parameters (422/400), skip validation
					const status = e?.response?.status;
					if (status === 404 || status === 422 || status === 400) {
						this.dlog(`Endpoint ${this.endpoint} returns ${status}, skipping validation (endpoint may not exist or require parameters)`);
						this.validating = false;
						return true;
					}
					console.warn(`[GenericCache:${this.store}] Bootstrap fetchAll failed`, e);
				}
				this.validating = false; 
				return true;
			}

		
		// If local rows exist but appear to be from a different store (corrupted/mismatched), reset and fetch
		try {
			const sample = preRows.slice(0, Math.min(10, preRows.length));
			const invalid = sample.filter((r) => !this.rowLooksLikeThisStore(r)).length;
			if (invalid > sample.length / 2) {
				console.warn(`[GenericCache:${this.store}] detected mismatched rows; clearing store and refetching`, { store: this.store, sampleSize: sample.length, invalid, sample: sample[0] });
				if (!DB.inited) await DB.init();
				await DB.clear(this.store as any);
				await this.fetchAll();
				try { await this.getAll(); } catch {}
				this.validating = false; return true;
			}
		} catch {}
		const localBlocks = await this.computeLocalBlockHashes();
		// Global short-circuit
		const localGlobalConcat = localBlocks.map(b => b.block_hash).join('');
		const localGlobalHash = await this.sha256Hex(localGlobalConcat);
		let serverGlobal: string | undefined | null = serverGlobalHash ?? null;
		
		// Only fetch server global hash if not already provided
		if (serverGlobal === null) {
			// First check if integrity hashing is set up for this table
			// If not, skip validation entirely to avoid clearing the store
			try {
				const testResp = await api.get('/integrity/global', { params: { table: this.table } });
				const responseData = testResp.data?.data;
				serverGlobal = (responseData?.global_hash ?? testResp.data?.global_hash) as string | undefined | null;
				
				// If response data is null or doesn't have global_hash, integrity hashing isn't set up
				if (!responseData || responseData === null || !responseData.global_hash) {
					console.log(`[GenericCache:${this.store}] Integrity hashing not set up for table; skipping validation`, { table: this.table, responseData });
					this.validating = false;
					return true; // Skip validation, keep existing data
				}
				
				const rawBlockCount = (responseData?.block_count ?? testResp.data?.block_count ?? null) as number | string | null;
				const serverBlockCount = rawBlockCount === null ? null : Number(rawBlockCount);
				this.dlog('validate: global compare', { table: this.table, localBlocks: localBlocks.length, serverBlockCount, equal: serverGlobal === localGlobalHash, serverGlobal: (serverGlobal||'').slice(0,16), localGlobal: localGlobalHash.slice(0,16) });
				
			} catch (e: any) {
				// If integrity endpoint returns 404 or 400, table doesn't have integrity hashing
				if (e?.response?.status === 404 || (e?.response?.status >= 400 && e?.response?.status < 500)) {
					console.log(`[GenericCache:${this.store}] Integrity endpoint not available; skipping validation (table may not have integrity hashing)`, { table: this.table, status: e?.response?.status });
					this.validating = false;
					return true; // Skip validation, keep existing data
				}
				// For other errors (network, 500, etc), continue with validation
				console.warn(`[GenericCache:${this.store}] Integrity check failed but continuing validation`, { table: this.table, error: e });
			}
		} else {
			// Server hash was provided by batch call - skip individual fetch
			this.dlog('validate: using batch-provided global hash', { table: this.table, localBlocks: localBlocks.length, equal: serverGlobal === localGlobalHash, serverGlobal: (serverGlobal||'').slice(0,16), localGlobal: localGlobalHash.slice(0,16) });
		}
		
		// If global hashes match, short-circuit WITHOUT fetching blocks/rows
		if (serverGlobal && serverGlobal === localGlobalHash) {
			this.dlog('validate: global hash match; skipping block/row validation');
			this.validating = false;
			return true;
		}
		if (serverGlobal && serverGlobal !== localGlobalHash) {
			this.dlog('validate: global hash mismatch', { table: this.table });
		}

			// Server blocks; rebuild if empty
			let serverBlocksResp;
			let serverBlocks: Array<{ block_id: number; block_hash: string; row_count: number }> = [];
			try {
				serverBlocksResp = await api.get('/integrity/blocks', { params: { table: this.table } });
				serverBlocks = serverBlocksResp.data.data || [];
			} catch (e: any) {
				// If integrity endpoint returns 404 or error, table might not have integrity hashing set up
				// In this case, skip validation rather than clearing the store
				if (e?.response?.status === 404 || e?.response?.status >= 400) {
					this.dlog('integrity endpoint not available for table; skipping validation (table may not have integrity hashing)', { table: this.table, status: e?.response?.status });
					this.validating = false;
					return true; // Skip validation, keep existing data
				}
				throw e;
			}
			
			// If blocks are empty and global hash is null, backend table is empty - clear IndexedDB
			// BUT: Only if we successfully got a response (not a 404/error), meaning integrity is set up
			if (serverBlocks.length === 0 && (!serverGlobal || serverGlobal === null) && localBlocks.length > 0) {
				this.dlog('server blocks empty and global hash is null; clearing local store (backend table is empty)', { table: this.table });
				if (!DB.inited) await DB.init();
				await DB.clear(this.store as any);
				this.validating = false;
				return true;
			}
			
			// If blocks are empty but we have local data, try rebuild first
			if (serverBlocks.length === 0 && localBlocks.length > 0) {
				try {
					await api.post('/integrity/rebuild', { table: this.table });
					serverBlocksResp = await api.get('/integrity/blocks', { params: { table: this.table } });
					serverBlocks = serverBlocksResp.data.data || [];
					// If blocks are still empty after rebuild, backend table is empty - clear IndexedDB
					if (serverBlocks.length === 0) {
						this.dlog('server blocks empty after rebuild; clearing local store (backend table is empty)', { table: this.table });
						if (!DB.inited) await DB.init();
						await DB.clear(this.store as any);
						this.validating = false;
						return true;
					}
				} catch (_) { 
					this.validating = false; 
					return true; 
				}
			}

			const serverMap = new Map(serverBlocks.map(b => [b.block_id, b]));
			const mismatched: number[] = [];
			for (const lb of localBlocks) {
				const sb = serverMap.get(lb.block_id);
				if (!sb || sb.block_hash !== lb.block_hash || sb.row_count !== lb.row_count) {
					this.dlog('mismatch block', { block: lb.block_id, reason: !sb ? 'missing' : (sb.block_hash !== lb.block_hash ? 'hash' : 'count') });
					mismatched.push(lb.block_id);
				}
			}
			for (const sb of serverBlocks) if (!localBlocks.find(b => b.block_id === sb.block_id)) mismatched.push(sb.block_id);

			if (mismatched.length === 0) { this.dlog('blocks equal; finishing', { ms: Math.round(performance.now() - t0) }); this.validating = false; return true; }

			for (const blockId of Array.from(new Set(mismatched)).filter(n => Number.isFinite(n))) {
				const serverRowsResp = await api.get(`/integrity/blocks/${blockId}/rows`, { params: { table: this.table } });
				const serverRows: Array<{ row_id: number; row_hash: string }> = serverRowsResp.data.data || [];
				const serverRowMap = new Map(serverRows.map(r => [r.row_id, r.row_hash]));

				const localRowsInBlock = await this.getRowsInBlock(blockId);
				const localRowMap = new Map<number, string>();
				for (const r of localRowsInBlock) {
					const idNum = Number(this.getId(r));
					localRowMap.set(idNum, await this.hashRow(r));
				}

				const toRefetch: number[] = [];
				for (const [rowId, localHash] of localRowMap.entries()) {
					const sh = serverRowMap.get(rowId);
					if (!sh || sh !== localHash) {
						toRefetch.push(rowId);
						// Detailed diff logging when debug enabled
						this.dlog('row hash mismatch', { table: this.table, blockId, rowId, localHash, serverHash: sh });
					}
				}
				for (const [rowId] of serverRowMap.entries()) if (!localRowMap.has(rowId)) toRefetch.push(rowId);

				if (toRefetch.length) {
					this.dlog('refetch ids', { blockId, count: toRefetch.length });
					const chunk = 200;
					const fetchedIds = new Set<number>();
					for (let i = 0; i < toRefetch.length; i += chunk) {
						const ids = toRefetch.slice(i, i + chunk);
						try {
							if (!this.endpoint) {
								this.dlog('validate: cannot refetch rows; missing endpoint', { table: this.table, store: this.store });
								break;
							}
							const resp = await api.get(this.endpoint, { params: { ids: ids.join(','), per_page: ids.length, page: 1 } });
							const rows = (resp.data?.data || resp.data?.rows) as any[];
							if (rows?.length) {
								// Track which IDs we successfully fetched
								for (const r of rows) {
									const idNum = Number(this.getId(r));
									fetchedIds.add(idNum);
								}
								// attach server row hash for stability
								const rowsWithHash = rows.map(r => {
									const idNum = Number(this.getId(r));
									const h = serverRowMap.get(idNum);
									return h ? { ...r, __h: h } : r;
								});
								if (!DB.inited) await DB.init();
								const endBlk = (DB as any).startHydration?.(this.store) || (() => {});
								try {
									await DB.bulkPut(this.store, rowsWithHash);
								} finally {
									endBlk();
								}
								// After write, log local vs server hashes for verification
								for (const r of rows) {
									const idNum = Number(this.getId(r));
									const newLocalHash = await this.hashRow(r);
									const serverHash = serverRowMap.get(idNum);
									this.dlog('post-refetch hash', { table: this.table, rowId: idNum, localHash: newLocalHash, serverHash });
								}
							} else {
								// If ids filter returned empty, check if endpoint supports ids filter
								// If it does, the rows were deleted - we'll handle deletion below
								// If it doesn't, fallback to full fetchAll
								const idsSet = new Set(ids.map(id => Number(id)));
								const hasServerRowsForIds = Array.from(idsSet).some(id => serverRowMap.has(id));
								if (!hasServerRowsForIds) {
									// None of the requested IDs exist on server - they were deleted
									// Don't fallback to fetchAll, just mark them for deletion
									this.dlog('ids fetch returned 0 and no server rows found - rows were deleted', { ids: Array.from(idsSet) });
								} else {
									// Fallback: some endpoints may not support ids filter (e.g., workspaces)
									try {
										this.dlog('ids fetch returned 0; falling back to full fetchAll');
										await this.fetchAll();
										// After fetchAll, mark all server rows as fetched
										const allServerRows = await this.getAll();
										for (const r of allServerRows) {
											const idNum = Number(this.getId(r));
											fetchedIds.add(idNum);
										}
									} catch { /* ignore */ }
								}
							}
						} catch (e) { console.warn('validate: batch fetch failed', e); }
					}
					
					// Delete local rows that were requested but not returned (deleted on server)
					for (const requestedId of toRefetch) {
						if (!fetchedIds.has(requestedId) && !serverRowMap.has(requestedId)) {
							this.dlog('deleting local row that was deleted on server', { table: this.table, rowId: requestedId });
							await this.remove(requestedId);
						}
					}
				}

				// Cleanup: remove local-only rows that don't exist in serverRows
				const serverIds = new Set<number>(serverRows.map(r => r.row_id));
				for (const localId of Array.from(localRowMap.keys())) {
					if (!serverIds.has(localId)) {
						this.dlog('deleting local row not found in server rows', { table: this.table, rowId: localId });
						await this.remove(localId);
					}
				}
			}

			this.dlog('validate finished', { ms: Math.round(performance.now() - t0) });
			this.validating = false;
			return true;
		} catch (error) {
			console.error('GenericCache.validate', { table: this.table, endpoint: this.endpoint, error });
			this.validating = false;
			return false;
		}
	}

	// Batch validation: accept multiple caches, request one global batch from server,
	// and short-circuit those with matching global hashes. Falls back to per-cache validate otherwise.
	// Optionally accepts additional table names to include in batch call (e.g., 'wh_tasks')
	static async validateMultiple(caches: GenericCache[], additionalTables: string[] = []): Promise<{ results: Record<string, boolean>; serverMap: Record<string, { global_hash?: string; block_count?: number } | null> }> {
		if (!caches.length && !additionalTables.length) return { results: {}, serverMap: {} };
		// Compute local global hashes SEQUENTIALLY to avoid cross-store races
		// For empty caches, skip hash computation and just validate directly
		const locals: Array<{ cache: GenericCache; table: string; localGlobal: string; blockCount: number }> = [];
		for (const c of caches) {
			try {
				// Check if cache is empty first - if so, skip hash computation
				const rows = await c.getAll();
				if (rows.length === 0) {
					// Add with empty hash so it will call validate() which will fetch
					locals.push({ cache: c, table: c.getTableName(), localGlobal: '', blockCount: 0 });
					continue;
				}
				
				const blocks = await c.computeLocalBlockHashes();
				const concat = blocks.map(b => b.block_hash).join('');
				const global = await c.sha256Hex(concat);
				locals.push({ cache: c, table: c.getTableName(), localGlobal: global, blockCount: blocks.length });
			} catch (e: any) {
				// Handle transient DB errors - skip this cache but continue with others
				if (e?.name === 'InvalidStateError' || e?.message?.includes('connection is closing')) {
					console.warn(`GenericCache.validateMultiple: DB error for ${c.getTableName()}, SKIPPING THIS CACHE`, e?.message);
					// Don't add to locals, so it won't be validated
					continue;
				}
				// For OTHER errors (like encryption errors), still add to locals with empty hash
				// so validate() can try to fetch
				console.warn(`GenericCache.validateMultiple: Non-DB error for ${c.getTableName()}, adding to locals anyway`, e?.message);
				locals.push({ cache: c, table: c.getTableName(), localGlobal: '', blockCount: 0 });
			}
		}

		// Include additional tables (like wh_tasks) in batch call
		const tables = [...locals.map(l => l.table), ...additionalTables];
		let serverMap: Record<string, { global_hash?: string; block_count?: number } | null> = {};
		try {
			const resp = await api.get('/integrity/global/batch', { params: { tables: tables.join(',') } });
			serverMap = (resp.data?.data || {}) as typeof serverMap;
		} catch (_e) {
			console.warn(`[GenericCache.validateMultiple] Batch call failed:`, _e);
			// Fallback: empty map -> all will individually validate
		}

		const results: Record<string, boolean> = {};
		
		// Execute validations in parallel to avoid slow sequential startup
		await Promise.all(locals.map(async (l) => {
			const s = serverMap[l.table] ?? null;
			
			// OPTIMIZATION: If both local and server are empty, skip validation entirely
			// This avoids unnecessary fetchAll() calls for empty tables
			// Server can be null (no wh_table_hashes row) OR an object with null/empty hash
			const serverIsEmpty = !s || !s.global_hash || s.global_hash === '' || (s.block_count !== undefined && s.block_count === 0);
			const localIsEmpty = l.blockCount === 0;
			
			if (serverIsEmpty && localIsEmpty) {
				// Both empty - no need to fetch or validate
				results[l.table] = true;
				return;
			}
			
			// If local is empty but server has data, need to fetch
			if (localIsEmpty && !serverIsEmpty && s && s.global_hash) {
				// Pass server hash to avoid redundant API call
				results[l.table] = await l.cache.validate(s.global_hash);
				return;
			}
			
			// If server returns null but local has data, validate to check consistency
			if (!s && !localIsEmpty) {
				results[l.table] = await l.cache.validate();
				return;
			}
			
			// Strict short-circuit: use ONLY global hash equality to skip per-table calls
			if (s && s.global_hash && s.global_hash === l.localGlobal) {
				results[l.table] = true;
			} else {
				// Pass server global hash to avoid redundant API calls
				results[l.table] = await l.cache.validate(s?.global_hash || undefined);
			}
		}));
		
		return { results, serverMap };
	}

	private async hashRow(row: any): Promise<string> {
		// Use server-provided hash if we cached it during validation
		if (row && typeof (row as any).__h === 'string' && (row as any).__h.length) {
			return (row as any).__h as string;
		}
		if (this.hashFields && this.hashFields.length > 0) {
			const parts = this.hashFields.map((field) => {
				const value = row?.[field as any];
				// Nullable numeric fields: some backend triggers use COALESCE(x,0) even when the field
				// does NOT end with _id (e.g., approvals.minimum_approvals). Without mirroring this,
				// global hashes will never match for rows where the value is null.
				if (value === null || value === undefined) {
					if (field === 'minimum_approvals') return '0';
				}
				// Nullable foreign keys: backend triggers almost always use COALESCE(x,0) for *_id fields.
				// If we hash null/undefined as empty string here, global hashes will *never* match for rows
				// with optional FKs (e.g., parent_id).
				if (typeof field === 'string' && field.endsWith('_id') && (value === null || value === undefined)) {
					return '0';
				}
				// Normalize timestamps for fields ending with _at or _date to epoch ms (UTC)
				if (typeof field === 'string' && (field.endsWith('_at') || field.endsWith('_date'))) {
					if (!value) return '';
					let vStr = String(value);
					// If it looks like 'YYYY-MM-DD HH:mm:ss(.sss)?' without timezone, assume UTC
					if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(vStr) && !/[zZ]|[+\-]\d{2}:?\d{2}$/.test(vStr)) {
						// ensure T separator and Z so Date parses as UTC
						vStr = vStr.replace(' ', 'T') + 'Z';
					}
					const dt = new Date(vStr);
					return isNaN(dt.getTime()) ? '' : String(dt.getTime());
				}
				// Booleans: Postgres CONCAT_WS casts to text as 't'/'f'
				if (typeof value === 'boolean') return value ? 't' : 'f';
				// Deterministic stringify for arrays/objects (matches server ::text casting semantics)
				if (Array.isArray(value)) return this.stableJsonText(value);
				if (value && typeof value === 'object') return this.stableJsonText(value);
				return this.safeValue(value);
			}).join('|');
			return this.sha256Hex(parts);
		}
		// Fallback: stable JSON of the row
		return this.sha256Hex(this.stableJsonText(row));
	}

	private async computeLocalBlockHashes(): Promise<Array<{ block_id: number; min_row_id: number; max_row_id: number; row_count: number; block_hash: string }>> {
		const rows = (await this.getAll()).filter(r => r != null && this.getId(r) != null);
		const BLOCK_SIZE = 1024;
		const byBlock = new Map<number, Array<{ id: number; hash: string }>>();
		for (const r of rows) {
			const idNum = Number(this.getId(r));
			if (!Number.isFinite(idNum)) continue;
			const blk = Math.floor(idNum / BLOCK_SIZE);
			if (!byBlock.has(blk)) byBlock.set(blk, []);
			byBlock.get(blk)!.push({ id: idNum, hash: await this.hashRow(r) });
		}
		const blocks: Array<{ block_id: number; min_row_id: number; max_row_id: number; row_count: number; block_hash: string }> = [];
		for (const [blk, arr] of byBlock.entries()) {
			arr.sort((a,b) => a.id - b.id);
			const concat = arr.map(x => x.hash).join('');
			const hash = await this.sha256Hex(concat);
			blocks.push({ block_id: blk, min_row_id: arr[0].id, max_row_id: arr[arr.length-1].id, row_count: arr.length, block_hash: hash });
		}
		blocks.sort((a,b) => a.block_id - b.block_id);
		return blocks;
	}

	private async getRowsInBlock(blockId: number): Promise<any[]> {
		const BLOCK_SIZE = 1024;
		const minId = blockId * BLOCK_SIZE;
		const maxId = minId + BLOCK_SIZE - 1;
		const rows = await this.getAll();
		return rows.filter(r => {
			const idNum = Number(this.getId(r));
			return idNum >= minId && idNum <= maxId;
		});
	}

	private stableJsonText(input: any): string {
		if (input === null || input === undefined) return '';
		const replacer = (_key: string, value: any) => {
			if (value && typeof value === 'object' && !Array.isArray(value)) {
				const sorted: Record<string, any> = {};
				Object.keys(value).sort().forEach(k => { sorted[k] = value[k]; });
				return sorted;
			}
			return value;
		};
		try { return JSON.stringify(input, replacer); } catch { return ''; }
	}

	private safeValue(v: any): string {
		if (v === null || v === undefined) return '';
		if (v instanceof Date) return String(v.getTime());
		if (typeof v === 'object') return this.stableJsonText(v);
		return String(v);
	}

	private async sha256Hex(text: string): Promise<string> {
		// Defer import to avoid increasing bundle if not used
		const { default: sha256 } = await import('crypto-js/sha256');
		const { default: encHex } = await import('crypto-js/enc-hex');
		return sha256(text).toString(encHex);
	}
}
