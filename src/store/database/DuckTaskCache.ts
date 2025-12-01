import { DuckDB } from './DuckDB';
import api from '@/api/whagonsApi';
import type { Task } from '../types';
import { TaskEvents } from '../eventEmiters/taskEvents';
import { DuckGenericCache } from './DuckGenericCache';
import { parseUserIdsText, formatUserIdsText } from './duckCache/taskUtilities';
import { validateIntegrity } from './duckCache/integrityValidation';
import { repairFromIdRanges as repairFromIdRangesHelper } from './duckCache/dataRepair';

export interface TaskQueryParams {
  workspace_id?: number | string;
  status_id?: number | string;
  priority_id?: number | string;
  team_id?: number | string;
  category_id?: number | string;
  search?: string;
  date_from?: string;
  date_to?: string;
  updated_after?: string;
  startRow?: number;
  endRow?: number;
  sortModel?: Array<{ colId: string; sort: 'asc' | 'desc' }>;
}

export class DuckTaskCache {
  private static readonly TABLE = 'duck_tasks';
  private static cache: DuckGenericCache<Task> | null = null;
  private static populated = false;
  private static validating = false;
  private static populatePromise: Promise<void> | null = null;
  private static validationIntervalId: number | null = null;
  private static readonly VALIDATION_INTERVAL_MS = 30000;

  private static getCache(): DuckGenericCache<Task> {
    if (!this.cache) {
      this.cache = new DuckGenericCache<Task>({
        name: 'tasks',
        table: this.TABLE,
        serverTable: 'wh_tasks',
        endpoint: '/tasks',
        idField: 'id',
        columns: [
          { name: 'id', type: 'BIGINT', primaryKey: true },
          { name: 'workspace_id', type: 'BIGINT' },
          { name: 'category_id', type: 'BIGINT' },
          { name: 'team_id', type: 'BIGINT' },
          { name: 'template_id', type: 'BIGINT' },
          { name: 'spot_id', type: 'BIGINT' },
          { name: 'status_id', type: 'BIGINT' },
          { name: 'priority_id', type: 'BIGINT' },
          { name: 'name', type: 'TEXT' },
          { name: 'description', type: 'TEXT' },
          { name: 'created_at', type: 'TIMESTAMP' },
          { name: 'updated_at', type: 'TIMESTAMP' },
          { name: 'approval_id', type: 'BIGINT' },
          { name: 'approval_status', type: 'TEXT' },
          { name: 'approval_triggered_at', type: 'TIMESTAMP' },
          { name: 'approval_completed_at', type: 'TIMESTAMP' },
          { name: 'start_date', type: 'TIMESTAMP' },
          { name: 'due_date', type: 'TIMESTAMP' },
          { name: 'expected_duration', type: 'BIGINT' },
          { name: 'response_date', type: 'TIMESTAMP' },
          { name: 'resolution_date', type: 'TIMESTAMP' },
          { name: 'work_duration', type: 'BIGINT' },
          { name: 'pause_duration', type: 'BIGINT' },
          { name: 'user_ids_text', type: 'TEXT' },
          { name: 'row_hash', type: 'TEXT' },
        ] as any,
        hashFields: ['id', 'name', 'description', 'workspace_id', 'category_id', 'team_id', 'template_id', 'spot_id', 'status_id', 'priority_id', 'approval_id', 'approval_status', 'approval_triggered_at', 'approval_completed_at', 'user_ids_text', 'start_date', 'due_date', 'expected_duration', 'response_date', 'resolution_date', 'work_duration', 'pause_duration', 'updated_at'] as any,
        eventEmitter: (event, data) => {
          try {
            TaskEvents.emit(event, data);
          } catch {}
        },
        transformInput: (task: Task) => {
          const { user_ids, ...rest } = task;
          return {
            ...rest,
            user_ids_text: formatUserIdsText(user_ids),
          };
        },
        transformOutput: (row: any) => {
          const user_ids = parseUserIdsText(row.user_ids_text);
          const { user_ids_text, ...rest } = row;
          return user_ids != null ? { ...rest, user_ids } : { ...rest };
        },
      });
    }
    return this.cache;
  }

