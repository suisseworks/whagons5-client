import { DB } from "./DB";
import api from "@/api/whagonsApi";

type IdType = number | string;

export interface GenericCacheOptions {
	/** Server table name (e.g., 'wh_tasks') used by integrity endpoints */
	table: string;
	/** REST resource path (e.g., '/tasks') */
	endpoint: string;
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
	private readonly endpoint: string;
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

	async add(row: any): Promise<void> {
		if (!DB.inited) await DB.init();
		const idVal = this.getId(row);
		if (idVal === undefined || idVal === null) return;
		DB.getStoreWrite(this.store as any).put(row);
	}

	async update(_id: IdType, row: any): Promise<void> {
		if (!DB.inited) await DB.init();
		DB.getStoreWrite(this.store as any).put(row);
	}

	async remove(id: IdType): Promise<void> {
		if (!DB.inited) await DB.init();
		const key = typeof id === "number" ? id : Number(id);
		DB.getStoreWrite(this.store as any).delete(key);
	}

	// --- Remote CRUD helpers ---
	/**
	 * Create on server and return created row (tries common REST response shapes)
	 */
	async createRemote(row: any): Promise<any> {
		const resp = await api.post(this.endpoint, row);
		return (resp.data?.data ?? resp.data?.row ?? resp.data);
	}

	/**
	 * Update on server and return updated row (tries common REST response shapes)
	 */
	async updateRemote(id: IdType, updates: any): Promise<any> {
		const resp = await api.patch(`${this.endpoint}/${id}`, updates);
		return (resp.data?.data ?? resp.data?.row ?? resp.data);
	}

	/**
	 * Delete on server
	 */
	async deleteRemote(id: IdType): Promise<boolean> {
		await api.delete(`${this.endpoint}/${id}`);
		return true;
	}

	async getAll(): Promise<any[]> {
		if (!DB.inited) await DB.init();
		const store = DB.getStoreRead(this.store as any);
		const req = store.getAll();
		return await new Promise<any[]>((resolve, reject) => {
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
	}

	async fetchAll(params: Record<string, any> = {}): Promise<boolean> {
		try {
			const resp = await api.get(this.endpoint, { params });
			const rows = (resp.data?.rows ?? resp.data?.data ?? resp.data) as any[];
			if (!DB.inited) await DB.init();
			const store = DB.getStoreWrite(this.store as any);
			for (const r of rows) store.put(r);
			return true;
		} catch (e) {
			console.error("GenericCache.fetchAll", this.endpoint, e);
			return false;
		}
	}

	// --- Integrity validation ---
	async validate(): Promise<boolean> {
		try {
			if (this.validating) { this.dlog('validate: already running'); return true; }
			this.validating = true;
			const t0 = performance.now();
			const localBlocks = await this.computeLocalBlockHashes();
			// Global short-circuit
			const localGlobalConcat = localBlocks.map(b => b.block_hash).join('');
			const localGlobalHash = await this.sha256Hex(localGlobalConcat);
			try {
				const globalResp = await api.get('/integrity/global', { params: { table: this.table } });
				const serverGlobal = globalResp.data?.data?.global_hash;
				const serverBlockCount = globalResp.data?.data?.block_count ?? null;
				this.dlog('global compare', { localBlocks: localBlocks.length, serverBlockCount, equal: serverGlobal === localGlobalHash });
				if (serverGlobal && serverGlobal !== localGlobalHash) {
					this.dlog('global hash mismatch', { table: this.table, localGlobalHash, serverGlobal });
				}
				if (serverGlobal && serverGlobal === localGlobalHash && (serverBlockCount === null || serverBlockCount === localBlocks.length)) {
					this.dlog('global hash match; skipping block compare');
					this.validating = false;
					return true;
				}
			} catch (_) {}

			// Server blocks; rebuild if empty
			let serverBlocksResp = await api.get('/integrity/blocks', { params: { table: this.table } });
			let serverBlocks: Array<{ block_id: number; block_hash: string; row_count: number }> = serverBlocksResp.data.data || [];
			if (serverBlocks.length === 0 && localBlocks.length > 0) {
				try {
					await api.post('/integrity/rebuild', { table: this.table });
					serverBlocksResp = await api.get('/integrity/blocks', { params: { table: this.table } });
					serverBlocks = serverBlocksResp.data.data || [];
					if (serverBlocks.length === 0) { this.validating = false; return true; }
				} catch (_) { this.validating = false; return true; }
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

			for (const blockId of Array.from(new Set(mismatched))) {
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
					for (let i = 0; i < toRefetch.length; i += chunk) {
						const ids = toRefetch.slice(i, i + chunk);
						try {
							const resp = await api.get(this.endpoint, { params: { ids: ids.join(','), per_page: ids.length, page: 1 } });
							const rows = (resp.data?.data || resp.data?.rows) as any[];
							if (rows?.length) {
								if (!DB.inited) await DB.init();
								const store = DB.getStoreWrite(this.store as any);
								for (const r of rows) store.put(r);
								// After write, log local vs server hashes for verification
								for (const r of rows) {
									const idNum = Number(this.getId(r));
									const newLocalHash = await this.hashRow(r);
									const serverHash = serverRowMap.get(idNum);
									this.dlog('post-refetch hash', { table: this.table, rowId: idNum, localHash: newLocalHash, serverHash });
								}
							}
						} catch (e) { console.warn('validate: batch fetch failed', e); }
					}
				}

				// Cleanup: remove local-only rows
				const serverIds = new Set<number>(serverRows.map(r => r.row_id));
				for (const localId of Array.from(localRowMap.keys())) {
					if (!serverIds.has(localId)) await this.remove(localId);
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

	private async hashRow(row: any): Promise<string> {
		if (this.hashFields && this.hashFields.length > 0) {
			const parts = this.hashFields.map((field) => {
				const value = row?.[field as any];
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
		const rows = await this.getAll();
		const BLOCK_SIZE = 1024;
		const byBlock = new Map<number, Array<{ id: number; hash: string }>>();
		for (const r of rows) {
			const idNum = Number(this.getId(r));
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


