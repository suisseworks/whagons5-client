import { AppDispatch } from './store';
import { genericInternalActions } from './genericSlices';
import { getTasksFromIndexedDB } from './reducers/tasksSlice';
import { fetchRoles } from './reducers/rolesSlice';
import { DB } from './indexedDB/DB';
import { getCacheForTable, syncReduxForTable } from './indexedDB/CacheRegistry';
import { auth } from '@/firebase/firebaseConfig';
import { api as apiClient } from './api/internalApi';
import { ApiLoadingTracker } from '@/api/apiLoadingTracker';
import { TasksCache } from './indexedDB/TasksCache';

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
  'slaPolicies',
  'slaAlerts',
  'approvals',
  'approvalApprovers',
  'taskApprovalInstances',
  'spots',
  'spotTypes',
  'users',
  'userTeams',
  'invitations',
  'jobPositions',
  'forms',
  'formFields',
  'formVersions',
  'taskForms',
  'fieldOptions',
  'customFields',
  'categoryCustomFields',
  'spotCustomFields',
  'templateCustomFields',
  'taskCustomFieldValues',
  'spotCustomFieldValues',
  'tags',
  'taskTags',
  'taskUsers',
  'taskShares',
  'taskLogs',
  'statusTransitionLogs',
  'taskAttachments',
  'taskNotes',
  'taskRecurrences',
  'categoryPriorities',
  'broadcasts',
  'broadcastAcknowledgments',
  'boards',
  'boardMembers',
  'boardMessages',
  'boardAttachments',
  'workspaceChat',
  'messages',
  'workflows',
  'exceptions',
  'sessionLogs',
  'configLogs',
  // Plugin tables
  'plugins',
  'pluginRoutes',
  'kpiCards',
  'complianceStandards',
  'complianceRequirements',
  'complianceMappings',
  'complianceAudits',
  // Schedule Management
  'scheduleTemplates',
  'scheduleTemplateDays',
  'userSchedules',
] as const;

export class DataManager {
  constructor(private dispatch: AppDispatch) {}

  async loadCoreFromIndexedDB() {
    await Promise.allSettled(
      coreKeys.map(async (key) => {
        const actions = (genericInternalActions as any)[key];
        if (actions?.getFromIndexedDB) {
          return this.dispatch(actions.getFromIndexedDB());
        } else {
          console.warn('DataManager: missing generic actions for key', key);
          return Promise.resolve();
        }
      })
    );
    await this.dispatch(getTasksFromIndexedDB());
    // Fetch roles (not a wh_* table, no IndexedDB cache)
    await this.dispatch(fetchRoles());
  }

  async bootstrapAndSync(): Promise<void> {
    await DB.init();
    try {
      await apiClient.get('/bootstrap');
    } catch (error) {
      console.warn('DataManager: bootstrap failed', error);
    }

    const cursorKey = this.getCursorKey();
    const cursor = cursorKey ? localStorage.getItem(cursorKey) : null;
    const lastSyncKey = this.getLastSyncKey();
    const lastSyncAt = lastSyncKey ? Number(localStorage.getItem(lastSyncKey) || 0) : 0;

    let hasLocalData = false;
    try {
      const [workspaces, teams, categories, kpis] = await Promise.all([
        DB.getAll('workspaces'),
        DB.getAll('teams'),
        DB.getAll('categories'),
        DB.getAll('kpi_cards'),
      ]);
      hasLocalData =
        (workspaces?.length ?? 0) > 0 ||
        (teams?.length ?? 0) > 0 ||
        (categories?.length ?? 0) > 0 ||
        (kpis?.length ?? 0) > 0;
    } catch (error) {
      console.warn('DataManager: failed to read cache snapshot', error);
    }

    if (!hasLocalData && cursorKey && cursor) {
      localStorage.removeItem(cursorKey);
    }

    const shouldSkipSync =
      hasLocalData &&
      !!cursor &&
      lastSyncAt > 0 &&
      Date.now() - lastSyncAt < 30_000;

    if (shouldSkipSync) {
      return;
    }

    const didSync = await this.syncStream(hasLocalData ? cursor || undefined : undefined);
    if (didSync && lastSyncKey) {
      localStorage.setItem(lastSyncKey, String(Date.now()));
    }
  }

  private getCursorKey(): string | null {
    const tenant = localStorage.getItem('whagons-subdomain') || '';
    const uid = auth.currentUser?.uid || 'anon';
    return `wh_sync_cursor:${tenant}:${uid}`;
  }

  private getLastSyncKey(): string | null {
    const tenant = localStorage.getItem('whagons-subdomain') || '';
    const uid = auth.currentUser?.uid || 'anon';
    return `wh_sync_last_completed:${tenant}:${uid}`;
  }

