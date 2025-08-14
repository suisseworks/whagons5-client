import { auth } from "@/firebase/firebaseConfig";
import { DB } from "./DB";
import api from "@/api/whagonsApi";
import { Workspace } from "../types";
import sha256 from "crypto-js/sha256";
import encHex from "crypto-js/enc-hex";

export class WorkspaceCache {

    private static initPromise: Promise<boolean> | null = null;
    private static authListener: (() => void) | null = null;
    private static validating = false;
    private static get debug(): boolean {
        return localStorage.getItem('wh-debug-integrity') === 'true';
    }
    private static dlog(...args: any[]) {
        if (this.debug) console.log('[WorkspaceCache]', ...args);
    }

    private static stableJsonText(input: any): string {
        if (input === null || input === undefined) return '';
        const replacer = (_key: string, value: any) => {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                const sorted: Record<string, any> = {};
                Object.keys(value).sort().forEach(k => { sorted[k] = value[k]; });
                return sorted;
            }
            return value;
        };
        try {
            return JSON.stringify(input, replacer);
        } catch {
            return '';
        }
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

        if (!this.initialized) {
            console.log("fetching workspaces, initialized: ", this.initialized);
            const success = await this.fetchWorkspaces();
            if (success) {
                this.initialized = true;
                this.lastUpdated = await this.getLastUpdated();
                console.log("workspaces fetched, initialized: ", this.initialized, "lastUpdated: ", this.lastUpdated);
            }
            return success;
        }else{
            //I must run a fetch to check if workspaces have changed   
            console.log("validating workspaces, lastUpdated: ", await this.getLastUpdated()); 
            return await this.validateWorkspaces();
        }
        
    }

    public static async deleteWorkspace(workspaceId: number | string) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("workspaces");
        const key = typeof workspaceId === 'number' ? workspaceId : Number(workspaceId);
        store.delete(key);
    }

    public static async deleteWorkspaces() {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("workspaces");
        store.clear();
    }

    public static async updateWorkspace(id: string, workspace: Workspace) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("workspaces");
        //delete the old workspace
        store.delete(id);
        //add the new workspace
        store.put(workspace);
    }

    public static async addWorkspace(workspace: Workspace) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("workspaces");
        store.put(workspace);
    }

    public static async addWorkspaces(workspaces: Workspace[]) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("workspaces");
        workspaces.forEach(workspace => {
            store.put(workspace);
        });
    }

    public static async getWorkspace(workspaceId: string) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreRead("workspaces");
        const request = store.get(workspaceId);
        const workspace = await new Promise<Workspace>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return workspace;
    }

    public static async getWorkspaces() {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreRead("workspaces");
        const request = store.getAll();
        const workspaces = await new Promise<Workspace[]>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return workspaces;
    }

    public static async getLastUpdated(): Promise<Date> {
        const store = DB.getStoreRead("workspaces");
        const request = store.getAll();
        const workspaces = await new Promise<Workspace[]>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        //we need the most recent updated_at date
        const lastUpdated = workspaces.reduce((max, workspace) => {
            return new Date(workspace.updated_at) > max ? new Date(workspace.updated_at) : max;
        }, new Date(0));
        return lastUpdated; 
    }

    // Deprecated flags for hashing-based validation
    public static get initialized(): boolean { return true; }
    public static set initialized(_: boolean) { /* no-op */ }
    public static get lastUpdated(): Date { return new Date(0); }
    public static set lastUpdated(_: Date) { /* no-op */ }

    public static async fetchWorkspaces() {
        try {
            const response = await api.get("/workspaces");
            const workspaces = response.data.rows as Workspace[];
            console.log("workspaces", workspaces);
            this.addWorkspaces(workspaces);
            return true;
        } catch (error) {
            console.error("fetchWorkspaces", error);
            return false;
        }
    }

    public static async validateWorkspaces() {
        try {
            if (this.validating) { this.dlog('validateWorkspaces: already running'); return true; }
            this.validating = true;
            const t0 = performance.now();
            const localBlocks = await this.computeLocalBlockHashes();
            // Global short-circuit
            const localGlobalConcat = localBlocks.map(b => b.block_hash).join('');
            const localGlobalHash = sha256(localGlobalConcat).toString(encHex);
            try {
                const globalResp = await api.get('/integrity/global', { params: { table: 'wh_workspaces' } });
                const serverGlobal = globalResp.data?.data?.global_hash;
                const serverBlockCount = globalResp.data?.data?.block_count ?? null;
                this.dlog('global compare', { localBlocks: localBlocks.length, serverBlockCount, equal: serverGlobal === localGlobalHash });
                if (serverGlobal && serverGlobal === localGlobalHash && (serverBlockCount === null || serverBlockCount === localBlocks.length)) {
                    this.dlog('global hash match; skipping block compare');
                    this.validating = false;
                    return true;
                }
            } catch (_) {}

            let serverBlocksResp = await api.get('/integrity/blocks', { params: { table: 'wh_workspaces' } });
            let serverBlocks: Array<{ block_id: number; block_hash: string; row_count: number }> = serverBlocksResp.data.data || [];
            if (serverBlocks.length === 0 && localBlocks.length > 0) {
                try {
                    await api.post('/integrity/rebuild', { table: 'wh_workspaces' });
                    serverBlocksResp = await api.get('/integrity/blocks', { params: { table: 'wh_workspaces' } });
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
                const serverRowsResp = await api.get(`/integrity/blocks/${blockId}/rows`, { params: { table: 'wh_workspaces' } });
                const serverRows: Array<{ row_id: number; row_hash: string }> = serverRowsResp.data.data || [];
                const serverMapRows = new Map(serverRows.map(r => [r.row_id, r.row_hash]));
                const locals = await this.getWorkspaces();
                const localInBlock = locals.filter(w => Math.floor(w.id / 1024) === blockId);
                const localMap = new Map<number, string>();
                for (const r of localInBlock) localMap.set(r.id, this.hashWorkspace(r));

                const toFetch: number[] = [];
                for (const [id, lh] of localMap.entries()) if (serverMapRows.get(id) !== lh) toFetch.push(id);
                for (const [id] of serverMapRows.entries()) if (!localMap.has(id)) toFetch.push(id);

                if (toFetch.length) {
                    this.dlog('refetch ids', { blockId, count: toFetch.length });
                    const chunk = 200;
                    for (let i = 0; i < toFetch.length; i += chunk) {
                        const ids = toFetch.slice(i, i + chunk);
                        try {
                            const resp = await api.get('/workspaces', { params: { ids: ids.join(','), per_page: ids.length, page: 1 } });
                            const rows = (resp.data.data || resp.data.rows) as Workspace[];
                            if (rows?.length) await this.addWorkspaces(rows);
                        } catch (e) {
                            console.warn('validateWorkspaces: batch fetch failed', e);
                        }
                    }
                }

                // Cleanup: any local rows that are not present in server block rows should be deleted
                const serverIds = new Set<number>(serverRows.map(r => r.row_id));
                let deletedCount = 0;
                for (const localId of Array.from(localMap.keys())) {
                    if (!serverIds.has(localId)) {
                        await this.deleteWorkspace(localId);
                        deletedCount++;
                    }
                }
                this.dlog('cleanup complete', { blockId, deleted: deletedCount });
            }
            this.dlog('validateWorkspaces finished', { ms: Math.round(performance.now() - t0) });
            this.validating = false;
            return true;
        } catch (error) {
            console.error('validateWorkspaces', error);
            this.validating = false;
            return false;
        }
    }

    private static hashWorkspace(w: Workspace): string {
        const row = [
            w.id,
            w.name || '',
            w.description || '',
            w.color || '',
            w.icon || '',
            this.stableJsonText(w.teams),
            w.type || '',
            w.category_id || 0,
            this.stableJsonText(w.spots),
            w.created_by,
            new Date(w.updated_at).getTime()
        ].join('|');
        return sha256(row).toString(encHex);
    }

    private static async computeLocalBlockHashes() {
        const workspaces = await this.getWorkspaces();
        const BLOCK_SIZE = 1024;
        const byBlock = new Map<number, Array<{ id: number; hash: string }>>();
        for (const w of workspaces) {
            const blk = Math.floor(w.id / BLOCK_SIZE);
            if (!byBlock.has(blk)) byBlock.set(blk, []);
            byBlock.get(blk)!.push({ id: w.id, hash: this.hashWorkspace(w) });
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

    
  }



  
  