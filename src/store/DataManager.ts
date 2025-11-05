import { AppDispatch } from './store';
import { genericActions, genericCaches } from './genericSlices';
import { getTasksFromIndexedDB } from './reducers/tasksSlice';
import { TasksCache } from './indexedDB/TasksCache';
import { GenericCache } from './indexedDB/GenericCache';
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
  'jobPositions',
  'forms',
  'formVersions',
  'customFields',
  'categoryCustomFields',
] as const;

export class DataManager {
  constructor(private dispatch: AppDispatch) {}

  async loadCoreFromIndexedDB() {
    await this.dispatch(getTasksFromIndexedDB());
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


    // Validate and refresh core entities
    try {
      const caches: GenericCache[] = coreKeys
        .map((k) => (genericCaches as any)[k])
        .filter((c: any): c is GenericCache => !!c);
      await GenericCache.validateMultiple(caches);

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
    } catch (e) {
      console.warn('DataManager: core cache validate failed', e);
    }


      // Validate and refresh tasks
      try {
        await TasksCache.init();
        await TasksCache.validateTasks();
        await this.dispatch(getTasksFromIndexedDB());
      } catch (e) {
        console.warn('DataManager: tasks cache validate failed', e);
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
