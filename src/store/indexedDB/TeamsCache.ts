import { auth } from "@/firebase/firebaseConfig";
import { Team } from "../types";
import { DB } from "./DB";
import api from "@/api/whagonsApi";
import sha256 from "crypto-js/sha256";
import encHex from "crypto-js/enc-hex";

export class TeamsCache {

    private static initPromise: Promise<boolean> | null = null;
    private static authListener: (() => void) | null = null;
    private static validating = false;
    private static get debug(): boolean {
        return localStorage.getItem('wh-debug-integrity') === 'true';
    }
    private static dlog(...args: any[]) {
        if (this.debug) console.log('[TeamsCache]', ...args);
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
            console.log("fetching teams, initialized: ", this.initialized);
            const success = await this.fetchTeams();
            if (success) {
                this.initialized = true;
                this.lastUpdated = await this.getLastUpdated();
                console.log("teams fetched, initialized: ", this.initialized, "lastUpdated: ", this.lastUpdated);
            }
            return success;
        } else {
            //I must run a fetch to check if teams have changed   
            console.log("validating teams, lastUpdated: ", await this.getLastUpdated()); 
            return await this.validateTeams();
        }
    }

    public static async deleteTeam(teamId: number | string) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("teams");
        const key = typeof teamId === 'number' ? teamId : Number(teamId);
        store.delete(key);
    }

    public static async deleteTeams() {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("teams");
        store.clear();
    }

    public static async updateTeam(id: string, team: Team) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("teams");
        //delete the old team
        store.delete(id);
        //add the new team
        store.put(team);
    }

    public static async addTeam(team: Team) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("teams");
        store.put(team);
    }

    public static async addTeams(teams: Team[]) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("teams");
        teams.forEach(team => {
            store.put(team);
        });
    }

    public static async getTeam(teamId: string) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreRead("teams");
        const request = store.get(teamId);
        const team = await new Promise<Team>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return team;
    }

    public static async getTeams() {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreRead("teams");
        const request = store.getAll();
        const teams = await new Promise<Team[]>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return teams;
    }

    public static async getLastUpdated(): Promise<Date> {
        const store = DB.getStoreRead("teams");
        const request = store.getAll();
        const teams = await new Promise<Team[]>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        //we need the most recent updated_at date
        const lastUpdated = teams.reduce((max, team) => {
            return new Date(team.updated_at) > max ? new Date(team.updated_at) : max;
        }, new Date(0));
        return lastUpdated; 
    }

    // Deprecated flags for hashing-based validation
    public static get initialized(): boolean { return true; }
    public static set initialized(_: boolean) { /* no-op */ }
    public static get lastUpdated(): Date { return new Date(0); }
    public static set lastUpdated(_: Date) { /* no-op */ }

    public static async fetchTeams() {
        try {
            const response = await api.get("/teams");
            const rawTeams = response.data.rows;
            console.log("raw teams", rawTeams);
            
            // Transform snake_case API response to camelCase format
            const teams: Team[] = rawTeams.map((team: any) => ({
                ...team,
                created_at: team.created_at,
                updated_at: team.updated_at
            }));
            
            console.log("transformed teams", teams);
            this.addTeams(teams);
            return true;
        } catch (error) {
            console.error("fetchTeams", error);
            return false;
        }
    }

    public static async validateTeams() {
        try {
            if (this.validating) { this.dlog('validateTeams: already running'); return true; }
            this.validating = true;
            const t0 = performance.now();
            const localBlocks = await this.computeLocalBlockHashes();
            // 0) Global hash short-circuit
            const localGlobalConcat = localBlocks.map(b => b.block_hash).join('');
            const localGlobalHash = sha256(localGlobalConcat).toString(encHex);
            try {
                const globalResp = await api.get('/integrity/global', { params: { table: 'wh_teams' } });
                const serverGlobal = globalResp.data?.data?.global_hash;
                const serverBlockCount = globalResp.data?.data?.block_count ?? null;
                this.dlog('global compare', { localBlocks: localBlocks.length, serverBlockCount, equal: serverGlobal === localGlobalHash });
                if (serverGlobal && serverGlobal === localGlobalHash && (serverBlockCount === null || serverBlockCount === localBlocks.length)) {
                    this.dlog('global hash match; skipping block compare');
                    this.validating = false;
                    return true;
                }
            } catch (_) {}

            // 1) Blocks (rebuild if empty)
            let serverBlocksResp = await api.get('/integrity/blocks', { params: { table: 'wh_teams' } });
            let serverBlocks: Array<{ block_id: number; block_hash: string; row_count: number }> = serverBlocksResp.data.data || [];
            if (serverBlocks.length === 0 && localBlocks.length > 0) {
                try {
                    await api.post('/integrity/rebuild', { table: 'wh_teams' });
                    serverBlocksResp = await api.get('/integrity/blocks', { params: { table: 'wh_teams' } });
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
                const serverRowsResp = await api.get(`/integrity/blocks/${blockId}/rows`, { params: { table: 'wh_teams' } });
                const serverRows: Array<{ row_id: number; row_hash: string }> = serverRowsResp.data.data || [];
                const serverMapRows = new Map(serverRows.map(r => [r.row_id, r.row_hash]));
                const locals = await this.getTeams();
                const localInBlock = locals.filter(t => Math.floor(t.id / 1024) === blockId);
                const localMap = new Map<number, string>();
                for (const r of localInBlock) localMap.set(r.id, this.hashTeam(r));

                const toFetch: number[] = [];
                for (const [id, lh] of localMap.entries()) if (serverMapRows.get(id) !== lh) toFetch.push(id);
                for (const [id] of serverMapRows.entries()) if (!localMap.has(id)) toFetch.push(id);

                if (toFetch.length) {
                    this.dlog('refetch ids', { blockId, count: toFetch.length });
                    const chunk = 200;
                    for (let i = 0; i < toFetch.length; i += chunk) {
                        const ids = toFetch.slice(i, i + chunk);
                        try {
                            const resp = await api.get('/teams', { params: { ids: ids.join(','), per_page: ids.length, page: 1 } });
                            const rows = (resp.data.data || resp.data.rows) as Team[];
                            if (rows?.length) await this.addTeams(rows);
                        } catch (e) {
                            console.warn('validateTeams: batch fetch failed', e);
                        }
                    }
                }

                // Cleanup: remove local-only rows
                const serverIds = new Set<number>(serverRows.map(r => r.row_id));
                const localIds = new Set<number>(localInBlock.map(l => l.id));
                for (const id of localIds) if (!serverIds.has(id)) await this.deleteTeam(String(id));
            }
            this.dlog('validateTeams finished', { ms: Math.round(performance.now() - t0) });
            this.validating = false;
            return true;
        } catch (error) {
            console.error('validateTeams', error);
            this.validating = false;
            return false;
        }
    }

    private static hashTeam(t: Team): string {
        const row = [
            t.id,
            t.name || '',
            t.description || '',
            t.color || '',
            new Date(t.updated_at).getTime()
        ].join('|');
        return sha256(row).toString(encHex);
    }

    private static async computeLocalBlockHashes() {
        const teams = await this.getTeams();
        const BLOCK_SIZE = 1024;
        const byBlock = new Map<number, Array<{ id: number; hash: string }>>();
        for (const t of teams) {
            const blk = Math.floor(t.id / BLOCK_SIZE);
            if (!byBlock.has(blk)) byBlock.set(blk, []);
            byBlock.get(blk)!.push({ id: t.id, hash: this.hashTeam(t) });
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