  private static log(...args: any[]) {
    try {
      if (localStorage.getItem('wh-debug-duckdb') === 'true') {
        // eslint-disable-next-line no-console
        console.log('[TaskGenericCache]', ...args);
      }
    } catch {
      // ignore
    }
  }

  public static async init(): Promise<boolean> {
    const result = await this.getCache().init();
    if (result) {
      this.startPeriodicValidation();
    }
    return result;
  }

  private static startPeriodicValidation(): void {
    if (this.validationIntervalId !== null) return;
    
    this.validate().catch((e) => {
      this.log('startPeriodicValidation: initial validation failed', e);
    });
    
    this.validationIntervalId = window.setInterval(() => {
      this.validate().catch((e) => {
        this.log('startPeriodicValidation: periodic validation failed', e);
      });
    }, this.VALIDATION_INTERVAL_MS);
    
    this.log('startPeriodicValidation: periodic validation started');
  }

  public static stopPeriodicValidation(): void {
    if (this.validationIntervalId !== null) {
      clearInterval(this.validationIntervalId);
      this.validationIntervalId = null;
      this.log('stopPeriodicValidation: periodic validation stopped');
    }
  }

  public static async replaceAllTasks(tasks: Task[]): Promise<void> {
    await this.getCache().replaceAll(tasks);
    this.triggerValidation().catch((e) => {
      this.log('replaceAllTasks: triggerValidation failed', e);
    });
  }

  public static async triggerValidation(): Promise<void> {
    await this.validate();
  }

  private static async ensurePopulated(forceReload = false): Promise<void> {
    if (this.populated && !forceReload) return;

    if (this.populatePromise) {
      await this.populatePromise;
      return;
    }

    this.populatePromise = (async () => {
      try {
        if (!forceReload) {
          const count = await this.getCache().getAll().then(r => r.length);
          if (count > 0) {
            this.populated = true;
            return;
          }
        }

        await this.bootstrapFromApi();
        this.populated = true;
      } finally {
        this.populatePromise = null;
      }
    })();

    await this.populatePromise;
  }

  public static async validate(ctx?: { serverGlobal?: string | null }): Promise<boolean> {
    const cache = this.getCache();
    return validateIntegrity({
      table: this.TABLE,
      serverTable: 'wh_tasks',
      endpoint: '/tasks',
      validating: { current: this.validating },
      init: () => cache.init(),
      getLocalRowCount: () => this.getLocalRowCount(),
      computeLocalGlobalHash: () => this.computeLocalGlobalHash(),
      repairFromIdRanges: (count) => this.repairFromIdRanges(count),
      incrementalRepairFromIntegrity: () => this.incrementalRepairFromIntegrity(null).then(() => {}),
      bootstrapFromApi: () => this.bootstrapFromApi(),
      ensurePopulated: () => this.ensurePopulated(),
      log: (...args) => this.log(...args),
      dlog: (...args) => this.log(...args),
      debugEnabled: () => {
        try { return localStorage.getItem('wh-debug-integrity') === 'true'; } catch { return false; }
      },
    }, ctx?.serverGlobal);
  }

  private static async getLocalRowCount(): Promise<number> {
    const cache = this.getCache();
    if (!(await cache.init())) return 0;
    try {
      const all = await cache.getAll();
      return all.length;
    } catch (e) {
      this.log('getLocalRowCount: error', e);
      return 0;
    }
  }

