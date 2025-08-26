import { TasksCache } from "./TasksCache";
import { GenericCache } from "./GenericCache";

// Import generic caches (handles all CRUD tables except tasks)
import { genericCaches } from "../genericSlices";

type CacheHandler = {
	add: (row: any) => Promise<void>;
	update: (id: number | string, row: any) => Promise<void>;
	remove: (id: number | string) => Promise<void>;
};

const cacheByTable: Record<string, CacheHandler> = {
	// Only custom cache with advanced features (tasks)
	wh_tasks: {
		add: (row) => TasksCache.addTask(row),
		update: (id, row) => TasksCache.updateTask(String(id), row),
		remove: (id) => TasksCache.deleteTask(String(id)),
	},

	// All other tables (30+ tables) handled by generic caches
	...Object.entries(genericCaches).reduce((acc, [key, cache]) => ({
		...acc,
		[cache.getTableName()]: {
			add: (row: any) => cache.add(row),
			update: (id: number | string, row: any) => cache.update(id, row),
			remove: (id: number | string) => cache.remove(id),
		},
	}), {}),
};

export function getCacheForTable(table: string): CacheHandler | null {
	return cacheByTable[table] ?? null;
}


