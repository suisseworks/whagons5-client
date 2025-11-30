import { DuckDB } from './DuckDB';
import api from '@/api/whagonsApi';
import type { Task } from '../types';

export interface TaskQueryParams {
  workspace_id?: number | string;
  status_id?: number | string;
  priority_id?: number | string;
  team_id?: number | string;
  category_id?: number | string;
  search?: string;
  /** Optional date filters (ISO strings) */
  date_from?: string;
  date_to?: string;
  updated_after?: string;
  /** AG Grid-style windowing */
  startRow?: number;
  endRow?: number;
  /** Simplified sort model: [{ colId, sort: 'asc' | 'desc' }] */
  sortModel?: Array<{ colId: string; sort: 'asc' | 'desc' }>;
}

/**
 * Experimental DuckDB-backed task cache.
 *
 * This is a parallel cache (does NOT replace `TasksCache` yet) that stores
 * tasks in a DuckDB table and lets us query them via SQL for things like
 * AG Grid data sources.
 *
 * Naming: this is effectively a "DuckTaskCache" – a task-specific cache
 * that lives on top of DuckDB, separate from the existing IndexedDB-
 * backed `TasksCache`.
 */
export class DuckTaskCache {
  private static readonly TABLE = 'duck_tasks';
  private static readonly BLOCK_SIZE = 1024;
  private static initialized = false;
  private static populated = false;
  private static validating = false;
  // Single-flight guard so we never run the expensive bootstrap more than once
  // at the same time, even if multiple components call into the cache.
  private static populatePromise: Promise<void> | null = null;

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

  /**
   * Initialize DuckDB and ensure the tasks table exists.
   * Schema is intentionally minimal and focused on fields we typically filter/sort on.
   */
  public static async init(): Promise<boolean> {
    if (this.initialized) return true;
    const ok = await DuckDB.init();
    if (!ok) {
      this.log('DuckDB.init failed');
      return false;
    }

    // Base table (first-time creation)
    await DuckDB.exec(`
      CREATE TABLE IF NOT EXISTS ${this.TABLE} (
        id BIGINT PRIMARY KEY,
        workspace_id BIGINT,
        category_id BIGINT,
        team_id BIGINT,
        template_id BIGINT,
        spot_id BIGINT,
        status_id BIGINT,
        priority_id BIGINT,
        name TEXT,
        description TEXT,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        -- Server-provided integrity hash for this row (from /integrity/blocks/{id}/rows)
        row_hash TEXT
      )
    `);

    // Lightweight migration for existing tables that were created before row_hash existed.
    // DuckDB does not yet support "ADD COLUMN IF NOT EXISTS", so we ignore duplicate-column errors.
    try {
      await DuckDB.exec(`ALTER TABLE ${this.TABLE} ADD COLUMN row_hash TEXT`);
    } catch {
      // ignore – column already exists
    }

    this.initialized = true;
    this.log('initialized table');
    return true;
  }

  /**
   * Replace all rows in the DuckDB tasks table with the given tasks array.
   * This is intended to be called after fetching a full snapshot from the API
   * or from the existing IndexedDB TasksCache.
   */
  public static async replaceAllTasks(tasks: Task[]): Promise<void> {
    if (!(await this.init())) return;
    this.log('replaceAllTasks: count', tasks.length);

    await DuckDB.exec(`DELETE FROM ${this.TABLE}`);
    if (!tasks.length) return;

    for (const t of tasks) {
      const id = this.numOrNull((t as any).id);
      if (id === 'NULL') continue;

      const sql = `
        INSERT OR REPLACE INTO ${this.TABLE} (
          id, workspace_id, category_id, team_id, template_id, spot_id,
          status_id, priority_id, name, description, created_at, updated_at,
          row_hash
        ) VALUES (
          ${id},
          ${this.numOrNull((t as any).workspace_id)},
          ${this.numOrNull((t as any).category_id)},
          ${this.numOrNull((t as any).team_id)},
          ${this.numOrNull((t as any).template_id)},
          ${this.numOrNull((t as any).spot_id)},
          ${this.numOrNull((t as any).status_id)},
          ${this.numOrNull((t as any).priority_id)},
          ${this.textOrNull((t as any).name)},
          ${this.textOrNull((t as any).description)},
          ${this.textOrNull((t as any).created_at)},
          ${this.textOrNull((t as any).updated_at)},
          ${this.textOrNull((t as any as any).row_hash ?? (t as any).__h)}
        )
      `;
      await DuckDB.exec(sql);
    }
  }