  private async resetCachesAndResync(): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (uid) {
      try {
        await DB.deleteDatabase(uid);
      } catch (error) {
        console.warn('DataManager: failed to delete IndexedDB for resync', error);
      }
    }
    const cursorKey = this.getCursorKey();
    if (cursorKey) {
      localStorage.removeItem(cursorKey);
    }
    await DB.init(uid);
    await this.syncStream();
  }

  private async syncStream(cursor?: string): Promise<boolean> {
    ApiLoadingTracker.increment();
    const baseUrl = apiClient.defaults.baseURL ?? '';
    const authHeader = (apiClient.defaults.headers.common as any)?.Authorization as string | undefined;
    const headers: HeadersInit = {
      Accept: 'application/x-ndjson, application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const url = cursor ? `${baseUrl}/sync/stream?cursor=${encodeURIComponent(cursor)}` : `${baseUrl}/sync/stream`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    const taskUpserts: any[] = [];
    const taskDeletes: Array<number | string> = [];
    const TASK_BATCH_SIZE = 200;
    let taskFlushTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include',
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 400) {
          await this.resetCachesAndResync();
          return true;
        }
        throw new Error(`Sync stream failed: ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let needsResync = false;
      let doneReceived = false;
      const touchedTables = new Set<string>();
      const syncedTables = new Set<string>();
      const pendingSyncTables = new Set<string>();
      const priorityTables = new Set<string>([
        'wh_workspaces',
        'wh_teams',
        'wh_categories',
        'wh_statuses',
        'wh_priorities',
        'wh_templates',
        'wh_spots',
        'wh_spot_types',
        'wh_slas',
        'wh_sla_policies',
        'wh_kpi_cards',
        'wh_users',
        'wh_user_team',
      ]);
      const cursorKey = this.getCursorKey();

      const flushPendingSyncs = async () => {
        if (syncTimer) {
          clearTimeout(syncTimer);
          syncTimer = null;
        }
        const tables = Array.from(pendingSyncTables);
        pendingSyncTables.clear();
        await Promise.all(tables.map(async (table) => {
          try {
            await syncReduxForTable(table);
            syncedTables.add(table);
          } catch (error) {
            console.warn('DataManager: sync redux failed', table, error);
          }
        }));
      };

      const schedulePrioritySync = () => {
        if (syncTimer) return;
        syncTimer = setTimeout(() => {
          void flushPendingSyncs();
        }, 75);
      };

      const flushTaskBatches = async () => {
        if (taskFlushTimer) {
          clearTimeout(taskFlushTimer);
          taskFlushTimer = null;
        }
        if (taskUpserts.length > 0) {
          const batch = taskUpserts.splice(0, taskUpserts.length);
          await TasksCache.addTasks(batch);
          touchedTables.add('wh_tasks');
        }
        if (taskDeletes.length > 0) {
          const batch = taskDeletes.splice(0, taskDeletes.length);
          await TasksCache.deleteTasksBulk(batch);
          touchedTables.add('wh_tasks');
        }
      };

      const scheduleTaskBatchFlush = () => {
        if (taskFlushTimer) return;
        taskFlushTimer = setTimeout(() => {
          void flushTaskBatches();
        }, 100);
      };

      const handleLine = async (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let msg: any;
        try {
          msg = JSON.parse(trimmed);
        } catch (error) {
          console.warn('DataManager: failed to parse sync line', error);
          return;
        }

        if (msg.type === 'meta') {
          const requires = Array.isArray(msg.requires_resync) ? msg.requires_resync : [];
          if (requires.includes('visibility')) {
            needsResync = true;
          }
          return;
        }

        if (msg.type === 'checkpoint' && cursorKey && msg.cursor) {
          localStorage.setItem(cursorKey, msg.cursor);
          return;
        }

        if (msg.type === 'done' && cursorKey && msg.next_cursor) {
          localStorage.setItem(cursorKey, msg.next_cursor);
          doneReceived = true;
          return;
        }

        const table = msg.entity;
        const id = msg.id;
        if (!table || id == null) {
          return;
        }
        if (table === 'wh_tasks') {
          if (msg.type === 'delete') {
            taskDeletes.push(id);
          } else if (msg.type === 'upsert') {
            const record = msg.record;
            if (record && Object.prototype.hasOwnProperty.call(record, 'deleted_at') && record.deleted_at) {
              taskDeletes.push(id);
            } else {
              taskUpserts.push(record);
            }
          }
          if (taskUpserts.length + taskDeletes.length >= TASK_BATCH_SIZE) {
            await flushTaskBatches();
          } else {
            scheduleTaskBatchFlush();
          }
          return;
        }
        const cache = getCacheForTable(table);
        if (!cache) {
          return;
        }
        if (msg.type === 'delete') {
          await cache.remove(id);
          touchedTables.add(table);
          if (priorityTables.has(table)) {
            pendingSyncTables.add(table);
            schedulePrioritySync();
          }
          return;
        }
        if (msg.type === 'upsert') {
          await cache.add(msg.record);
          touchedTables.add(table);
          if (priorityTables.has(table)) {
            pendingSyncTables.add(table);
            schedulePrioritySync();
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          await handleLine(line);
        }
        if (doneReceived) {
          try {
            await reader.cancel();
          } catch {}
          break;
        }
      }
      if (buffer.trim()) {
        await handleLine(buffer);
      }

      await flushTaskBatches();

      await flushPendingSyncs();

      if (needsResync) {
        await this.resetCachesAndResync();
        return true;
      }

      const remaining = Array.from(touchedTables).filter((table) => !syncedTables.has(table));
      await Promise.all(remaining.map((table) => syncReduxForTable(table)));
      return true;
    } finally {
      if (taskFlushTimer) clearTimeout(taskFlushTimer);
      clearTimeout(timeout);
      try {
        controller.abort();
      } catch {}
      ApiLoadingTracker.decrement();
    }
  }
}
