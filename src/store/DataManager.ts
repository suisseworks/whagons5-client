import { AppDispatch } from './store';
import { genericActions, genericCaches } from './genericSlices';
import { getTasksFromIndexedDB } from './reducers/tasksSlice';
import { TasksCache } from './indexedDB/TasksCache';
import { GenericCache } from './indexedDB/GenericCache';
import { DB } from './indexedDB/DB';
import apiClient from '../api/whagonsApi';
import { verifyManifest } from '../lib/manifestVerify';

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
  'tags',
  'broadcasts',
  'boards',
  // Plugin tables
  'plugins',
  'pluginRoutes',
  'broadcastAcknowledgments',
  'boardMembers',
  'boardMessages',
  'workspaceChat',
  'messages',
  'workflows',
  'complianceStandards',
  'complianceRequirements',
  'complianceMappings',
  'complianceAudits',
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
    await this.dispatch(getTasksFromIndexedDB());
  }

  async validateAndRefresh() {
    console.log('🔍 [DataManager] validateAndRefresh() CALLED');
    // Batch validate all entities (including tasks) using ONE batch endpoint call
    // Retry logic for transient DB closure errors
    const maxRetries = 2;
    let lastError: any = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Ensure DB is ready before validation
        if (attempt > 0) {
          console.log(`DataManager: retrying validation after DB reopen (attempt ${attempt + 1}/${maxRetries + 1})`);
          // Wait a bit for DB to stabilize
          await new Promise(resolve => setTimeout(resolve, 200));
          // Ensure DB is initialized
          await DB.init();
          const ready = await DB.whenReady(3000);
          if (!ready) {
            console.warn('DataManager: DB not ready after retry wait');
            continue;
          }
        }
        
        const caches: GenericCache[] = coreKeys
          .map((k) => (genericCaches as any)[k])
          .filter((c: any): c is GenericCache => !!c);
        
        // Run generic caches and tasks validation in parallel to avoid blocking
        console.log('[DataManager] Starting parallel validation...');
        const start = performance.now();
        
        await Promise.all([
          // 1. Generic caches (batched)
          GenericCache.validateMultiple(caches, ['wh_tasks'])
            .then(res => console.log('[DataManager] Generic validation finished', Object.keys(res.results).length))
            .catch(e => console.warn('DataManager: generic cache batch failed', e)),

          // 2. Tasks cache (independent)
          (async () => {
            try {
              await TasksCache.init();
              // Call without server data to trigger self-fetch of global hash
              await TasksCache.validateTasks();
              console.log('[DataManager] Tasks validation finished');
            } catch (e) {
              console.warn('DataManager: tasks cache validate failed', e);
            }
          })()
        ]);
        
        console.log(`[DataManager] All validation finished in ${(performance.now() - start).toFixed(0)}ms. Starting Redux refresh...`);
        
        // Small delay to ensure IDB transactions are fully committed/visible
        await new Promise(resolve => setTimeout(resolve, 50));

        // Refresh all entities from IndexedDB
        await Promise.allSettled(
          coreKeys.map(async (key) => {
            const actions = (genericActions as any)[key];
            if (actions?.getFromIndexedDB) {
              return this.dispatch(actions.getFromIndexedDB());
            } else {
              return Promise.resolve();
            }
          })
        );
        
        // Refresh tasks from IndexedDB
        await this.dispatch(getTasksFromIndexedDB());
        
        // Success - exit retry loop
        return;
      } catch (e: any) {
        lastError = e;
        // Check if this is a transient DB closure error
        const isTransientError = 
          e?.name === 'InvalidStateError' ||
          e?.message?.includes('connection is closing') ||
          e?.message?.includes('Failed to execute \'transaction\'');
        
        if (isTransientError && attempt < maxRetries) {
          // Will retry on next iteration
          continue;
        } else {
          // Not a transient error or max retries reached
          console.warn('DataManager: cache validate failed', e);
          break;
        }
      }
    }
    
    // If we get here, all retries failed
    if (lastError) {
      console.warn('DataManager: cache validate failed after retries', lastError);
    }
  }

  async verifyManifest() {
    try {
      const manifestResp = await apiClient.get('/sync/manifest');
      if (manifestResp.status === 200) {
        const m = manifestResp.data?.data || manifestResp.data;
        const ok = await verifyManifest(m);
        if (!ok) {
          console.warn('DataManager: Manifest signature invalid');
        }
      }
    } catch (e) {
      console.warn('DataManager: Manifest fetch/verify failed (continuing):', e);
    }
  }

}
