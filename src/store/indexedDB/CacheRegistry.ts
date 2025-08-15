import { TasksCache } from "./TasksCache";
import { CategoriesCache } from "./CategoriesCache";
import { TeamsCache } from "./TeamsCache";
import { WorkspaceCache } from "./WorkspaceCache";
import { GenericCache } from "./GenericCache";

// Thin wrappers built on GenericCache for common tables
const statusesCache = new GenericCache({ table: 'wh_statuses', endpoint: '/statuses', store: 'statuses' });
const prioritiesCache = new GenericCache({ table: 'wh_priorities', endpoint: '/priorities', store: 'priorities' });
const spotsCache = new GenericCache({ table: 'wh_spots', endpoint: '/spots', store: 'spots' });
const tagsCache = new GenericCache({ table: 'wh_tags', endpoint: '/tags', store: 'tags' });

type CacheHandler = {
	add: (row: any) => Promise<void>;
	update: (id: number | string, row: any) => Promise<void>;
	remove: (id: number | string) => Promise<void>;
};

const cacheByTable: Record<string, CacheHandler> = {
	// Core
	wh_tasks: {
		add: (row) => TasksCache.addTask(row),
		update: (id, row) => TasksCache.updateTask(String(id), row),
		remove: (id) => TasksCache.deleteTask(String(id)),
	},
	wh_categories: {
		add: (row) => CategoriesCache.addCategory(row),
		update: (id, row) => CategoriesCache.updateCategory(String(id), row),
		remove: (id) => CategoriesCache.deleteCategory(String(id)),
	},
	wh_teams: {
		add: (row) => TeamsCache.addTeam(row),
		update: (id, row) => TeamsCache.updateTeam(String(id), row),
		remove: (id) => TeamsCache.deleteTeam(String(id)),
	},
	wh_workspaces: {
		add: (row) => WorkspaceCache.addWorkspace(row),
		update: (id, row) => WorkspaceCache.updateWorkspace(String(id), row),
		remove: (id) => WorkspaceCache.deleteWorkspace(String(id)),
	},

	// Simple reference tables
	wh_statuses: {
		add: (row) => statusesCache.add(row),
		update: (id, row) => statusesCache.update(id, row),
		remove: (id) => statusesCache.remove(id),
	},
	wh_priorities: {
		add: (row) => prioritiesCache.add(row),
		update: (id, row) => prioritiesCache.update(id, row),
		remove: (id) => prioritiesCache.remove(id),
	},
	wh_spots: {
		add: (row) => spotsCache.add(row),
		update: (id, row) => spotsCache.update(id, row),
		remove: (id) => spotsCache.remove(id),
	},
	wh_tags: {
		add: (row) => tagsCache.add(row),
		update: (id, row) => tagsCache.update(id, row),
		remove: (id) => tagsCache.remove(id),
	},
};

export function getCacheForTable(table: string): CacheHandler | null {
	return cacheByTable[table] ?? null;
}