  /**
   * Ensure the DuckDB tasks table has data.
   *
   * - On first use, if the table is empty, we bootstrap directly from the /tasks API.
   * - Subsequent calls short‑circuit once `populated` is true.
   * - A `forceReload` flag lets callers re-bootstrap when server hashes change,
   *   but still guarantees only a single in‑flight bootstrap at a time.
   */
  private static async ensurePopulated(forceReload = false): Promise<void> {
    if (this.populated && !forceReload) return;

    // Single-flight guard: if another caller is already doing the work, wait
    // for it to finish instead of starting a second bootstrap.
    if (this.populatePromise) {
      await this.populatePromise;
      return;
    }

    this.populatePromise = (async () => {
      try {
        if (!forceReload) {
          const countTable = await DuckDB.query(
            `SELECT COUNT(*)::BIGINT AS cnt FROM ${this.TABLE}`
          );
          const countRows = countTable ? (countTable as any).toArray?.() ?? [] : [];
          const total = countRows.length > 0 ? Number(countRows[0].cnt ?? 0) : 0;
          if (total > 0) {
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

  /**
   * Lightweight integrity / refresh loop for DuckDB tasks:
   *
   * - Uses /integrity/global?table=wh_tasks as a cheap "version" of the
   *   tasks table on the server.
   * - Stores the last seen global_hash in localStorage under a duckdb-
   *   specific key.
   * - When the server hash changes, we re-bootstrap the DuckDB table
   *   from /tasks via bootstrapFromApi().
   *
   * NOTE: This deliberately does NOT try to match server row hashes like
   *       TasksCache does, because DuckTaskCache only stores a subset of
   *       task columns and is meant as a read-heavy SQL index. It relies
   *       on the main TasksCache + DataManager for canonical integrity.
   */
  public static async validate(): Promise<boolean> {
    if (this.validating) {
      this.log('validate: already running, skipping re-entry');
      return true;
    }
    this.validating = true;
    try {
      if (!(await this.init())) {
        this.validating = false;
        return false;
      }

      // Ask server for current global hash of wh_tasks
      let serverGlobal: string | null | undefined = null;
      try {
        const resp = await api.get('/integrity/global', {
          params: { table: 'wh_tasks' },
        });
        const data = resp.data?.data ?? resp.data;
        serverGlobal = (data?.global_hash ?? null) as string | null;
        if (!serverGlobal) {
          // Integrity hashing not configured or table empty; just ensure we have some data locally.
          this.log('validate: no server global_hash, ensuring local population only');
          await this.ensurePopulated();
          this.validating = false;
          return true;
        }
      } catch (e: any) {
        const status = e?.response?.status;
        if (status && status >= 400 && status < 500) {
          // Endpoint missing or integrity disabled – treat as "best effort" and just ensure local table is populated.
          this.log('validate: integrity/global not available, ensuring local population', e);
          await this.ensurePopulated();
          this.validating = false;
          return true;
        }
        this.log('validate: integrity/global error, ensuring local population', e);
        await this.ensurePopulated();
        this.validating = false;
        return false;
      }

      // Compare with last-seen global hash for DuckDB tasks (version marker).
      let localGlobal: string | null = null;
      const LS_KEY = 'wh-duck-tasks-global-hash';
      try {
        localGlobal = localStorage.getItem(LS_KEY);
      } catch {
        localGlobal = null;
      }

      // Ensure we have some local data first (no-op if already populated).
      await this.ensurePopulated(false);

      // If hash unchanged, we're done: just guarantee table isn't empty.
      if (localGlobal && serverGlobal && localGlobal === serverGlobal) {
        this.log('validate: server hash unchanged, ensuring table is populated');
        await this.ensurePopulated(false);
        this.validating = false;
        return true;
      }

      // If this is the first time we've ever seen a server hash, hydrate row_hash
      // from the integrity endpoints so we can do proper block/row diffs next time.
      if (!localGlobal && serverGlobal) {
        this.log('validate: first-time hash seen; hydrating row hashes from server');
        await this.hydrateRowHashesFromServer();
        try {
          localStorage.setItem(LS_KEY, serverGlobal);
        } catch {
          // ignore
        }
        this.validating = false;
        return true;
      }

      // Hash changed → attempt incremental repair via integrity blocks/rows.
      this.log('validate: server hash changed; running incremental integrity validation');
      const success = await this.incrementalRepairFromIntegrity(serverGlobal ?? null);

      // Persist latest hash marker even if repair only partially succeeded.
      try {
        if (serverGlobal) {
          localStorage.setItem(LS_KEY, serverGlobal);
        }
      } catch {
        // ignore localStorage failures
      }

      this.validating = false;
      return success;
    } catch (e) {
      this.log('validate: unexpected error', e);
      this.validating = false;
      return false;
    }
  }

  // --- Integrity helpers ----------------------------------------------------

  /**
   * After an initial full bootstrap from /tasks, hydrate server-provided
   * row hashes into DuckDB using /integrity/blocks + /integrity/blocks/{id}/rows.
   * This lets us later perform cheap block/row diffs without recomputing hashes.
   */
  private static async hydrateRowHashesFromServer(): Promise<void> {
    if (!(await this.init())) return;

    try {
      const blocksResp = await api.get('/integrity/blocks', { params: { table: 'wh_tasks' } });
      const blocks: Array<{ block_id: number }> = blocksResp.data?.data ?? blocksResp.data ?? [];
      if (!blocks || !blocks.length) {
        this.log('hydrateRowHashesFromServer: no integrity blocks returned');
        return;
      }

      for (const blk of blocks) {
        const blockId = Number((blk as any).block_id ?? (blk as any).blockId ?? blk);
        if (!Number.isFinite(blockId)) continue;

        const rowsResp = await api.get(`/integrity/blocks/${blockId}/rows`, {
          params: { table: 'wh_tasks' },
        });
        const rows: Array<{ row_id: number; row_hash: string }> =
          rowsResp.data?.data ?? rowsResp.data ?? [];
        if (!rows || !rows.length) continue;

        // Update row_hash for all rows in this block.
        for (const r of rows) {
          const id = Number((r as any).row_id);
          const h = (r as any).row_hash;
          if (!Number.isFinite(id) || !h) continue;
          const idSql = `${id}`;
          const hashSql = this.textOrNull(h);
          await DuckDB.exec(
            `UPDATE ${this.TABLE} SET row_hash = ${hashSql} WHERE id = ${idSql}`
          );
        }
      }
    } catch (e) {
      this.log('hydrateRowHashesFromServer error', e);
    }
  }

  /**
   * Compute local integrity blocks from stored server row hashes in DuckDB.
   * Mirrors the backend strategy: block_id = floor(id / BLOCK_SIZE),
   * block_hash = sha256(string_agg(row_hash ORDER BY id)).
   */
  private static async computeLocalBlocksFromRowHashes(): Promise<
    Array<{
      block_id: number;
      min_row_id: number;
      max_row_id: number;
      row_count: number;
      block_hash: string;
    }>
  > {
    if (!(await this.init())) return [];

    const sql = `
      WITH rows AS (
        SELECT
          id,
          CAST(FLOOR(id / ${this.BLOCK_SIZE}) AS BIGINT) AS block_id,
          row_hash
        FROM ${this.TABLE}
        WHERE id IS NOT NULL AND row_hash IS NOT NULL
      )
      SELECT
        block_id,
        MIN(id)::BIGINT AS min_row_id,
        MAX(id)::BIGINT AS max_row_id,
        COUNT(*)::BIGINT AS row_count,
        sha256(string_agg(row_hash, '' ORDER BY id)) AS block_hash
      FROM rows
      GROUP BY block_id
      ORDER BY block_id
    `;

      const table = await DuckDB.query(sql);
      if (!table) return [];
      const arr = (table as any).toArray?.() ?? [];
      return arr
        .map((r: any) => ({
          block_id: Number(r.block_id),
          min_row_id: Number(r.min_row_id),
          max_row_id: Number(r.max_row_id),
          row_count: Number(r.row_count ?? 0),
          block_hash: String(r.block_hash),
        }))
        .filter((b: { block_id: number }) => Number.isFinite(b.block_id));
  }

  /**
   * Incrementally repair the DuckDB tasks table by comparing local blocks
   * (built from stored row_hash) against server integrity blocks, and then
   * refetching only changed/missing rows by ID.
   */
  private static async incrementalRepairFromIntegrity(
    _serverGlobal: string | null
  ): Promise<boolean> {
    try {
      if (!(await this.init())) return false;

      const localBlocks = await this.computeLocalBlocksFromRowHashes();

      // Fetch server blocks snapshot
      let serverBlocksResp = await api.get('/integrity/blocks', {
        params: { table: 'wh_tasks' },
      });
      let serverBlocks: Array<{
        block_id: number;
        block_hash: string;
        min_row_id: number;
        max_row_id: number;
        row_count: number;
      }> = serverBlocksResp.data?.data ?? serverBlocksResp.data ?? [];

      // If server has no hashes yet, trigger a rebuild once and retry (best-effort)
      if ((!serverBlocks || !serverBlocks.length) && localBlocks.length > 0) {
        try {
          await api.post('/integrity/rebuild', { table: 'wh_tasks' });
          serverBlocksResp = await api.get('/integrity/blocks', {
            params: { table: 'wh_tasks' },
          });
          serverBlocks = serverBlocksResp.data?.data ?? serverBlocksResp.data ?? [];
          if (!serverBlocks || !serverBlocks.length) return true;
        } catch {
          return true;
        }
      }

      const localMap = new Map(localBlocks.map((b) => [b.block_id, b]));
      const mismatchedBlocks: number[] = [];

      for (const sb of serverBlocks) {
        const blkId = Number((sb as any).block_id);
        if (!Number.isFinite(blkId)) continue;
        const lb = localMap.get(blkId);
        const sHash = String((sb as any).block_hash ?? '');
        const sCount = Number((sb as any).row_count ?? 0);
        if (
          !lb ||
          !lb.block_hash ||
          lb.block_hash !== sHash ||
          lb.row_count !== sCount
        ) {
          mismatchedBlocks.push(blkId);
        }
      }

      // Also consider blocks we have locally that server no longer has
      const serverBlockIds = new Set(
        serverBlocks.map((sb: any) => Number(sb.block_id)).filter((n) => Number.isFinite(n))
      );
      for (const lb of localBlocks) {
        if (!serverBlockIds.has(lb.block_id)) {
          mismatchedBlocks.push(lb.block_id);
        }
      }

      if (!mismatchedBlocks.length) {
        this.log('incrementalRepairFromIntegrity: blocks equal; nothing to repair');
        return true;
      }

      // For each mismatched block, diff row hashes and refetch changed IDs
      const uniqueBlocks = Array.from(new Set(mismatchedBlocks));
      for (const blockId of uniqueBlocks) {
        const sb = serverBlocks.find(
          (b: any) => Number(b.block_id) === Number(blockId)
        );

        const serverRowsResp = await api.get(`/integrity/blocks/${blockId}/rows`, {
          params: { table: 'wh_tasks' },
        });
        const serverRows: Array<{ row_id: number; row_hash: string }> =
          serverRowsResp.data?.data ?? serverRowsResp.data ?? [];
        const serverRowMap = new Map<number, string>();
        for (const r of serverRows) {
          const id = Number((r as any).row_id);
          const h = (r as any).row_hash;
          if (!Number.isFinite(id) || !h) continue;
          serverRowMap.set(id, String(h));
        }

        // Local rows in this block (bounded either by server's min/max or BLOCK_SIZE range)
        let minId: number;
        let maxId: number;
        if (sb && Number.isFinite(Number((sb as any).min_row_id))) {
          minId = Number((sb as any).min_row_id);
          maxId = Number((sb as any).max_row_id);
        } else {
          const base = blockId * this.BLOCK_SIZE;
          minId = base;
          maxId = base + this.BLOCK_SIZE - 1;
        }

        const localRowsTable = await DuckDB.query(`
          SELECT id, row_hash
          FROM ${this.TABLE}
          WHERE id >= ${minId} AND id <= ${maxId}
        `);
        const localRowsArr = localRowsTable ? (localRowsTable as any).toArray?.() ?? [] : [];
        const localRowMap = new Map<number, string>();
        for (const r of localRowsArr) {
          const id = Number((r as any).id);
          const h = (r as any).row_hash;
          if (!Number.isFinite(id)) continue;
          localRowMap.set(id, h ? String(h) : '');
        }

        const toRefetch: number[] = [];

        // Compare rows present locally
        for (const [rowId, localHash] of localRowMap.entries()) {
          const sh = serverRowMap.get(rowId);
          if (!sh || !localHash || sh !== localHash) {
            toRefetch.push(rowId);
          }
        }

        // Rows present on server but missing locally
        for (const [rowId] of serverRowMap.entries()) {
          if (!localRowMap.has(rowId)) {
            toRefetch.push(rowId);
          }
        }

        // Refetch changed/missing rows in chunks via /tasks?ids=...
        if (toRefetch.length > 0) {
          this.log('incrementalRepairFromIntegrity: refetch ids', {
            blockId,
            count: toRefetch.length,
          });
          const chunkSize = 200;
          for (let i = 0; i < toRefetch.length; i += chunkSize) {
            const ids = toRefetch.slice(i, i + chunkSize);
            try {
              const resp = await api.get('/tasks', {
                params: {
                  ids: ids.join(','),
                  per_page: ids.length,
                  page: 1,
                },
              });
              const rows = (resp.data?.data ?? resp.data?.rows ?? []) as Task[];
              if (rows && rows.length) {
                const rowsWithHash = rows.map((r: any) => {
                  const h = serverRowMap.get(Number(r.id));
                  return h ? { ...r, row_hash: h, __h: h } : r;
                });
                await this.replaceAllOrUpsertTasks(rowsWithHash as Task[]);
              }
            } catch (e) {
              this.log('incrementalRepairFromIntegrity: batch fetch failed', e);
            }
          }
        }

        // Cleanup: delete local tasks not present in server block rows
        const serverIds = new Set<number>(Array.from(serverRowMap.keys()));
        for (const localId of Array.from(localRowMap.keys())) {
          if (!serverIds.has(localId)) {
            await this.deleteTask(localId);
          }
        }
      }

      this.log('incrementalRepairFromIntegrity: completed');
      return true;
    } catch (e) {
      this.log('incrementalRepairFromIntegrity: unexpected error', e);
      return false;
    }
  }

  /**
   * Run a simple SQL-backed query that mirrors the core of TasksCache.queryTasks
   * but leverages DuckDB instead of in-memory JS + IndexedDB.
   *
   * This is intentionally minimal for now: workspace/status/priority filters,
   * basic search on id/name/description, sorting, and windowed pagination.
   */
  public static async queryForAgGrid(params: TaskQueryParams): Promise<{ rows: any[]; rowCount: number }> {
    if (!(await this.init())) return { rows: [], rowCount: 0 };
    // Always go through validate() so we consult integrity hashes before
    // resorting to any heavy /tasks bootstrap or repairs.
    await this.validate();

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

    // Created-at range filters
    if (params.date_from) {
      where.push(`created_at >= ${this.textOrNull(params.date_from)}`);
    }
    if (params.date_to) {
      where.push(`created_at <= ${this.textOrNull(params.date_to)}`);
    }

    // Updated-after filter (used for "completed today" style stats)
    if (params.updated_after) {
      where.push(`updated_at > ${this.textOrNull(params.updated_after)}`);
    }

    if (params.search && String(params.search).trim() !== '') {
      const s = String(params.search).trim().toLowerCase().replace(/'/g, "''");
      // Basic search over id (stringified), name, description
      where.push(`
        (
          CAST(id AS VARCHAR) LIKE '%${s}%' OR
          LOWER(COALESCE(name, '')) LIKE '%${s}%' OR
          LOWER(COALESCE(description, '')) LIKE '%${s}%'
        )
      `);
    }

    const whereSql = where.join(' AND ');

    // Sorting
    let orderBy = 'ORDER BY created_at DESC, id DESC';
    if (params.sortModel && params.sortModel.length > 0) {
      const parts: string[] = [];
      for (const s of params.sortModel) {
        const col = s.colId;
        const dir = s.sort === 'asc' ? 'ASC' : 'DESC';
        // Only allow known columns to avoid SQL injection / typos
        if (['id', 'created_at', 'updated_at', 'priority_id', 'status_id', 'workspace_id'].includes(col)) {
          parts.push(`${col} ${dir}`);
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

    // Count total first
    const countTable = await DuckDB.query(
      `SELECT COUNT(*)::BIGINT AS cnt FROM ${this.TABLE} WHERE ${whereSql}`
    );
    const countRows = countTable ? (countTable as any).toArray?.() ?? [] : [];
    const total = countRows.length > 0 ? Number(countRows[0].cnt ?? countRows[0]['cnt'] ?? 0) : 0;

    if (limit === 0 || total === 0) {
      return { rows: [], rowCount: total };
    }

    const dataTable = await DuckDB.query(
      `
        SELECT
          id,
          workspace_id,
          category_id,
          team_id,
          template_id,
          spot_id,
          status_id,
          priority_id,
          name,
          description,
          created_at,
          updated_at
        FROM ${this.TABLE}
        WHERE ${whereSql}
        ${orderBy}
        LIMIT ${limit} OFFSET ${offset}
      `
    );

    if (!dataTable) return { rows: [], rowCount: total };
    const arrowRows = (dataTable as any).toArray?.() ?? [];
    // Arrow rows are already JS objects keyed by column name in duckdb-wasm
    const rows = arrowRows.map((r: any) => ({ ...r }));

    return { rows, rowCount: total };
  }

  // --- Helpers -------------------------------------------------------------
  /**
   * Fetch all tasks directly from the API and load them into DuckDB.
   * This mirrors the behavior of TasksCache.fetchTasks but avoids
   * going through IndexedDB.
   */
  private static async bootstrapFromApi(): Promise<void> {
    this.log('bootstrapFromApi: fetching tasks from API');
    let allTasks: Task[] = [];
    let currentPage = 1;
    let hasNextPage = true;

    try {
      while (hasNextPage) {
        const apiParams = {
          page: currentPage,
          per_page: 500,
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
        await this.replaceAllTasks(allTasks);
        this.log('bootstrapFromApi: loaded tasks into DuckDB', allTasks.length);
      } else {
        this.log('bootstrapFromApi: no tasks returned from API');
      }
    } catch (e) {
      this.log('bootstrapFromApi error', e);
    }
  }

  private static numOrNull(v: any): string {
    if (v === null || v === undefined || v === '') return 'NULL';
    const n = Number(v);
    return Number.isFinite(n) ? `${n}` : 'NULL';
  }

  private static textOrNull(v: any): string {
    if (v === null || v === undefined) return 'NULL';
    const s = String(v);
    if (!s.length) return 'NULL';
    const escaped = s.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  /**
   * Return all tasks currently stored in the DuckDB table.
   * Used by Redux thunks and cache registries that need a full snapshot.
   */
  public static async getAllTasks(): Promise<Task[]> {
    if (!(await this.init())) return [];
    // Same as AG Grid path: ensure integrity-driven validation runs first.
    await this.validate();
    const table = await DuckDB.query(
      `
        SELECT
          id,
          workspace_id,
          category_id,
          team_id,
          template_id,
          spot_id,
          status_id,
          priority_id,
          name,
          description,
          created_at,
          updated_at
        FROM ${this.TABLE}
      `
    );
    if (!table) return [];
    const rows = (table as any).toArray?.() ?? [];
    return rows as Task[];
  }

  /**
   * Incremental upsert helper used by the TasksCache compatibility wrapper
   * and real-time listeners. Mirrors the INSERT logic from replaceAllTasks.
   */
  public static async upsertTask(task: any): Promise<void> {
    if (!(await this.init())) return;
    const id = this.numOrNull((task as any).id);
    if (id === 'NULL') return;

    const sql = `
      INSERT OR REPLACE INTO ${this.TABLE} (
        id, workspace_id, category_id, team_id, template_id, spot_id,
        status_id, priority_id, name, description, created_at, updated_at,
        row_hash
      ) VALUES (
        ${id},
        ${this.numOrNull((task as any).workspace_id)},
        ${this.numOrNull((task as any).category_id)},
        ${this.numOrNull((task as any).team_id)},
        ${this.numOrNull((task as any).template_id)},
        ${this.numOrNull((task as any).spot_id)},
        ${this.numOrNull((task as any).status_id)},
        ${this.numOrNull((task as any).priority_id)},
        ${this.textOrNull((task as any).name)},
        ${this.textOrNull((task as any).description)},
        ${this.textOrNull((task as any).created_at)},
        ${this.textOrNull((task as any).updated_at)},
        ${this.textOrNull((task as any).row_hash ?? (task as any).__h)}
      )
    `;
    await DuckDB.exec(sql);
  }

  /**
   * Delete a single task by id from DuckDB.
   */
  public static async deleteTask(id: number | string): Promise<void> {
    if (!(await this.init())) return;
    const n = Number(id);
    const idSql = Number.isFinite(n) ? `${n}` : `'${String(id).replace(/'/g, "''")}'`;
    await DuckDB.exec(`DELETE FROM ${this.TABLE} WHERE id = ${idSql}`);
  }

  /**
   * Clear all tasks from DuckDB.
   */
  public static async clearAll(): Promise<void> {
    if (!(await this.init())) return;
    await DuckDB.exec(`DELETE FROM ${this.TABLE}`);
    this.populated = false;
  }

  /**
   * Helper used by incrementalRepairFromIntegrity to upsert batches of tasks
   * without wiping the entire table. It reuses the upsertTask path.
   */
  private static async replaceAllOrUpsertTasks(tasks: Task[]): Promise<void> {
    if (!(await this.init())) return;
    for (const t of tasks) {
      await this.upsertTask(t as any);
    }
  }
}


