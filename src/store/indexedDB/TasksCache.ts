import { auth } from "@/firebase/firebaseConfig";
import { Task } from "../types";
import { DB } from "./DB";
import { api } from "@/store/api/internalApi";
import { TaskEvents } from "@/store/eventEmiters/taskEvents";
import sha256 from "crypto-js/sha256";
import encHex from "crypto-js/enc-hex";
import { applyEncryptionConfig, shouldEncryptStore } from "@/config/encryptionConfig";

export class TasksCache {

    // Use configuration-based encryption setting instead of hardcoded flag
    public static get TASKS_ENCRYPTION_ENABLED(): boolean {
        return shouldEncryptStore('tasks');
    }

    // Toggle to disable encryption specifically for the 'tasks' store
    public static async setEncryptionEnabled(enabled: boolean) {
        const prev = DB.getEncryptionForStore('tasks');
        DB.setEncryptionForStore('tasks', enabled);
        // If we are disabling encryption after it had been enabled, clear old encrypted rows
        if (prev && !enabled) {
            try {
                await DB.clear('tasks');
                this._memTasks = null;
                this._memTasksStamp = 0;
            } catch {}
        }
    }

    public static isEncryptionEnabled(): boolean {
        return DB.getEncryptionForStore('tasks');
    }

    private static initPromise: Promise<boolean> | null = null;
    private static authListener: (() => void) | null = null;
    private static validating = false;
    private static get debug(): boolean {
        return localStorage.getItem('wh-debug-integrity') === 'true';
    }
    private static dlog(...args: any[]) {
        if (this.debug) console.log('[TasksCache]', ...args);
    }

    private static _memTasks: Task[] | null = null;
    private static _memTasksStamp = 0;
    private static readonly MEM_TTL_MS = 10000; // 10s TTL for in-memory decrypted cache

    private static _memSharedTasks: Task[] | null = null;
    private static _memSharedTasksStamp = 0;
    private static _fetchingSharedTasks = false;

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
        // Apply encryption configuration for all stores
        applyEncryptionConfig();
        
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

