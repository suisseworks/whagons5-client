import { auth } from "@/firebase/firebaseConfig";
import { Task } from "../types";
import { DB } from "./DB";
import api from "@/api/whagonsApi";
import { TaskEvents } from "@/store/eventEmiters/taskEvents";

export class TasksCache {

    private static initPromise: Promise<boolean> | null = null;
    private static authListener: (() => void) | null = null;

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
            console.log("fetching tasks, initialized: ", this.initialized);
            const success = await this.fetchTasks();
            if (success) {
                this.initialized = true;
                this.lastUpdated = await this.getLastUpdated();
                console.log("tasks fetched, initialized: ", this.initialized, "lastUpdated: ", this.lastUpdated);
            }
            return success;
        } else {
            //I must run a fetch to check if tasks have changed   
            console.log("validating tasks, lastUpdated: ", await this.getLastUpdated()); 
            return await this.validateTasks();
        }
    }

    public static async deleteTask(taskId: string) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("tasks");
        store.delete(taskId);
        
        // Emit event to refresh table
        TaskEvents.emit(TaskEvents.EVENTS.TASK_DELETED, { id: taskId });
    }

    public static async deleteTasks() {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("tasks");
        store.clear();
        
        // Emit cache invalidate event to refresh table
        TaskEvents.emit(TaskEvents.EVENTS.CACHE_INVALIDATE);
    }

    public static async updateTask(id: string, task: Task) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("tasks");
        //delete the old task
        store.delete(id);
        //add the new task
        store.put(task);
        
        // Emit event to refresh table
        TaskEvents.emit(TaskEvents.EVENTS.TASK_UPDATED, task);
    }

    public static async addTask(task: Task) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("tasks");
        store.put(task);
        
        // Emit event to refresh table
        TaskEvents.emit(TaskEvents.EVENTS.TASK_CREATED, task);
    }

    public static async addTasks(tasks: Task[]) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreWrite("tasks");
        tasks.forEach(task => {
            store.put(task);
        });
        
        // Emit bulk update event to refresh table
        TaskEvents.emit(TaskEvents.EVENTS.TASKS_BULK_UPDATE, tasks);
    }

    public static async getTask(taskId: string) {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreRead("tasks");
        const request = store.get(taskId);
        const task = await new Promise<Task>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return task;
    }

    public static async getTasks() {
        if (!DB.inited) await DB.init();
        const store = DB.getStoreRead("tasks");
        const request = store.getAll();
        const tasks = await new Promise<Task[]>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return tasks;
    }

    public static async getLastUpdated(): Promise<Date> {
        const store = DB.getStoreRead("tasks");
        const request = store.getAll();
        const tasks = await new Promise<Task[]>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        //we need the most recent updated_at date
        const lastUpdated = tasks.reduce((max, task) => {
            return new Date(task.updated_at) > max ? new Date(task.updated_at) : max;
        }, new Date(0));
        return lastUpdated; 
    }

    //set flag for initialized from local storage
    public static get initialized(): boolean {
        return localStorage.getItem(`tasksCacheInitialized-${auth.currentUser?.uid}`) === "true";
    }
    public static set initialized(value: boolean) {
        localStorage.setItem(`tasksCacheInitialized-${auth.currentUser?.uid}`, value.toString());
    }

    public static get lastUpdated(): Date {
        return new Date(localStorage.getItem(`tasksCacheLastUpdated-${auth.currentUser?.uid}`) || "0");
    }
    public static set lastUpdated(value: Date) {
        localStorage.setItem(`tasksCacheLastUpdated-${auth.currentUser?.uid}`, value.toISOString());
    }

    public static async fetchTasks() {
        let allTasks: Task[] = [];
        let currentPage = 1;
        let totalApiCalls = 0;
        
        try {
            let hasNextPage = true;
            let totalPagesExpected = 0;
            
            console.log("🚀 Starting to fetch all tasks with pagination...");
            
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
                console.log(`📡 API Call #${totalApiCalls} - Fetching tasks page ${currentPage}...`);
                console.log(`🔗 API URL: GET /api/tasks?${new URLSearchParams({
                    page: currentPage.toString(),
                    per_page: '500',
                    sort_by: 'id',
                    sort_direction: 'asc'
                }).toString()}`);
                
                const response = await api.get("/tasks", {
                    params: apiParams
                });
                
                // Handle the new API response structure
                const pageData = response.data.data as Task[];
                const pagination = response.data.pagination;
                
                // Debug pagination info
                console.log(`📊 Pagination Info for Page ${currentPage}:`, {
                    current_page: pagination?.current_page,
                    per_page: pagination?.per_page,
                    total: pagination?.total,
                    last_page: pagination?.last_page,
                    from: pagination?.from,
                    to: pagination?.to,
                    has_next_page: pagination?.has_next_page,
                    next_page: pagination?.next_page,
                    tasks_in_response: pageData?.length || 0
                });
                
                // Set expected total pages from first response
                if (currentPage === 1 && pagination?.last_page) {
                    totalPagesExpected = pagination.last_page;
                    console.log(`📈 Expected total pages: ${totalPagesExpected}, Expected total tasks: ${pagination.total}`);
                }
                
                if (pageData && pageData.length > 0) {
                    const tasksBefore = allTasks.length;
                    
                    // Get ID range for this page
                    const pageIds = pageData.map(task => task.id);
                    const minId = Math.min(...pageIds);
                    const maxId = Math.max(...pageIds);
                    
                    console.log(`📋 Page ${currentPage} ID range: ${minId} to ${maxId}`);
                    
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
                    console.log(`➡️  Moving to next page: ${currentPage}`);
                } else {
                    console.log(`🏁 Completed fetching all tasks!`);
                    console.log(`📊 Final Summary:`);
                    console.log(`   - Total API calls made: ${totalApiCalls}`);
                    console.log(`   - Expected pages: ${totalPagesExpected}`);
                    console.log(`   - Last page processed: ${currentPage}`);
                    console.log(`   - Unique tasks collected: ${allTasks.length}`);
                    console.log(`   - Expected total (from API): ${pagination?.total || 'unknown'}`);
                    
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
                console.log(`💾 Saving ${allTasks.length} tasks to IndexedDB...`);
                await this.addTasks(allTasks);
                console.log(`✅ Successfully saved ${allTasks.length} tasks to IndexedDB`);
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
            //we fetch only tasks with a last_updated greater than the lastUpdated date
            const response = await api.get("/tasks", {
                params: {
                    updated_after: this.lastUpdated.toISOString(),
                    per_page: 500, // Use max per page for efficiency
                    sort_by: 'id',
                    sort_direction: 'asc'
                }
            });
            const tasks = response.data.data as Task[];
            if (tasks && tasks.length > 0) {
                console.log(`Validating tasks: found ${tasks.length} updated tasks`);
                
                // Add updated tasks (this will emit TASKS_BULK_UPDATE event)
                await this.addTasks(tasks);
            } else {
                console.log("validateTasks: no updates found");
            }
            return true;
        } catch (error) {
            console.error("validateTasks", error);
            return false;
        }
    }

    /**
     * Query tasks from local cache with filtering, sorting, and pagination
     * This replicates the backend getTasks functionality locally
     */
    public static async queryTasks(params: any = {}) {
        try {
            if (!DB.inited) await DB.init();
            
            // Get all tasks from IndexedDB
            let tasks = await this.getTasks();

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

            // Apply search filter
            if (params.search) {
                const searchTerm = params.search.toLowerCase();
                tasks = tasks.filter(task => 
                    (task.name && task.name.toLowerCase().includes(searchTerm)) ||
                    (task.description && task.description.toLowerCase().includes(searchTerm))
                );
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
                // Default sorting by created_at desc
                tasks = this.applySorting(tasks, [{ colId: 'created_at', sort: 'desc' }]);
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
                const pageSize = endRow - startRow;
                
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
        const { filterType, type, filter, filterTo, dateFrom, dateTo } = condition;
        
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