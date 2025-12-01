import { AppDispatch } from './store';
import { genericActions, genericCaches } from './genericSlices';
import { DuckTaskCache } from './database/DuckTaskCache';
import { DuckGenericCache } from './database/DuckGenericCache';
import { DuckDB } from './database/DuckDB';
import apiClient from '../api/whagonsApi';

type IntegrityGlobalEntry = {
  global_hash?: string;
  block_count?: number;
  [key: string]: unknown;
} | null;

const coreKeys = [
  'workspaces',
  'teams',
  'categories',
  'templates',
  'statuses',
  'statusTransitions',
  'statusTransitionGroups',
  'priorities',
  'slas',
  'approvals',
  'approvalApprovers',
  'spots',
  'users',
  'userTeams',
  'invitations',
  'jobPositions',
  'forms',
  'formVersions',
  'customFields',
  'categoryCustomFields',
] as const;

export class DataManager {
  constructor(private dispatch: AppDispatch) {}

  async loadCoreFromIndexedDB() {
    await Promise.allSettled(
      coreKeys.map(async (key) => {
        const actions = (genericActions as any)[key];
        if (actions?.getFromIndexedDB) {
          return this.dispatch(actions.getFromIndexedDB());
        } else {
          console.warn('DataManager: missing generic actions for key', key);
          return Promise.resolve();
        }
      })
    );
  }

  async validateAndRefresh() {
    // Validate all DuckDB-backed caches (generic + tasks) and then refresh Redux.
    try {
			// Debug gate: allow disabling all network validation/fetches to test persisted data only
			const disableFetch = (() => {
				try { return localStorage.getItem('wh-disable-fetch') === 'true'; } catch { return false; }
			})();
			if (disableFetch) {
				console.log('[DataManager] Network disabled via wh-disable-fetch; loading from local caches only');
				await Promise.allSettled(
					coreKeys.map(async (key) => {
						const actions = (genericActions as any)[key];
						if (actions?.getFromDuckDB) {
							return this.dispatch(actions.getFromDuckDB());
						}
						return Promise.resolve();
					})
				);
				// Skip tasks; task UIs pull directly from DuckTaskCache without forcing validate()
				return;
			}

      const caches: DuckGenericCache<any>[] = coreKeys
        .map((k) => (genericCaches as any)[k])
        .filter((c: any): c is DuckGenericCache<any> => !!c);

      const tableNames = caches.map((cache) => cache.getTableName());
      const batchTables = Array.from(new Set([...tableNames, 'wh_tasks']));
      const serverGlobals = await this.fetchIntegrityGlobals(batchTables);

      // Run generic caches and tasks validation in parallel to avoid blocking
      console.log('[DataManager] Starting parallel validation...');
      const start = performance.now();

      await DuckDB.flush('before-validation').catch(() => {});

      await Promise.all([
        // 1. Generic caches (each does its own lightweight global-hash check)
        Promise.all(
          caches.map(async (cache) => {
            try {
              const table = cache.getTableName();
              const serverEntry = serverGlobals?.[table];
              const serverGlobal = this.extractServerGlobal(serverEntry);
              await cache.validate({ serverGlobal });
            } catch (e) {
              console.warn('DataManager: generic cache validate failed', cache.getTableName(), e);
            }
          })
        ),

        // 2. Tasks cache (DuckDB-backed)
        (async () => {
          try {
            await DuckTaskCache.init();
            const taskServerEntry = serverGlobals?.wh_tasks;
            const serverGlobal = this.extractServerGlobal(taskServerEntry);
            await DuckTaskCache.validate({ serverGlobal });
            console.log('[DataManager] Tasks validation finished');
          } catch (e) {
            console.warn('DataManager: tasks cache validate failed', e);
          }
        })()
      ]);

      console.log(
        `[DataManager] All validation finished in ${(performance.now() - start).toFixed(
          0
        )}ms. Starting Redux refresh...`
      );

      await DuckDB.flush('after-validation').catch((flushErr) => {
        console.warn('DataManager: DuckDB flush after validation failed', flushErr);
      });

      // Refresh all entities from Duck-backed caches via generic slices
        await Promise.allSettled(
        coreKeys.map(async (key) => {
          const actions = (genericActions as any)[key];
            if (actions?.getFromDuckDB) {
              return this.dispatch(actions.getFromDuckDB());
          } else {
            return Promise.resolve();
          }
        })
      );

      // NOTE: We no longer auto-hydrate the tasks slice here; task UIs read directly
      // from DuckTaskCache, and settings/Home can opt-in to load tasks via
      // getTasksFromIndexedDB() when they actually need a full in-memory list.
    } catch (e) {
      console.warn('DataManager: cache validate failed', e);
    }
  }

  private async fetchIntegrityGlobals(
    tables: string[]
  ): Promise<Record<string, IntegrityGlobalEntry>> {
    if (!tables.length) {
      return {};
    }
    try {
      const resp = await apiClient.get('/integrity/global/batch', {
        params: { tables: tables.join(',') },
      });
      const data = resp.data?.data ?? resp.data ?? {};
      return data as Record<string, IntegrityGlobalEntry>;
    } catch (error) {
      console.warn('DataManager: integrity batch fetch failed, falling back to per-table', error);
      return {};
    }
  }

  private extractServerGlobal(entry: IntegrityGlobalEntry | undefined): string | null | undefined {
    if (typeof entry === 'undefined') return undefined;
    if (entry === null) return null;
    if (entry && typeof entry === 'object') {
      return (entry.global_hash ?? (entry as any).globalHash ?? null) as string | null;
    }
    return undefined;
  }
}
