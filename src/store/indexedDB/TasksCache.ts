import { auth } from "@/firebase/firebaseConfig";
import { Task } from "../types";
import { DB } from "./DB";
import api from "@/api/whagonsApi";
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
        await DB.delete('tasks', taskId);
        this._memTasks = null;
        this._memTasksStamp = 0;
        
        // Emit event to refresh table
        TaskEvents.emit(TaskEvents.EVENTS.TASK_DELETED, { id: taskId });
    }

    public static async deleteTasks() {
        if (!DB.inited) await DB.init();
        await DB.clear('tasks');
        this._memTasks = null;
        this._memTasksStamp = 0;
        
        // Emit cache invalidate event to refresh table
        TaskEvents.emit(TaskEvents.EVENTS.CACHE_INVALIDATE);
    }

    public static async updateTask(id: string, task: Task) {
        if (!DB.inited) await DB.init();
        const idNum = Number(id);
        const normalized: any = { ...task } as any;
        if (normalized.id === undefined || normalized.id === null) {
            normalized.id = Number.isFinite(idNum) ? idNum : id;
        }
        await DB.delete('tasks', normalized.id);
        await DB.put('tasks', normalized);
        this._memTasks = null;
        this._memTasksStamp = 0;
        
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
        return await DB.get('tasks', taskId);
    }

    public static async getTasks() {
        if (!DB.inited) await DB.init();
        return (await DB.getAll('tasks')).filter(t => t != null);
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
            
            // Clear existing tasks first
            await this.deleteTasks();
            
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
            
            // Add all tasks to IndexedDB (this will emit TASKS_BULK_UPDATE event)
            if (allTasks.length > 0) {
                // console.log(`💾 Saving ${allTasks.length} tasks to IndexedDB...`);
                await this.addTasks(allTasks);
                // console.log(`✅ Successfully saved ${allTasks.length} tasks to IndexedDB`);
            } else {
                console.warn(`⚠️  No tasks to save to IndexedDB`);
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

    public static async validateTasks() {
        try {
            if (this.validating) {
                this.dlog('validateTasks: already running, skipping re-entry');
                return true;
            }
            this.validating = true;
            const t0 = performance.now();
            // 0) Quick global-hash short-circuit
            const localBlocks = await this.computeLocalTaskBlockHashes();
            const localGlobalConcat = localBlocks.map(b => b.block_hash).join('');
            const localGlobalHash = sha256(localGlobalConcat).toString(encHex);
            try {
                const globalResp = await api.get('/integrity/global', { params: { table: 'wh_tasks' } });
                const serverGlobal = globalResp.data?.data?.global_hash;
                const serverBlockCount = globalResp.data?.data?.block_count ?? null;
                this.dlog('global compare', { localBlocks: localBlocks.length, serverBlockCount, equal: serverGlobal === localGlobalHash });
                if (serverGlobal && serverGlobal === localGlobalHash && (serverBlockCount === null || serverBlockCount === localBlocks.length)) {
                    this.dlog('global hash match; skipping block compare');
                    this.validating = false;
                    // Perfect match – nothing to do
                    return true;
                }
            } catch (_) {
                // ignore and continue with block-level comparison
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
                            if (rows?.length) await this.addTasks(rows);
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
        const normalizedUserIds = Array.isArray(task.user_ids) && task.user_ids.length
            ? `[${[...task.user_ids].map(n => Number(n)).filter(n => Number.isFinite(n)).sort((a,b)=>a-b).join(',')}]`
            : '';
        const row = [
            task.id,
            task.name || '',
            task.description || '',
            task.workspace_id,
            task.category_id,
            task.team_id,
            task.template_id || 0,
            task.spot_id || 0,
            task.status_id,
            task.priority_id,
            normalizedUserIds,
            
            // start_date (UTC epoch ms, COALESCE null -> '')
            task.start_date ? new Date(task.start_date).getTime() : '',
            // due_date (UTC epoch ms, COALESCE null -> '')
            task.due_date ? new Date(task.due_date).getTime() : '',
            task.expected_duration,
            // response_date (UTC epoch ms, COALESCE null -> '')
            task.response_date ? new Date(task.response_date).getTime() : '',
            // resolution_date (UTC epoch ms, COALESCE null -> '')
            task.resolution_date ? new Date(task.resolution_date).getTime() : '',
            task.work_duration,
            task.pause_duration,
            new Date(task.updated_at).getTime()
        ].join('|');
        return sha256(row).toString(encHex);
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
            
            // Get all tasks from IndexedDB (reuse in-memory decrypted cache when fresh)
            let tasks: Task[];
            const now = Date.now();
            if (this._memTasks && (now - this._memTasksStamp) < this.MEM_TTL_MS) {
                tasks = this._memTasks;
            } else {
                tasks = await this.getTasks();
                this._memTasks = tasks;
                this._memTasksStamp = now;
            }

            // Apply simple parameter filters
            if (params.workspace_id) {
                tasks = tasks.filter(task => task.workspace_id === parseInt(params.workspace_id));
            }
            if (params.status_id) {
                tasks = tasks.filter(task => task.status_id === parseInt(params.status_id));
            }
            if (params.priority_id) {
                tasks = tasks.filter(task => task.priority_id === parseInt(params.priority_id));
            }
            if (params.team_id) {
                tasks = tasks.filter(task => task.team_id === parseInt(params.team_id));
            }
            if (params.template_id) {
                tasks = tasks.filter(task => task.template_id === parseInt(params.template_id));
            }
            if (params.spot_id) {
                tasks = tasks.filter(task => task.spot_id === parseInt(params.spot_id));
            }
            if (params.category_id) {
                tasks = tasks.filter(task => task.category_id === parseInt(params.category_id));
            }

            // Apply search filter: includes ID, status/priority/spot names and responsible user names
            if (params.search) {
                const searchTerm = String(params.search).toLowerCase();

                // Optional lookup maps provided by caller for richer search
                const statusMap: Record<number, { name?: string }> = params.__statusMap || {};
                const priorityMap: Record<number, { name?: string }> = params.__priorityMap || {};
                const spotMap: Record<number, { name?: string }> = params.__spotMap || {};
                const userMap: Record<number, { name?: string; email?: string }> = params.__userMap || {};

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
                
                return {
                    rows: tasks.slice(startRow, endRow),
                    rowCount: tasks.length
                };
            } else {
                // Return all tasks
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
        return tasks.filter(task => {
            for (const [column, filterDetails] of Object.entries(filterModel)) {
                if (!this.taskMatchesFilter(task, column, filterDetails as any)) {
                    return false;
                }
            }
            return true;
        });
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
            // Normalize selected values to both numeric and string sets for robust matching
            const normalizedSelectedNums = selected.map((v: any) => {
                const n = Number(v);
                return Number.isFinite(n) ? n : null;
            }).filter((n: any) => n !== null);
            const normalizedSelectedStrs = selected.map((v: any) => String(v));

            const asNum = Number(value);
            if (Number.isFinite(asNum) && normalizedSelectedNums.length > 0) {
                if (normalizedSelectedNums.includes(asNum)) return true;
            }
            // Fallback to string compare
            return normalizedSelectedStrs.includes(String(value));
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
                } else if (typeof aValue === 'string' && typeof bValue === 'string') {
                    comparison = aValue.localeCompare(bValue);
                } else if (aValue instanceof Date || bValue instanceof Date) {
                    const aDate = new Date(aValue);
                    const bDate = new Date(bValue);
                    comparison = aDate.getTime() - bDate.getTime();
                } else {
                    comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
                }
                
                if (comparison !== 0) {
                    return direction === 'desc' ? -comparison : comparison;
                }
            }
            return 0;
        });
    }


} 