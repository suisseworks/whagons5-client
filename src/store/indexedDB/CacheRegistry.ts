import { TasksCache } from "./TasksCache";

// Import generic caches (handles all CRUD tables except tasks)
import { genericCaches } from "../genericSlices";
// Import Redux store and actions
import { store } from "../store";
import { genericActions } from "../genericSlices";
import { getTasksFromIndexedDB } from "../reducers/tasksSlice";

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
	...Object.entries(genericCaches).reduce((acc, [_key, cache]) => ({
		...acc,
		[cache.getTableName()]: {
			add: (row: any) => cache.add(row),
			update: (id: number | string, row: any) => cache.update(id, row),
			remove: (id: number | string) => cache.remove(id),
		},
	}), {}),
};

// Sync handlers: re-load Redux slice state from IndexedDB
type SyncHandler = () => void;

const syncByTable: Record<string, SyncHandler> = {
	// Tasks use custom thunk
	wh_tasks: () => store.dispatch(getTasksFromIndexedDB()),

	// All other tables handled by generic slices
	...Object.entries(genericCaches).reduce((acc, [key, cache]) => {
		const tableName = cache.getTableName();
		const actions = genericActions[key as keyof typeof genericActions];
		if (actions && (actions as any).getFromIndexedDB) {
			return {
				...acc,
				[tableName]: () => store.dispatch((actions as any).getFromIndexedDB()),
			};
		}
		return acc;
	}, {}),
};

export function getCacheForTable(table: string): CacheHandler | null {
	return cacheByTable[table] ?? null;
}

export function syncReduxForTable(table: string): void {
	const sync = syncByTable[table];
	if (sync) sync();
}