  private static async repairFromIdRanges(serverRowCount: number): Promise<void> {
    await repairFromIdRangesHelper({
      table: this.TABLE,
      serverTable: 'wh_tasks',
      endpoint: '/tasks',
      idField: 'id',
      qi: (name) => `"${name}"`,
      getLocalRowCount: () => this.getLocalRowCount(),
      fetchAll: async () => {
        await this.bootstrapFromApi();
        return true;
      },
      bulkUpsert: (rows) => this.getCache().bulkUpsert(rows),
      bootstrapFromApi: () => this.bootstrapFromApi(),
      batchFetchEndpoint: '/tasks/batch-fetch',
      log: (...args) => this.log(...args),
      dlog: (...args) => this.log(...args),
    }, serverRowCount);
  }

  private static async computeLocalGlobalHash(): Promise<string | null> {
    const cache = this.getCache();
    return (cache as any).computeLocalGlobalHash();
  }

  private static async incrementalRepairFromIntegrity(_serverGlobal: string | null): Promise<boolean> {
    const cache = this.getCache();
    if (!(await cache.init())) return false;
    await (cache as any).incrementalRepairFromIntegrity();
    return true;
  }

  public static async queryForAgGrid(params: TaskQueryParams): Promise<{ rows: any[]; rowCount: number }> {
    if (!(await this.init())) return { rows: [], rowCount: 0 };
    await this.ensurePopulated();

    const where: string[] = ['1=1'];

    const addEqFilter = (col: string, value: number | string | undefined) => {
      if (value === undefined || value === null || value === '') return;
      const n = Number(value);
      where.push(Number.isFinite(n) ? `${col} = ${n}` : `${col} = '${String(value).replace(/'/g, "''")}'`);
    };

    addEqFilter('workspace_id', params.workspace_id);
    addEqFilter('status_id', params.status_id);
    addEqFilter('priority_id', params.priority_id);
    addEqFilter('team_id', params.team_id);
    addEqFilter('category_id', params.category_id);

    if (params.date_from) {
      where.push(`created_at >= '${String(params.date_from).replace(/'/g, "''")}'`);
    }
    if (params.date_to) {
      where.push(`created_at <= '${String(params.date_to).replace(/'/g, "''")}'`);
    }
    if (params.updated_after) {
      where.push(`updated_at > '${String(params.updated_after).replace(/'/g, "''")}'`);
    }

    if (params.search && String(params.search).trim() !== '') {
      const s = String(params.search).trim().toLowerCase().replace(/'/g, "''");
      where.push(`(
        CAST(id AS VARCHAR) LIKE '%${s}%' OR
        LOWER(COALESCE(name, '')) LIKE '%${s}%' OR
        LOWER(COALESCE(description, '')) LIKE '%${s}%'
      )`);
    }

    const whereSql = where.join(' AND ');

    let orderBy = 'ORDER BY created_at DESC, id DESC';
    if (params.sortModel && params.sortModel.length > 0) {
      const parts: string[] = [];
      const sortableCols = ['id', 'workspace_id', 'category_id', 'team_id', 'template_id', 'spot_id', 'status_id', 'priority_id', 'name', 'description', 'due_date', 'created_at', 'updated_at'];
      
      for (const s of params.sortModel) {
        const col = s.colId;
        const dir = s.sort === 'asc' ? 'ASC' : 'DESC';
        if (sortableCols.includes(col)) {
          if (col === 'name' || col === 'description') {
            parts.push(`LOWER(COALESCE(${col}, '')) ${dir}`);
          } else {
            parts.push(`${col} ${dir}`);
          }
        }
      }
      if (parts.length > 0) {
        orderBy = 'ORDER BY ' + parts.join(', ');
      }
    }

    const start = params.startRow ?? 0;
    const end = params.endRow ?? start + 100;
    const limit = Math.max(0, end - start);
    const offset = Math.max(0, start);

    const countTable = await DuckDB.query(`SELECT COUNT(*)::BIGINT AS cnt FROM ${this.TABLE} WHERE ${whereSql}`);
    const countRows = countTable ? (countTable as any).toArray?.() ?? [] : [];
    const total = countRows.length > 0 ? Number(countRows[0].cnt ?? countRows[0]['cnt'] ?? 0) : 0;

    if (limit === 0 || total === 0) {
      return { rows: [], rowCount: total };
    }

    const dataTable = await DuckDB.query(`
      SELECT
        id, workspace_id, category_id, team_id, template_id, spot_id,
        status_id, priority_id, name, description, due_date,
        created_at, updated_at, user_ids_text
      FROM ${this.TABLE}
      WHERE ${whereSql}
      ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `);

    if (!dataTable) return { rows: [], rowCount: total };
    const arrowRows = (dataTable as any).toArray?.() ?? [];
    const rows = arrowRows.map((r: any) => {
      const user_ids = parseUserIdsText((r as any).user_ids_text);
      const { user_ids_text, ...rest } = r || {};
      return user_ids != null ? { ...rest, user_ids } : { ...rest };
    });

    return { rows, rowCount: total };
  }

  private static async bootstrapFromApi(): Promise<void> {
    this.log('bootstrapFromApi: fetching tasks from API');
    let allTasks: Task[] = [];
    let currentPage = 1;
    let hasNextPage = true;

    try {
      while (hasNextPage) {
        const apiParams = {
          page: currentPage,
          per_page: 2000,
          sort_by: 'id',
          sort_direction: 'asc',
        };
        const response = await api.get('/tasks', { params: apiParams });
        const pageData = response.data?.data as Task[] | undefined;
        const pagination = response.data?.pagination;

        if (pageData && pageData.length > 0) {
          const existingIds = new Set(allTasks.map((t) => (t as any).id));
          const newTasks = pageData.filter((t: any) => !existingIds.has(t.id));
          allTasks = [...allTasks, ...newTasks];
        }

        hasNextPage = !!pagination?.has_next_page;
        if (hasNextPage) {
          currentPage = pagination.next_page || currentPage + 1;
        }
      }

      if (allTasks.length > 0) {
        await this.getCache().replaceAll(allTasks);
        this.log('bootstrapFromApi: loaded tasks into DuckDB', allTasks.length);
      } else {
        this.log('bootstrapFromApi: no tasks returned from API');
      }
    } catch (e) {
      this.log('bootstrapFromApi error', e);
    }
  }

  public static async getAllTasks(): Promise<Task[]> {
    return this.getCache().getAll();
  }

  public static async upsertTask(task: Task): Promise<void> {
    await this.getCache().upsert(task);
    this.triggerValidation().catch((e) => {
      this.log('upsertTask: triggerValidation failed', e);
    });
  }

  public static async deleteTask(id: number | string): Promise<void> {
    await this.getCache().remove(id);
    this.triggerValidation().catch((e) => {
      this.log('deleteTask: triggerValidation failed', e);
    });
  }

  public static async clearAll(): Promise<void> {
    await this.getCache().replaceAll([]);
    this.populated = false;
  }

  /**
   * Debug function to compare row-by-row hashes between client and server.
   * Helps identify which rows have mismatched hashes.
   * Enable with: localStorage.setItem('wh-debug-integrity-test', 'true')
   */
  public static async debugCompareIntegrity(): Promise<void> {
    try {
      const cache = this.getCache();
      if (!(await cache.init())) {
        console.warn('[DuckTaskCache] debugCompareIntegrity: cache not initialized');
        return;
      }

      // Fetch server row hashes for first block
      const { default: api } = await import('@/api/whagonsApi');
      const serverBlocksResp = await api.get('/integrity/blocks', { params: { table: 'wh_tasks' } });
      const serverBlocks = (serverBlocksResp.data?.data ?? serverBlocksResp.data ?? []) as Array<{
        block_id: number;
        min_row_id: number;
        max_row_id: number;
      }>;

      if (serverBlocks.length === 0) {
        console.warn('[DuckTaskCache] debugCompareIntegrity: no server blocks found');
        return;
      }

      const firstBlock = serverBlocks[0];
      const blockId = Number(firstBlock.block_id);
      const minId = Number(firstBlock.min_row_id ?? blockId * 1024);
      const maxId = Number(firstBlock.max_row_id ?? (blockId + 1) * 1024 - 1);

      // Fetch server row hashes
      const serverRowsResp = await api.get(`/integrity/blocks/${blockId}/rows`, {
        params: { table: 'wh_tasks' },
      });
      const serverRows: Array<{ row_id: number; row_hash: string }> =
        (serverRowsResp.data?.data ?? serverRowsResp.data ?? []) as any[];

      // Compute local row hashes
      const localRows = await (cache as any).computeLocalRowHashesInRange(minId, maxId);

      const serverMap = new Map<number, string>();
      for (const r of serverRows) {
        const id = Number((r as any).row_id);
        const h = (r as any).row_hash;
        if (Number.isFinite(id) && h) {
          serverMap.set(id, String(h));
        }
      }

      const localMap = new Map<number, string>();
      for (const r of localRows) {
        const id = Number((r as any).row_id);
        const h = (r as any).row_hash;
        if (Number.isFinite(id) && h) {
          localMap.set(id, String(h));
        }
      }

      // Compare
      const mismatches: Array<{ id: number; serverHash: string; localHash: string }> = [];
      for (const [id, serverHash] of serverMap.entries()) {
        const localHash = localMap.get(id);
        if (!localHash || localHash !== serverHash) {
          mismatches.push({ id, serverHash, localHash: localHash || '(missing)' });
        }
      }

      console.log(`[DuckTaskCache] debugCompareIntegrity: Block ${blockId} (IDs ${minId}-${maxId})`);
      console.log(`  Server rows: ${serverMap.size}, Local rows: ${localMap.size}, Mismatches: ${mismatches.length}`);

      if (mismatches.length > 0) {
        console.warn(`[DuckTaskCache] Found ${mismatches.length} hash mismatches:`, mismatches.slice(0, 10));
        if (mismatches.length > 10) {
          console.warn(`  ... and ${mismatches.length - 10} more`);
        }
      } else {
        console.log('[DuckTaskCache] ✅ All hashes match in this block');
      }
    } catch (e) {
      console.error('[DuckTaskCache] debugCompareIntegrity error:', e);
    }
  }

  /**
   * Debug function to compare a single task's hash computation.
   */
  public static async debugCompareSingleTaskHash(): Promise<void> {
    try {
      const cache = this.getCache();
      if (!(await cache.init())) {
        return;
      }

      const { DuckDB } = await import('./DuckDB');
      const tasks = await DuckDB.query('SELECT id, name, user_ids_text FROM duck_tasks ORDER BY id LIMIT 1');
      if (!tasks) return;

      const arr = (tasks as any).toArray?.() ?? [];
      if (arr.length === 0) {
        console.warn('[DuckTaskCache] debugCompareSingleTaskHash: no tasks found');
        return;
      }

      const task = arr[0];
      console.log('[DuckTaskCache] Sample task:', {
        id: task.id,
        name: task.name,
        user_ids_text: task.user_ids_text,
      });

      // Compute local hash expression
      const rowExpr = (cache as any).buildRowExprSql();
      const hashResult = await DuckDB.query(
        `SELECT sha256(${rowExpr}) AS row_hash, ${rowExpr} AS row_expr FROM duck_tasks WHERE id = ${task.id}`
      );
      if (hashResult) {
        const hashArr = (hashResult as any).toArray?.() ?? [];
        if (hashArr.length > 0) {
          console.log('[DuckTaskCache] Local hash computation:', {
            row_expr: hashArr[0].row_expr,
            row_hash: hashArr[0].row_hash,
          });
        }
      }
    } catch (e) {
      console.error('[DuckTaskCache] debugCompareSingleTaskHash error:', e);
    }
  }
}