       return true;
    }

    public static async deleteTask(taskId: string) {
        if (!DB.inited) await DB.init();
        // Delete from whichever store contains the task
        const inTasks = await DB.get('tasks', taskId);
        if (inTasks) {
            await DB.delete('tasks', taskId);
        } else {
            await DB.delete('shared_tasks', taskId);
        }
        this._memTasks = null;
        this._memTasksStamp = 0;
        this._memSharedTasks = null;
        this._memSharedTasksStamp = 0;
        
        // Emit event to refresh table
        TaskEvents.emit(TaskEvents.EVENTS.TASK_DELETED, { id: taskId });
    }

    public static async deleteTasks() {
        if (!DB.inited) await DB.init();
        await DB.clear('tasks');
        this._memTasks = null;
        this._memTasksStamp = 0;
        // Note: shared_tasks are managed separately
        
        // Emit cache invalidate event to refresh table
        TaskEvents.emit(TaskEvents.EVENTS.CACHE_INVALIDATE);
    }

    public static async deleteSharedTasks() {
        if (!DB.inited) await DB.init();
        await DB.clear('shared_tasks');
        this._memSharedTasks = null;
        this._memSharedTasksStamp = 0;
        TaskEvents.emit(TaskEvents.EVENTS.CACHE_INVALIDATE);
    }

    public static async updateTask(id: string, task: Task) {
        if (!DB.inited) await DB.init();
        const idNum = Number(id);
        const normalized: any = { ...task } as any;
        if (normalized.id === undefined || normalized.id === null) {
            normalized.id = Number.isFinite(idNum) ? idNum : id;
        }
        // Determine which store contains the task and update atomically using IndexedDB's upsert behavior
        // DB.put() automatically replaces existing records with the same key, making this operation atomic
        const existingInTasks = await DB.get('tasks', normalized.id);
        const storeName = existingInTasks ? 'tasks' : 'shared_tasks';
        await DB.put(storeName, normalized);
        this._memTasks = null;
        this._memTasksStamp = 0;
        this._memSharedTasks = null;
        this._memSharedTasksStamp = 0;
        
        // Emit event to refresh table
        TaskEvents.emit(TaskEvents.EVENTS.TASK_UPDATED, task);
    }

    public static async addTask(task: Task) {
        if (!DB.inited) await DB.init();
        const normalized: any = { ...task } as any;
        if (normalized.id === undefined || normalized.id === null) {
            // Use Date.now as temporary id if absolutely missing (shouldn't happen for server rows)
            normalized.id = Date.now();
        }
        await DB.put('tasks', normalized);
        this._memTasks = null;
        this._memTasksStamp = 0;
        
        // Emit event to refresh table
        TaskEvents.emit(TaskEvents.EVENTS.TASK_CREATED, task);
    }

    public static async addTasks(tasks: Task[]) {
        if (!DB.inited) await DB.init();
        await DB.bulkPut('tasks', tasks);
        this._memTasks = null;
        this._memTasksStamp = 0;
        
        // Emit bulk update event to refresh table
        TaskEvents.emit(TaskEvents.EVENTS.TASKS_BULK_UPDATE, tasks);
    }

    public static async getTask(taskId: string) {
        if (!DB.inited) await DB.init();
        return (await DB.get('tasks', taskId)) ?? (await DB.get('shared_tasks', taskId));
    }

    public static async getTasks() {
        if (!DB.inited) await DB.init();
        return (await DB.getAll('tasks')).filter(t => t != null);
    }

    public static async getSharedTasks() {
        if (!DB.inited) await DB.init();
        return (await DB.getAll('shared_tasks')).filter(t => t != null);
    }

    public static async getLastUpdated(): Promise<Date> {
        const tasks = await DB.getAll('tasks');
        //we need the most recent updated_at date
        const lastUpdated = tasks.reduce((max, task) => {
            return new Date(task.updated_at) > max ? new Date(task.updated_at) : max;
        }, new Date(0));
        return lastUpdated; 
    }

    //set flag for initialized from local storage
    // Deprecated: lastUpdated/initialized now unnecessary with hashing; always validate on mount
    public static get initialized(): boolean { return true; }
    public static set initialized(_: boolean) { /* no-op */ }
    public static get lastUpdated(): Date { return new Date(0); }
    public static set lastUpdated(_: Date) { /* no-op */ }

    public static async fetchTasks() {
        let allTasks: Task[] = [];
        let currentPage = 1;
        let totalApiCalls = 0;
        
        try {
            let hasNextPage = true;
            // const totalPagesExpected = 0; // unused
            
            // console.log("🚀 Starting to fetch all tasks with pagination...");
            
            // Do NOT clear existing tasks at the start.
            // Clearing triggers UI refresh events and causes the grid to “blink”.
            // We'll replace the store atomically at the end of the fetch.
            
            // Loop through all pages
            while (hasNextPage) {
                totalApiCalls++;
                const apiParams = {
                    page: currentPage,
                    per_page: 500, // Maximum allowed per page
                    sort_by: 'id',
                    sort_direction: 'asc'
                };
                // console.log(`📡 API Call #${totalApiCalls} - Fetching tasks page ${currentPage}...`);
                // console.log(`🔗 API URL: GET /api/tasks?${new URLSearchParams({
                //     page: currentPage.toString(),
                //     per_page: '500',
                //     sort_by: 'id',
                //     sort_direction: 'asc'
                // }).toString()}`);
                
                const response = await api.get("/tasks", {
                    params: apiParams
                });
                
                // Handle the new API response structure
                const pageData = response.data.data as Task[];
                const pagination = response.data.pagination;
                
                // Debug pagination info
                // console.log(`📊 Pagination Info for Page ${currentPage}:`, {
                //     current_page: pagination?.current_page,
                //     per_page: pagination?.per_page,
                //     total: pagination?.total,
                //     last_page: pagination?.last_page,
                //     from: pagination?.from,
                //     to: pagination?.to,
                //     has_next_page: pagination?.has_next_page,
                //     next_page: pagination?.next_page,
                //     tasks_in_response: pageData?.length || 0
                // });
                
                // Set expected total pages from first response
                // if (currentPage === 1 && pagination?.last_page) {
                //     const totalPagesExpected = pagination.last_page;
                //     console.log(`📈 Expected total pages: ${totalPagesExpected}, Expected total tasks: ${pagination.total}`);
                // }
                
                if (pageData && pageData.length > 0) {
                    // keep position; avoid unused var
                    
                    // Get ID range for this page
                    // const pageIds = pageData.map(task => task.id);
                    // const minId = Math.min(...pageIds);
                    // const maxId = Math.max(...pageIds);
                    
                    // console.log(`📋 Page ${currentPage} ID range: ${minId} to ${maxId}`);
                    
                    // DEDUPLICATION: Only add tasks that we don't already have
                    const existingIds = new Set(allTasks.map(task => task.id));
                    const newTasks = pageData.filter(task => !existingIds.has(task.id));
                    const duplicatesSkipped = pageData.length - newTasks.length;
                    
                    if (duplicatesSkipped > 0) {
                        console.warn(`⚠️  Page ${currentPage}: Skipped ${duplicatesSkipped} duplicate tasks (backend pagination issue)`);
                    }
                    
                    allTasks = [...allTasks, ...newTasks];
                     console.log(`✅ Page ${currentPage}: fetched ${pageData.length} tasks, added ${newTasks.length} new tasks (total unique: ${allTasks.length})`);
                } else {
                        console.warn(`⚠️  Page ${currentPage}: No tasks returned or empty response`);
                }
                
                // Check if there's a next page
                hasNextPage = pagination?.has_next_page || false;
                if (hasNextPage) {
                    currentPage = pagination.next_page || currentPage + 1;
                    // console.log(`➡️  Moving to next page: ${currentPage}`);
                } else {
                    //  console.log(`🏁 Completed fetching all tasks!`);
                    // console.log(`📊 Final Summary:`);
                    // console.log(`   - Total API calls made: ${totalApiCalls}`);
                    // console.log(`   - Expected pages: ${totalPagesExpected}`);
                    // console.log(`   - Last page processed: ${currentPage}`);
                    // console.log(`   - Unique tasks collected: ${allTasks.length}`);
                    // console.log(`   - Expected total (from API): ${pagination?.total || 'unknown'}`);
                    
                    if (pagination?.total && allTasks.length < pagination.total) {
                        const expectedDuplicates = pagination.total - allTasks.length;
                        console.warn(`⚠️  Backend pagination issue: Expected ${pagination.total} tasks, got ${allTasks.length} unique tasks`);
                        console.warn(`⚠️  This suggests ${expectedDuplicates} duplicates were filtered out due to overlapping pagination`);
                        console.warn(`💡 Recommendation: Fix backend pagination to return sequential, non-overlapping pages`);
                    } else if (allTasks.length === pagination?.total) {
                        console.log(`✅ Perfect! All tasks fetched with no duplicates`);
                    }
                }
            }
            
            // Replace the tasks store once (single refresh)
            await DB.clear('tasks');
            this._memTasks = null;
            this._memTasksStamp = 0;

            if (allTasks.length > 0) {
                await DB.bulkPut('tasks', allTasks as any[]);
                TaskEvents.emit(TaskEvents.EVENTS.TASKS_BULK_UPDATE, allTasks);
            } else {
                // Ensure stale tasks disappear if server returns none
                TaskEvents.emit(TaskEvents.EVENTS.CACHE_INVALIDATE);
            }
            
            return true;
        } catch (error) {
            console.error("❌ fetchTasks error:", error);
            console.error("Error details:", {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                currentPage,
                totalTasksCollected: allTasks?.length || 0
            });
            return false;
        }
    }

    public static async fetchSharedTasks() {
        let allTasks: Task[] = [];
        let currentPage = 1;
        let totalApiCalls = 0;

        try {
            let hasNextPage = true;

            // Do NOT clear at start to avoid UI blinking; replace at end.

            while (hasNextPage) {
                totalApiCalls++;
                const apiParams = {
                    page: currentPage,
                    per_page: 500,
                    sort_by: 'id',
                    sort_direction: 'asc',
                    shared_with_me: 1,
                };

                const response = await api.get('/tasks', { params: apiParams });
                const pageData = response.data.data as Task[];
                const pagination = response.data.pagination;

                if (pageData && pageData.length > 0) {
                    const existingIds = new Set(allTasks.map(task => task.id));
                    const newTasks = pageData.filter(task => !existingIds.has(task.id));
                    allTasks = [...allTasks, ...newTasks];
                }

                hasNextPage = pagination?.has_next_page || false;
                currentPage = pagination?.next_page || currentPage + 1;
                if (!hasNextPage) break;
            }

            if (allTasks.length > 0) {
                await DB.clear('shared_tasks');
                await DB.bulkPut('shared_tasks', allTasks as any[]);
                // Populate memory cache immediately to prevent repeated queries
                this._memSharedTasks = allTasks;
                this._memSharedTasksStamp = Date.now();
                // Emit event to refresh grid - event handler will check workspaceId
                TaskEvents.emit(TaskEvents.EVENTS.TASKS_BULK_UPDATE, allTasks);
            } else {
                await DB.clear('shared_tasks');
                // Set empty array in memory cache to prevent repeated fetches
                this._memSharedTasks = [];
                this._memSharedTasksStamp = Date.now();
                // Emit event with empty array - event handler will check workspaceId
                TaskEvents.emit(TaskEvents.EVENTS.TASKS_BULK_UPDATE, []);
            }

            return true;
        } catch (error) {
            console.error('❌ fetchSharedTasks error:', error, { currentPage, totalApiCalls });
            return false;
        }
    }

    public static async validateTasks(serverGlobalHash?: string | null, serverBlockCount?: number | null) {
        // Tasks are now visibility-scoped (workspace access / shares), so comparing against global table hashes
        // will cause false mismatches. Skip integrity validation for tasks by default.
        const integrityEnabled = typeof localStorage !== 'undefined' && localStorage.getItem('wh-enable-task-integrity') === 'true';
        if (!integrityEnabled) {
            // Still ensure we bootstrap the tasks cache when empty, otherwise users see no tasks after DB resets.
            try {
                const existingTasks = await this.getTasks();
                if (existingTasks.length === 0) {
                    return await this.fetchTasks();
                }
            } catch (e) {
                console.warn('[TasksCache] validateTasks bootstrap (integrity disabled) failed:', e);
            }
            return true;
        }
        try {
            if (this.validating) {
                this.dlog('validateTasks: already running, skipping re-entry');
                return true;
            }
            this.validating = true;
            const t0 = performance.now();
            
            // Bootstrap: If cache is empty, fetch tasks once before integrity validation
            const existingTasks = await this.getTasks();
            console.log(`[TasksCache] validateTasks: existingTasks count=${existingTasks.length}`);
            
            if (existingTasks.length === 0) {
                this.dlog('validateTasks: cache empty, bootstrap fetching tasks');
                try {
                    const fetchSuccess = await this.fetchTasks();
                    if (fetchSuccess) {
                        this.dlog('validateTasks: bootstrap fetch completed');
                        // After bootstrap, continue with integrity validation to verify
                        // (or return early if you prefer to skip validation on first sync)
                    } else {
                        this.dlog('validateTasks: bootstrap fetch failed, continuing with validation');
                    }
                } catch (e) {
                    console.warn('TasksCache: bootstrap fetch error', e);
                    // Continue with validation even if bootstrap fails
                }
            } else {
                console.log('[TasksCache] validateTasks: cache not empty, skipping bootstrap fetch');
            }
            
            // 0) Quick global-hash short-circuit (use batch result if provided, otherwise fetch)
            const localBlocks = await this.computeLocalTaskBlockHashes();
            const localGlobalConcat = localBlocks.map(b => b.block_hash).join('');
            const localGlobalHash = sha256(localGlobalConcat).toString(encHex);
            
            let serverGlobal: string | undefined = serverGlobalHash ?? undefined;
            let serverBlockCountFromServer: number | null = serverBlockCount ?? null;
            
            // Only make API call if batch result wasn't provided
            if (serverGlobalHash === undefined) {
                try {
                    const globalResp = await api.get('/integrity/global', { params: { table: 'wh_tasks' } });
                    serverGlobal = globalResp.data?.data?.global_hash;
                    serverBlockCountFromServer = globalResp.data?.data?.block_count ?? null;
                } catch (_) {
                    // ignore and continue with block-level comparison
                }
            }
            
            if (serverGlobal) {
                this.dlog('global compare', { localBlocks: localBlocks.length, serverBlockCount: serverBlockCountFromServer, equal: serverGlobal === localGlobalHash });
                if (serverGlobal === localGlobalHash && (serverBlockCountFromServer === null || serverBlockCountFromServer === localBlocks.length)) {
                    this.dlog('global hash match; skipping block compare');
                    this.validating = false;
                    // Perfect match – nothing to do
                    return true;
                }
            }

            // 1) Integrity blocks comparison (cheap): compare local block hashes vs server
            let serverBlocksResp = await api.get('/integrity/blocks', { params: { table: 'wh_tasks' } });
            let serverBlocks: Array<{ block_id: number; block_hash: string; min_row_id: number; max_row_id: number; row_count: number }> = serverBlocksResp.data.data || [];

            // If server has no hashes yet, trigger a rebuild once and retry
            if (serverBlocks.length === 0 && localBlocks.length > 0) {
                try {
                    await api.post('/integrity/rebuild', { table: 'wh_tasks' });
                    serverBlocksResp = await api.get('/integrity/blocks', { params: { table: 'wh_tasks' } });
                    serverBlocks = serverBlocksResp.data.data || [];
                    if (serverBlocks.length === 0) { this.validating = false; return true; } // nothing to compare, avoid refetching all
                } catch (_) {
                    this.validating = false; return true; // avoid heavy refetch
                }
            }

            const serverMap = new Map(serverBlocks.map(b => [b.block_id, b]));
            const mismatchedBlocks: number[] = [];
            for (const lb of localBlocks) {
                const sb = serverMap.get(lb.block_id);
                if (!sb || sb.block_hash !== lb.block_hash || sb.row_count !== lb.row_count) {
                    this.dlog('mismatch block', { block: lb.block_id, reason: !sb ? 'missing' : (sb.block_hash !== lb.block_hash ? 'hash' : 'count') });
                    mismatchedBlocks.push(lb.block_id);
                }
            }
            // Also consider server blocks we don't have locally
            for (const sb of serverBlocks) {
                if (!localBlocks.find(b => b.block_id === sb.block_id)) {
                    mismatchedBlocks.push(sb.block_id);
                }
            }

            if (mismatchedBlocks.length === 0) {
                this.dlog('blocks equal; finishing', { ms: Math.round(performance.now() - t0) });
                this.validating = false;
                console.log('validateTasks: hashes match. No changes needed.');
                return true;
            }

            // 2) For mismatched blocks, fetch server row hashes and refetch rows that differ
            for (const blockId of Array.from(new Set(mismatchedBlocks))) {
                const serverRowsResp = await api.get(`/integrity/blocks/${blockId}/rows`, { params: { table: 'wh_tasks' } });
                const serverRows: Array<{ row_id: number; row_hash: string }> = serverRowsResp.data.data || [];
                const serverRowMap = new Map(serverRows.map(r => [r.row_id, r.row_hash]));

                // Build local row hash map for this block
                const localRowsInBlock = await this.getTasksInBlock(blockId);
                const localRowMap = new Map<number, string>();
                for (const r of localRowsInBlock) {
                    localRowMap.set(r.id, this.hashTask(r));
                }

                const toRefetch: number[] = [];
                // Rows present locally: compare
                for (const [rowId, localHash] of localRowMap.entries()) {
                    const sh = serverRowMap.get(rowId);
                    if (!sh || sh !== localHash) toRefetch.push(rowId);
                }
                // Rows present on server but not locally
                for (const [rowId] of serverRowMap.entries()) {
                    if (!localRowMap.has(rowId)) toRefetch.push(rowId);
                }

                if (toRefetch.length > 0) {
                    this.dlog('refetch ids', { blockId, count: toRefetch.length });
                    const chunk = 200;
                    for (let i = 0; i < toRefetch.length; i += chunk) {
                        const ids = toRefetch.slice(i, i + chunk);
                        try {
                            const resp = await api.get('/tasks', { params: { ids: ids.join(','), per_page: ids.length, page: 1 } });
                            const rows = (resp.data.data || resp.data.rows) as Task[];
                            if (rows?.length) {
                                // Attach server-provided row hash so subsequent local hashing can short-circuit
                                const rowsWithHash = rows.map(r => {
                                    const h = serverRowMap.get(r.id);
                                    return h ? { ...(r as any), __h: h } : r;
                                });
                                await this.addTasks(rowsWithHash as unknown as Task[]);
                            }
                        } catch (e) {
                            console.warn('validateTasks: batch fetch failed', e);
                        }
                    }
                }

                // Cleanup: delete local tasks not present in server block rows
                const serverIds = new Set<number>(serverRows.map(r => r.row_id));
                for (const localId of Array.from(localRowMap.keys())) {
                    if (!serverIds.has(localId)) {
                        await this.deleteTask(String(localId));
                    }
                }
            }

            // Refresh watermark
            this.lastUpdated = await this.getLastUpdated();
            this.dlog('validateTasks finished', { ms: Math.round(performance.now() - t0) });
            this.validating = false;
            return true;
        } catch (error) {
            console.error('validateTasks', error);
            this.validating = false;
            return false;
        }
    }

    // --- Integrity helpers ---
    private static hashTask(task: Task): string {
        // Prefer server-provided hash when available (attached during validation)
        if ((task as any) && typeof (task as any).__h === 'string' && (task as any).__h.length) {
            return (task as any).__h as string;
        }

        // Match backend canonicalization exactly (must mirror wh_tasks hash trigger SQL)

        // Normalize all numeric fields to ensure type consistency with backend (which uses direct values)
        // Backend hash trigger order: id, name, description, workspace_id, category_id, team_id, template_id, spot_id, status_id, priority_id, approval_id, dates, durations, updated_at
        const row = [
            Number(task.id) || 0,
            (task as any).name || '',
            (task as any).description || '',
            Number((task as any).workspace_id) || 0,
            Number((task as any).category_id) || 0,
            Number((task as any).team_id) || 0,
            Number((task as any).template_id) || 0,
            Number((task as any).spot_id) || 0,
            Number((task as any).status_id) || 0, // Ensure number for hash consistency
            Number((task as any).priority_id) || 0, // Ensure number for hash consistency
            Number((task as any).approval_id) || 0,
            // Timestamps normalized to UTC epoch ms (empty string when falsy)
            this.toUtcEpochMs((task as any).start_date),
            this.toUtcEpochMs((task as any).due_date),
            Number((task as any).expected_duration) || 0,
            this.toUtcEpochMs((task as any).response_date),
            this.toUtcEpochMs((task as any).resolution_date),
            Number((task as any).work_duration) || 0,
            Number((task as any).pause_duration) || 0,
            this.toUtcEpochMs((task as any).updated_at)
        ].join('|');
        return sha256(row).toString(encHex);
    }

    // Normalize various timestamp inputs to UTC epoch ms string to match backend hashing
    private static toUtcEpochMs(value: any): string {
        if (!value) return '';
        let vStr = String(value);
        // If it looks like 'YYYY-MM-DD HH:mm:ss(.sss)?' without timezone, assume UTC
        if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(vStr) && !/[zZ]|[+\-]\d{2}:?\d{2}$/.test(vStr)) {
            vStr = vStr.replace(' ', 'T') + 'Z';
        }
        const dt = new Date(vStr);
        const t = dt.getTime();
        return Number.isFinite(t) ? String(t) : '';
    }

    private static async computeLocalTaskBlockHashes() {
        const tasks = (await this.getTasks()).filter(t => t && Number.isFinite(Number(t.id)));
        const BLOCK_SIZE = 1024;
        const byBlock = new Map<number, Array<{ id: number; hash: string }>>();
        for (const t of tasks) {
            const blk = Math.floor(t.id / BLOCK_SIZE);
            if (!byBlock.has(blk)) byBlock.set(blk, []);
            byBlock.get(blk)!.push({ id: t.id, hash: this.hashTask(t) });
        }
        const blocks: Array<{ block_id: number; min_row_id: number; max_row_id: number; row_count: number; block_hash: string }> = [];
        for (const [blk, arr] of byBlock.entries()) {
            arr.sort((a,b) => a.id - b.id);
            const concat = arr.map(x => x.hash).join('');
            const hash = sha256(concat).toString(encHex);
            blocks.push({ block_id: blk, min_row_id: arr[0].id, max_row_id: arr[arr.length-1].id, row_count: arr.length, block_hash: hash });
        }
        blocks.sort((a,b) => a.block_id - b.block_id);
        return blocks;
    }

    private static async getTasksInBlock(blockId: number) {
        const BLOCK_SIZE = 1024;
        const minId = blockId * BLOCK_SIZE;
        const maxId = minId + BLOCK_SIZE - 1;
        const tasks = await this.getTasks();
        return tasks.filter(t => t.id >= minId && t.id <= maxId);
    }

    // Exposed for hashing self-tests
    public static computeHashForTest(task: Task): string {
        return this.hashTask(task);
    }

    /**
     * Query tasks from local cache with filtering, sorting, and pagination
     * This replicates the backend getTasks functionality locally
     */
    public static async queryTasks(params: any = {}) {
        try {
            if (!DB.inited) await DB.init();
            
            const sharedWithMe = !!params.shared_with_me;

            // Get tasks from the appropriate store (tasks vs shared_tasks)
            let tasks: Task[];
            const now = Date.now();
            if (sharedWithMe) {
                if (this._memSharedTasks && (now - this._memSharedTasksStamp) < this.MEM_TTL_MS) {
                    tasks = this._memSharedTasks;
                    if (localStorage.getItem('wh-debug-shared') === 'true') {
                        console.log('[TasksCache] Using cached shared tasks from memory:', tasks.length);
                    }
                } else {
                    tasks = await this.getSharedTasks();
                    if (localStorage.getItem('wh-debug-shared') === 'true') {
                        console.log('[TasksCache] Loaded shared tasks from DB:', tasks.length, 'tasks');
                    }
                    // Bootstrap fetch if empty - fire and forget to avoid blocking the UI
                    // Only fetch if cache is truly empty AND we're not already fetching
                    if (tasks.length === 0 && !this._fetchingSharedTasks) {
                        // Prevent multiple simultaneous fetches
                        this._fetchingSharedTasks = true;
                        // Trigger fetch in background without blocking
                        this.fetchSharedTasks()
                            .catch(err => {
                                console.error('Background fetchSharedTasks failed:', err);
                            })
                            .finally(() => {
                                this._fetchingSharedTasks = false;
                            });
                        // Return empty results immediately - grid will refresh when fetch completes
                    }
                    // Always update memory cache with current results (even if empty)
                    // This prevents repeated fetches when refreshGrid is called multiple times
                    this._memSharedTasks = tasks;
                    this._memSharedTasksStamp = now;
                }
            } else {
                if (this._memTasks && (now - this._memTasksStamp) < this.MEM_TTL_MS) {
                    tasks = this._memTasks;
                } else {
                    tasks = await this.getTasks();
                    this._memTasks = tasks;
                    this._memTasksStamp = now;
                }
            }

            // Optional lookup for tag filters/search
            const taskTagsParam: Array<{ task_id: number; tag_id: number }> = params.__taskTags || [];
            let taskTagMapCache: Record<number, number[]> | null = null;
            const getTaskTagMap = () => {
                if (taskTagMapCache) return taskTagMapCache;
                const m: Record<number, number[]> = {};
                for (const tt of taskTagsParam) {
                    const taskId = Number((tt as any).task_id);
                    const tagId = Number((tt as any).tag_id);
                    if (!Number.isFinite(taskId) || !Number.isFinite(tagId)) continue;
                    if (!m[taskId]) m[taskId] = [];
                    m[taskId].push(tagId);
                }
                taskTagMapCache = m;
                return m;
            };

            // Check if filterModel is present - if so, skip simple filters for columns that are in filterModel
            const hasFilterModel = params.filterModel && typeof params.filterModel === 'object' && Object.keys(params.filterModel).length > 0;
            const filterModelKeys = hasFilterModel ? new Set(Object.keys(params.filterModel)) : new Set();
            
            // Apply simple parameter filters (skip if column is in filterModel, as filterModel will handle it)
            // Skip workspace_id filter when viewing shared tasks, as shared tasks can come from any workspace
            if (params.workspace_id && !sharedWithMe) {
                const wsId = typeof params.workspace_id === 'string' ? parseInt(params.workspace_id, 10) : Number(params.workspace_id);
                if (Number.isFinite(wsId)) {
                    const beforeCount = tasks.length;
                    tasks = tasks.filter(task => {
                        const taskWsId = typeof task.workspace_id === 'string' ? parseInt(task.workspace_id, 10) : Number(task.workspace_id);
                        return Number.isFinite(taskWsId) && taskWsId === wsId;
                    });
                    if (localStorage.getItem('wh-debug-shared') === 'true') {
                        console.log('[TasksCache] Filtered by workspace_id:', beforeCount, '->', tasks.length);
                    }
                }
            } else if (sharedWithMe && params.workspace_id) {
                // Log warning if workspace_id is set when viewing shared tasks (shouldn't happen)
                if (localStorage.getItem('wh-debug-shared') === 'true') {
                    console.warn('[TasksCache] WARNING: workspace_id filter ignored for shared tasks. workspace_id:', params.workspace_id);
                }
            }
            if (params.status_id && !filterModelKeys.has('status_id')) {
                tasks = tasks.filter(task => task.status_id === parseInt(params.status_id));
            }
            if (params.priority_id && !filterModelKeys.has('priority_id')) {
                tasks = tasks.filter(task => task.priority_id === parseInt(params.priority_id));
            }
            if (params.team_id) {
                tasks = tasks.filter(task => task.team_id === parseInt(params.team_id));
            }
            if (params.template_id) {
                tasks = tasks.filter(task => task.template_id === parseInt(params.template_id));
            }
            if (params.spot_id && !filterModelKeys.has('spot_id')) {
                tasks = tasks.filter(task => task.spot_id === parseInt(params.spot_id));
            }
            if (params.category_id) {
                tasks = tasks.filter(task => task.category_id === parseInt(params.category_id));
            }

            // Apply search filter: includes ID, status/priority/spot names, responsible user names, and tags
            if (params.search) {
                const searchTerm = String(params.search).toLowerCase();

                // Optional lookup maps provided by caller for richer search
                const statusMap: Record<number, { name?: string }> = params.__statusMap || {};
                const priorityMap: Record<number, { name?: string }> = params.__priorityMap || {};
                const spotMap: Record<number, { name?: string }> = params.__spotMap || {};
                const userMap: Record<number, { name?: string; email?: string }> = params.__userMap || {};
                const tagMap: Record<number, { name?: string }> = params.__tagMap || {};
                const taskTagMap: Record<number, number[]> = getTaskTagMap();

                const matches = (t: Task): boolean => {
                    // ID
                    if (String(t.id).includes(searchTerm)) return true;

                    // Name / description
                    if (t.name && t.name.toLowerCase().includes(searchTerm)) return true;
                    if (t.description && t.description.toLowerCase().includes(searchTerm)) return true;

                    // Status name
                    const st = statusMap[t.status_id];
                    if (st?.name && st.name.toLowerCase().includes(searchTerm)) return true;

                    // Priority name
                    const pr = priorityMap[t.priority_id];
                    if (pr?.name && pr.name.toLowerCase().includes(searchTerm)) return true;

                    // Spot/location name
                    if (t.spot_id != null) {
                        const sp = spotMap[t.spot_id as number];
                        if (sp?.name && sp.name.toLowerCase().includes(searchTerm)) return true;
                    }

                    // Responsible user names
                    if (Array.isArray(t.user_ids) && t.user_ids.length > 0) {
                        for (const uid of t.user_ids) {
                            const u = userMap[uid];
                            const uname = u?.name || u?.email;
                            if (uname && uname.toLowerCase().includes(searchTerm)) return true;
                        }
                    }

                    // Tags
                    const tagIds = taskTagMap[t.id];
                    if (tagIds && tagIds.length > 0) {
                        for (const tagId of tagIds) {
                            const tag = tagMap[tagId];
                            if (tag?.name && tag.name.toLowerCase().includes(searchTerm)) return true;
                        }
                    }

                    return false;
                };

                tasks = tasks.filter(matches);
            }

            // Apply date filters
            if (params.date_from) {
                const dateFrom = new Date(params.date_from);
                tasks = tasks.filter(task => new Date(task.created_at) >= dateFrom);
            }
            if (params.date_to) {
                const dateTo = new Date(params.date_to);
                tasks = tasks.filter(task => new Date(task.created_at) <= dateTo);
            }
            if (params.updated_after) {
                const updatedAfter = new Date(params.updated_after);
                tasks = tasks.filter(task => new Date(task.updated_at) > updatedAfter);
            }

            // Apply complex filterModel
            if (params.filterModel && typeof params.filterModel === 'object') {
                if ((params.filterModel as any).tag_ids && taskTagsParam && taskTagsParam.length > 0) {
                    const map = getTaskTagMap();
                    tasks = tasks.map((t: Task) => {
                        const tagIds = map[t.id] || [];
                        return { ...t, tag_ids: tagIds };
                    });
                }
                tasks = this.applyFilterModel(tasks, params.filterModel);
            }

            // Apply sorting
            if (params.sortModel && Array.isArray(params.sortModel)) {
                tasks = this.applySorting(tasks, params.sortModel);
            } else if (params.sort_by) {
                // Simple sorting for API endpoints
                const sortBy = params.sort_by;
                const sortDirection = params.sort_direction || 'desc';
                tasks = this.applySorting(tasks, [{ colId: sortBy, sort: sortDirection }]);
            } else {
                // Default sorting: created_at desc (latest first) with id desc as stable tiebreaker
                tasks = this.applySorting(tasks, [
                    { colId: 'created_at', sort: 'desc' },
                    { colId: 'id', sort: 'desc' }
                ]);
            }

            // Handle pagination
            if (params.per_page && params.page) {
                // API-style pagination
                const perPage = parseInt(params.per_page) || 15;
                const page = parseInt(params.page) || 1;
                const startIndex = (page - 1) * perPage;
                const endIndex = startIndex + perPage;
                
                return {
                    data: tasks.slice(startIndex, endIndex),
                    current_page: page,
                    per_page: perPage,
                    total: tasks.length,
                    last_page: Math.ceil(tasks.length / perPage),
                    from: startIndex + 1,
                    to: Math.min(endIndex, tasks.length)
                };
            } else if (params.startRow !== undefined && params.endRow !== undefined) {
                // AG Grid-style pagination
                const startRow = parseInt(params.startRow);
                const endRow = parseInt(params.endRow);
                // const pageSize = endRow - startRow; // retained for clarity
                
                if (localStorage.getItem('wh-debug-shared') === 'true' && sharedWithMe) {
                    console.log('[TasksCache] Returning shared tasks:', {
                        total: tasks.length,
                        startRow,
                        endRow,
                        returning: tasks.slice(startRow, endRow).length,
                        workspace_id_filter: params.workspace_id,
                        shared_with_me: sharedWithMe
                    });
                }
                
                return {
                    rows: tasks.slice(startRow, endRow),
                    rowCount: tasks.length
                };
            } else {
                // Return all tasks
                if (localStorage.getItem('wh-debug-shared') === 'true' && sharedWithMe) {
                    console.log('[TasksCache] Returning all shared tasks:', {
                        total: tasks.length,
                        workspace_id_filter: params.workspace_id,
                        shared_with_me: sharedWithMe
                    });
                }
                
                return {
                    rows: tasks,
                    rowCount: tasks.length
                };
            }
        } catch (error) {
            console.error("queryTasks", error);
            throw error;
        }
    }

    /**
     * Apply complex filterModel to tasks array
     */
    private static applyFilterModel(tasks: Task[], filterModel: any): Task[] {
        // Debug logging if enabled
        const debugFilters = typeof localStorage !== 'undefined' && localStorage.getItem('wh-debug-filters') === 'true';
        if (debugFilters) {
            console.log('[TasksCache] applyFilterModel - filterModel:', JSON.stringify(filterModel, null, 2));
            console.log('[TasksCache] applyFilterModel - tasks before filter:', tasks.length);
            
            // Log sample of task priority_ids if filtering by priority
            if (filterModel.priority_id) {
                const samplePriorities = tasks.slice(0, 10).map(t => ({ id: t.id, priority_id: t.priority_id }));
                console.log('[TasksCache] applyFilterModel - sample task priority_ids:', samplePriorities);
                const allPriorities = [...new Set(tasks.map(t => t.priority_id).filter(p => p != null))];
                console.log('[TasksCache] applyFilterModel - all unique priority_ids in tasks:', allPriorities);
            }
        }
        
        const filtered = tasks.filter(task => {
            for (const [column, filterDetails] of Object.entries(filterModel)) {
                const matches = this.taskMatchesFilter(task, column, filterDetails as any);
                if (debugFilters && column === 'priority_id') {
                    console.log(`[TasksCache] task ${task.id} priority_id=${task.priority_id} (type: ${typeof task.priority_id}), filter=${JSON.stringify(filterDetails)}, matches=${matches}`);
                }
                if (!matches) {
                    return false;
                }
            }
            return true;
        });
        
        if (debugFilters) {
            console.log('[TasksCache] applyFilterModel - tasks after filter:', filtered.length);
        }
        if (filtered.length === 0 && tasks.length > 0) {
            console.warn('[TasksCache] applyFilterModel - WARNING: Filter resulted in 0 tasks but had', tasks.length, 'tasks before filtering');
        }
        
        return filtered;
    }

    /**
     * Check if a task matches a specific filter
     */
    private static taskMatchesFilter(task: Task, column: string, filterDetails: any): boolean {
        const taskValue = (task as any)[column];
        
        // Handle complex filters with operator and conditions
        if (filterDetails.operator && filterDetails.conditions && Array.isArray(filterDetails.conditions)) {
            const operator = filterDetails.operator.toUpperCase();
            const results = filterDetails.conditions.map((condition: any) => 
                this.evaluateCondition(taskValue, condition)
            );
            
            return operator === 'OR' ? results.some((r: boolean) => r) : results.every((r: boolean) => r);
        } else {
            // Simple filter (single condition)
            return this.evaluateCondition(taskValue, filterDetails);
        }
    }

    /**
     * Evaluate a single filter condition
     */
    private static evaluateCondition(value: any, condition: any): boolean {
        const { filterType, type, filter, filterTo, dateFrom, dateTo, values } = condition;

        // Handle set filter (AG Grid Set Filter)
        if (filterType === 'set') {
            const selected = Array.isArray(values) ? values : [];
            if (selected.length === 0) return true;
            
            // Handle null/undefined values explicitly
            if (value === null || value === undefined) {
                // Check if null/undefined is explicitly in the selected values
                return selected.includes(null) || selected.includes(undefined) || selected.includes('null') || selected.includes('undefined');
            }
            
            // Normalize selected values to both numeric and string sets for robust matching
            const normalizedSelectedNums = selected.map((v: any) => {
                if (v === null || v === undefined) return null;
                const n = Number(v);
                return Number.isFinite(n) ? n : null;
            }).filter((n: any) => n !== null);
            const normalizedSelectedStrs = selected.map((v: any) => {
                if (v === null) return 'null';
                if (v === undefined) return 'undefined';
                return String(v);
            });

            // If the task value is an array (e.g., multiple owners), match if any entry is selected
            if (Array.isArray(value)) {
                for (const v of value) {
                    const vNum = Number(v);
                    if (Number.isFinite(vNum) && normalizedSelectedNums.length > 0 && normalizedSelectedNums.includes(vNum)) {
                        return true;
                    }
                    const vStr = v === null ? 'null' : v === undefined ? 'undefined' : String(v);
                    if (normalizedSelectedStrs.includes(vStr)) {
                        return true;
                    }
                }
                return false;
            }

            // Try numeric comparison first (most reliable for IDs)
            const asNum = Number(value);
            if (Number.isFinite(asNum) && normalizedSelectedNums.length > 0) {
                const numericMatch = normalizedSelectedNums.includes(asNum);
                if (numericMatch) return true;
            }
            
            // Fallback to string compare (handles string IDs and edge cases)
            const valueStr = value === null ? 'null' : value === undefined ? 'undefined' : String(value);
            return normalizedSelectedStrs.includes(valueStr);
        }
        
        if (type === 'inRange') {
            if (filterType === 'number') {
                const numValue = parseFloat(value);
                const min = parseFloat(filter);
                const max = parseFloat(filterTo);
                return numValue >= min && numValue <= max;
            } else if (filterType === 'date') {
                const dateValue = new Date(value);
                const minDate = new Date(dateFrom);
                const maxDate = new Date(dateTo);
                return dateValue >= minDate && dateValue <= maxDate;
            }
        }
        
        if (filterType === 'text') {
            const textValue = (value || '').toString().toLowerCase();
            const filterValue = (filter || '').toString().toLowerCase();
            
            switch (type) {
                case 'contains': return textValue.includes(filterValue);
                case 'notContains': return !textValue.includes(filterValue);
                case 'equals': return textValue === filterValue;
                case 'notEqual': return textValue !== filterValue;
                case 'startsWith': return textValue.startsWith(filterValue);
                case 'endsWith': return textValue.endsWith(filterValue);
                case 'blank': return !value || value.toString().trim() === '';
                case 'notBlank': return value && value.toString().trim() !== '';
                default: return true;
            }
        } else if (filterType === 'number') {
            const numValue = parseFloat(value);
            const filterNum = parseFloat(filter);
            
            switch (type) {
                case 'equals': return numValue === filterNum;
                case 'notEqual': return numValue !== filterNum;
                case 'lessThan': return numValue < filterNum;
                case 'lessThanOrEqual': return numValue <= filterNum;
                case 'greaterThan': return numValue > filterNum;
                case 'greaterThanOrEqual': return numValue >= filterNum;
                default: return true;
            }
        } else if (filterType === 'date') {
            const dateValue = new Date(value);
            const filterDate = new Date(filter);
            
            switch (type) {
                case 'equals':
                case 'dateIs': 
                    return dateValue.toDateString() === filterDate.toDateString();
                case 'notEqual':
                case 'dateIsNot': 
                    return dateValue.toDateString() !== filterDate.toDateString();
                case 'lessThan':
                case 'dateBefore': 
                    return dateValue < filterDate;
                case 'greaterThan':
                case 'dateAfter': 
                    return dateValue > filterDate;
                default: return true;
            }
        }
        
        return true;
    }

    /**
     * Apply sorting to tasks array
     */
    private static applySorting(tasks: Task[], sortModel: Array<{ colId: string; sort: string }>): Task[] {
        if (!sortModel || sortModel.length === 0) {
            return tasks;
        }
        
        return tasks.sort((a, b) => {
            for (const sort of sortModel) {
                const { colId, sort: direction } = sort;
                const aValue = (a as any)[colId];
                const bValue = (b as any)[colId];
                
                let comparison = 0;
                
                // Handle different data types
                if (aValue === null || aValue === undefined) {
                    comparison = bValue === null || bValue === undefined ? 0 : -1;
                } else if (bValue === null || bValue === undefined) {
                    comparison = 1;
                } else {
                    // Check if this is a date field (ends with _at or _date) or is a date string
                    const isDateField = colId.endsWith('_at') || colId.endsWith('_date') || 
                                       (typeof aValue === 'string' && !isNaN(Date.parse(aValue)) && !isNaN(Date.parse(bValue)));
                    
                    if (isDateField) {
                        // Convert to Date objects for proper comparison
                        const aDate = new Date(aValue);
                        const bDate = new Date(bValue);
                        const aTime = aDate.getTime();
                        const bTime = bDate.getTime();
                        
                        // Check for invalid dates
                        if (isNaN(aTime) || isNaN(bTime)) {
                            // Fallback to string comparison if dates are invalid
                            comparison = String(aValue).localeCompare(String(bValue));
                        } else {
                            comparison = aTime - bTime;
                        }
                    } else if (typeof aValue === 'string' && typeof bValue === 'string') {
                        comparison = aValue.localeCompare(bValue);
                    } else if (aValue instanceof Date || bValue instanceof Date) {
                        const aDate = new Date(aValue);
                        const bDate = new Date(bValue);
                        comparison = aDate.getTime() - bDate.getTime();
                    } else {
                        comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
                    }
                }
                
                if (comparison !== 0) {
                    // For desc: newer dates (larger timestamps) should come first
                    // If comparison > 0, a is newer than b, so for desc we want a first (return negative)
                    return direction === 'desc' ? -comparison : comparison;
                }
            }
            return 0;
        });
    }


} 