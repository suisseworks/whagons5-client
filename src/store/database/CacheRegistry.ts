import { DuckTaskCache } from "./DuckTaskCache";

// Import generic caches (handles all CRUD tables except tasks)
import { genericCaches } from "../genericSlices";
// Import Redux store and actions
import { store } from "../store";
import { genericActions } from "../genericSlices";
// NOTE: getTasksFromIndexedDB intentionally NOT imported - tasks should never be auto-loaded into Redux memory

type CacheHandler = {
	add: (row: any) => Promise<void>;
	update: (id: number | string, row: any) => Promise<void>;
	remove: (id: number | string) => Promise<void>;
	getAll: () => Promise<any[]>;
};

const cacheByTable: Record<string, CacheHandler> = {
	// Only custom cache with advanced features (tasks)
	wh_tasks: {
		add: async (row) => { await DuckTaskCache.upsertTask(row); },
		update: async (_id, row) => { await DuckTaskCache.upsertTask(row); },
		remove: (id) => DuckTaskCache.deleteTask(String(id)),
		getAll: () => DuckTaskCache.getAllTasks(),
	},

	// All other tables (30+ tables) handled by generic caches
	...Object.entries(genericCaches).reduce((acc, [_key, cache]) => ({
		...acc,
		[cache.getTableName()]: {
			add: (row: any) => cache.add(row),
			update: (id: number | string, row: any) => cache.update(id, row),
			remove: (id: number | string) => cache.remove(id),
			getAll: () => cache.getAll(),
		},
	}), {}),
};

// Sync handlers: re-load Redux slice state from DuckDB caches
type SyncHandler = () => Promise<void>;

const syncByTable: Record<string, SyncHandler> = {
	// Tasks: DO NOT auto-sync to Redux - this would load ALL tasks into memory
	// Tasks Redux slice is only used for optimistic updates (add/update/delete individual tasks)
	// Settings pages and other components should query DuckTaskCache directly instead
	// wh_tasks: intentionally omitted - never load all tasks into Redux memory

	// All other tables handled by generic slices
	...Object.entries(genericCaches).reduce((acc, [key, cache]) => {
		const tableName = cache.getTableName();
		const actions = genericActions[key as keyof typeof genericActions];
		if (actions && (actions as any).getFromDuckDB) {
			return {
				...acc,
				[tableName]: async () => { await store.dispatch((actions as any).getFromDuckDB()); },
			};
		}
		return acc;
	}, {}),
};

export function getCacheForTable(table: string): CacheHandler | null {
	return cacheByTable[table] ?? null;
}

export async function syncReduxForTable(table: string): Promise<void> {
	const sync = syncByTable[table];
	if (sync) {
		try {
			await sync();
		} catch (error) {
			console.error('CacheRegistry: Error syncing Redux for table:', table, error);
		}
	} else {
		console.warn('CacheRegistry: No sync handler found for table:', table);
	}
}


