import { auth } from "@/firebase/firebaseConfig";
import { Category } from "../types";
import { DB } from "./DB";
import api from "@/api/whagonsApi";
import sha256 from "crypto-js/sha256";
import encHex from "crypto-js/enc-hex";

export class CategoriesCache {

    private static initPromise: Promise<boolean> | null = null;
    private static authListener: (() => void) | null = null;
    private static validating = false;
    private static get debug(): boolean {
        return localStorage.getItem('wh-debug-integrity') === 'true';
    }
    private static dlog(...args: any[]) {
        if (this.debug) console.log('[CategoriesCache]', ...args);
    }

    public static async init(): Promise<boolean> {
        // Prevent multiple simultaneous initializations
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this._doInit();
        try {
            return await this.initPromise;
        } finally {
            this.initPromise = null;
        }
    }

    private static async _doInit(): Promise<boolean> {
        await DB.init();
        
        if (!auth.currentUser) {
            return new Promise((resolve) => {
                // Clean up any existing listener
                if (this.authListener) {
                    this.authListener();
                }

                this.authListener = auth.onAuthStateChanged(async (user) => {
                    if (user) {
                        this.authListener?.();
                        this.authListener = null;
                        try {
                            const result = await this._doInit();
                            resolve(result);
                        } catch (error) {
                            console.error('Error during delayed initialization:', error);
                            resolve(false);
                        }
                    } else {
                        this.authListener?.();
                        this.authListener = null;
                        resolve(false);
                    }
                });
            });
        }

        // Always validate via hashing on mount; if cache is empty, do a full fetch once
        const localCount = (await this.getCategories()).length;
        if (localCount === 0) {
            return await this.fetchCategories();
        }
        return await this.validateCategories();
    }

