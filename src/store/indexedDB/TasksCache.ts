import { auth } from "@/firebase/firebaseConfig";
import { Task } from "../types";
import { DB } from "./DB";
import { api } from "@/store/api/internalApi";
import { TaskEvents } from "@/store/eventEmiters/taskEvents";

export class TasksCache {

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
    private static readonly MEM_TTL_MS = 10000; // 10s TTL for in-memory cache

    private static _memSharedTasks: Task[] | null = null;
    private static _memSharedTasksStamp = 0;

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

    public static async deleteTasksBulk(taskIds: Array<string | number>) {
        if (!DB.inited) await DB.init();
        for (const taskId of taskIds) {
            try {
                await DB.delete('tasks', taskId as any);
                await DB.delete('shared_tasks', taskId as any);
            } catch {
                // Ignore missing rows
            }
        }
        this._memTasks = null;
        this._memTasksStamp = 0;
        this._memSharedTasks = null;
        this._memSharedTasksStamp = 0;

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

        // Soft-delete handling: tasks are a custom cache (not GenericCache), so we need to
        // mirror the generic behavior. If backend sends an UPDATE with deleted_at set,
        // remove the task from local stores so the UI treats it as deleted.
        if (Object.prototype.hasOwnProperty.call(normalized, 'deleted_at') && normalized.deleted_at != null) {
            await this.deleteTask(String(normalized.id));
            return;
        }

        // Determine which store contains the task and update atomically using IndexedDB's upsert behavior
        // DB.put() automatically replaces existing records with the same key, making this operation atomic
        const existingInTasks = await DB.get('tasks', normalized.id);
        // If it doesn't exist in the primary tasks store, check shared_tasks. If it's in neither,
        // default to restoring into the primary tasks store (common for soft-delete restore flows).
        const existingInShared = existingInTasks ? null : await DB.get('shared_tasks', normalized.id);
        const storeName = existingInTasks ? 'tasks' : (existingInShared ? 'shared_tasks' : 'tasks');
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

        // If a soft-deleted task comes through (rare but possible), ensure it's not stored locally.
        if (Object.prototype.hasOwnProperty.call(normalized, 'deleted_at') && normalized.deleted_at != null) {
            await this.deleteTask(String(normalized.id));
            return;
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

    public static async validateTasks(): Promise<void> {
        return;
    }

    /**
     * Query tasks from local cache with filtering, sorting, and pagination
     * This replicates the backend getTasks functionality locally
     */
    public static async queryTasks(params: any = {}) {
        try {
            if (!DB.inited) await DB.init();
            
            const sharedWithMe = !!params.shared_with_me;

            // Get tasks from appropriate store (tasks vs shared_tasks)
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
                    // Always update memory cache with current results (even if empty)
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