    public static async deleteCategory(categoryId: number | string) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("categories");
        const key = typeof categoryId === 'number' ? categoryId : Number(categoryId);
        store.delete(key);
    }

    public static async deleteCategories() {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("categories");
        store.clear();
    }

    public static async updateCategory(id: string, category: Category) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("categories");
        //delete the old category
        store.delete(id);
        //add the new category
        store.put(category);
    }

    public static async addCategory(category: Category) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("categories");
        // Ensure we have a primary key value that matches the object store's keyPath
        if (category == null || (category as any).id === undefined || (category as any).id === null) {
            throw new Error('CategoriesCache.addCategory: missing id field required by object store keyPath');
        }
        store.put(category);
    }

    public static async addCategories(categories: Category[]) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("categories");
        categories.forEach(category => {
            store.put(category);
        });
    }

    public static async getCategory(categoryId: string) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreRead("categories");
        const request = store.get(categoryId);
        const category = await new Promise<Category>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return category;
    }

    public static async getCategories() {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreRead("categories");
        const request = store.getAll();
        const categories = await new Promise<Category[]>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return categories;
    }

    public static async getLastUpdated(): Promise<Date> {
        const store = DB.getStoreRead("categories");
        const request = store.getAll();
        const categories = await new Promise<Category[]>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        //we need the most recent updated_at date
        const lastUpdated = categories.reduce((max, category) => {
            return new Date(category.updated_at) > max ? new Date(category.updated_at) : max;
        }, new Date(0));
        return lastUpdated; 
    }

    // Deprecated flags for hashing-based validation
    public static get initialized(): boolean { return true; }
    public static set initialized(_: boolean) { /* no-op */ }
    public static get lastUpdated(): Date { return new Date(0); }
    public static set lastUpdated(_: Date) { /* no-op */ }

    public static async fetchCategories() {
        try {
            const response = await api.get("/categories");
            const categories = response.data.rows as Category[];
            console.log("categories", categories);
            this.addCategories(categories);
            return true;
        } catch (error) {
            console.error("fetchCategories", error);
            return false;
        }
    }

    public static async createCategory(categoryData: Omit<Category, 'id' | 'created_at' | 'updated_at'>) {
        try {
            const response = await api.post("/categories", categoryData);
            const newCategory = response.data as Category;
            console.log("category created", newCategory);
            this.addCategory(newCategory);
            return newCategory;
        } catch (error) {
            console.error("createCategory", error);
            throw error;
        }
    }

    public static async validateCategories() {
        try {
            if (this.validating) { this.dlog('validateCategories: already running'); return true; }
            this.validating = true;
            const t0 = performance.now();
            const localBlocks = await this.computeLocalBlockHashes();
            // 0) Global hash fast path
            const localGlobalConcat = localBlocks.map(b => b.block_hash).join('');
            const localGlobalHash = sha256(localGlobalConcat).toString(encHex);
            try {
                const globalResp = await api.get('/integrity/global', { params: { table: 'wh_categories' } });
                const serverGlobal = globalResp.data?.data?.global_hash;
                const serverBlockCount = globalResp.data?.data?.block_count ?? null;
                this.dlog('global compare', { localBlocks: localBlocks.length, serverBlockCount, equal: serverGlobal === localGlobalHash });
                if (serverGlobal && serverGlobal === localGlobalHash && (serverBlockCount === null || serverBlockCount === localBlocks.length)) {
                    this.dlog('global hash match; skipping block compare');
                    this.validating = false;
                    return true;
                }
            } catch (_) {}

            // 1) Block list; rebuild if empty on server
            let serverBlocksResp = await api.get('/integrity/blocks', { params: { table: 'wh_categories' } });
            let serverBlocks: Array<{ block_id: number; block_hash: string; row_count: number }> = serverBlocksResp.data.data || [];
            if (serverBlocks.length === 0 && localBlocks.length > 0) {
                try {
                    await api.post('/integrity/rebuild', { table: 'wh_categories' });
                    serverBlocksResp = await api.get('/integrity/blocks', { params: { table: 'wh_categories' } });
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
                const serverRowsResp = await api.get(`/integrity/blocks/${blockId}/rows`, { params: { table: 'wh_categories' } });
                const serverRows: Array<{ row_id: number; row_hash: string }> = serverRowsResp.data.data || [];
                const serverMapRows = new Map(serverRows.map(r => [r.row_id, r.row_hash]));
                const locals = await this.getCategoriesInBlock(blockId);
                const localMap = new Map<number, string>();
                for (const r of locals) localMap.set(r.id, this.hashCategory(r));

                const toFetch: number[] = [];
                for (const [id, lh] of localMap.entries()) if (serverMapRows.get(id) !== lh) toFetch.push(id);
                for (const [id] of serverMapRows.entries()) if (!localMap.has(id)) toFetch.push(id);

                if (toFetch.length) {
                    this.dlog('refetch ids', { blockId, count: toFetch.length });
                    const chunk = 200;
                    for (let i = 0; i < toFetch.length; i += chunk) {
                        const ids = toFetch.slice(i, i + chunk);
                        try {
                            const resp = await api.get('/categories', { params: { ids: ids.join(','), per_page: ids.length, page: 1 } });
                            const rows = (resp.data.data || resp.data.rows) as Category[];
                            if (rows?.length) await this.addCategories(rows);
                        } catch (e) {
                            console.warn('validateCategories: batch fetch failed', e);
                        }
                    }
                }

                // Cleanup: remove local categories missing on server
                const serverIds = new Set<number>(serverRows.map(r => r.row_id));
                const localIds = Array.from(localMap.keys());
                for (const id of localIds) {
                    if (!serverIds.has(id)) await this.deleteCategory(String(id));
                }
            }
            this.dlog('validateCategories finished', { ms: Math.round(performance.now() - t0) });
            this.validating = false;
            return true;
        } catch (error) {
            console.error('validateCategories', error);
            this.validating = false;
            return false;
        }
    }

    // Integrity helpers
    private static hashCategory(c: Category): string {
        const row = [
            c.id,
            c.name || '',
            c.description || '',
            c.color || '',
            c.icon || '',
            c.enabled ? 't' : 'f',
            c.sla_id || 0,
            c.team_id,
            c.workspace_id,
            new Date(c.updated_at).getTime()
        ].join('|');
        return sha256(row).toString(encHex);
    }

    private static async computeLocalBlockHashes() {
        const categories = await this.getCategories();
        const BLOCK_SIZE = 1024;
        const byBlock = new Map<number, Array<{ id: number; hash: string }>>();
        for (const c of categories) {
            const blk = Math.floor(c.id / BLOCK_SIZE);
            if (!byBlock.has(blk)) byBlock.set(blk, []);
            byBlock.get(blk)!.push({ id: c.id, hash: this.hashCategory(c) });
        }
        const blocks: Array<{ block_id: number; row_count: number; block_hash: string }> = [];
        for (const [blk, arr] of byBlock.entries()) {
            arr.sort((a,b) => a.id - b.id);
            const concat = arr.map(x => x.hash).join('');
            const hash = sha256(concat).toString(encHex);
            blocks.push({ block_id: blk, row_count: arr.length, block_hash: hash });
        }
        blocks.sort((a,b) => a.block_id - b.block_id);
        return blocks;
    }

    private static async getCategoriesInBlock(blockId: number) {
        const BLOCK_SIZE = 1024;
        const minId = blockId * BLOCK_SIZE;
        const maxId = minId + BLOCK_SIZE - 1;
        const all = await this.getCategories();
        return all.filter(c => c.id >= minId && c.id <= maxId);
    }
} 