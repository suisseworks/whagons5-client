import { DuckDB } from './DuckDB';
import api from '@/api/whagonsApi';
import type { Task } from '../types';
import { TaskEvents } from '../eventEmiters/taskEvents';

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
  // Periodic validation: runs every 30 seconds in the background
  private static validationIntervalId: number | null = null;
  private static readonly VALIDATION_INTERVAL_MS = 30000; // 30 seconds

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
   * Also starts periodic validation timer if not already running.
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
        -- Extended columns to compute server-compatible row hashes locally
        approval_id BIGINT,
        approval_status TEXT,
        approval_triggered_at TIMESTAMP,
        approval_completed_at TIMESTAMP,
        start_date TIMESTAMP,
        due_date TIMESTAMP,
        expected_duration BIGINT,
        response_date TIMESTAMP,
        resolution_date TIMESTAMP,
        work_duration BIGINT,
        pause_duration BIGINT,
        user_ids_text TEXT,
        -- Server-provided integrity hash for this row (from /integrity/blocks/{id}/rows) or locally computed
        row_hash TEXT
      )
    `);

    // Lightweight migrations: add columns if older tables exist without them
    const addCol = async (col: string, type: string) => {
      try {
        const exists = await this.columnExists(col);
        if (!exists) {
          await DuckDB.exec(`ALTER TABLE ${this.TABLE} ADD COLUMN "${col}" ${type}`, { suppressErrorLog: true });
        }
      } catch {}
    };
    await addCol('row_hash', 'TEXT');
    await addCol('approval_id', 'BIGINT');
    await addCol('approval_status', 'TEXT');
    await addCol('approval_triggered_at', 'TIMESTAMP');
    await addCol('approval_completed_at', 'TIMESTAMP');
    await addCol('start_date', 'TIMESTAMP');
    await addCol('due_date', 'TIMESTAMP');
    await addCol('expected_duration', 'BIGINT');
    await addCol('response_date', 'TIMESTAMP');
    await addCol('resolution_date', 'TIMESTAMP');
    await addCol('work_duration', 'BIGINT');
    await addCol('pause_duration', 'BIGINT');
    await addCol('user_ids_text', 'TEXT');

    this.initialized = true;
    this.log('initialized table');
    
    // Start periodic validation timer (runs every 30 seconds)
    this.startPeriodicValidation();
    
    return true;
  }

  /**
   * Start periodic validation timer that runs every 30 seconds.
   * Validation runs in the background and doesn't block queries.
   */
  private static startPeriodicValidation(): void {
    // Only start if not already running
    if (this.validationIntervalId !== null) return;
    
    // Run validation immediately on mount
    this.validate().catch((e) => {
      this.log('startPeriodicValidation: initial validation failed', e);
    });
    
    // Then run every 30 seconds
    this.validationIntervalId = window.setInterval(() => {
      this.validate().catch((e) => {
        this.log('startPeriodicValidation: periodic validation failed', e);
      });
    }, this.VALIDATION_INTERVAL_MS);
    
    this.log('startPeriodicValidation: periodic validation started (every', this.VALIDATION_INTERVAL_MS / 1000, 'seconds)');
  }

  /**
   * Stop periodic validation timer.
   */
  public static stopPeriodicValidation(): void {
    if (this.validationIntervalId !== null) {
      clearInterval(this.validationIntervalId);
      this.validationIntervalId = null;
      this.log('stopPeriodicValidation: periodic validation stopped');
    }
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
    if (!tasks.length) {
      // Trigger immediate validation even if replacing with empty set
      this.triggerValidation().catch((e) => {
        this.log('replaceAllTasks: triggerValidation failed', e);
      });
      return;
    }
    await this.bulkUpsertTasks(tasks);
    // Trigger immediate validation since we've replaced all data
    this.triggerValidation().catch((e) => {
      this.log('replaceAllTasks: triggerValidation failed', e);
    });
    // Emit cache invalidation event to trigger stats refresh
    try { TaskEvents.emit(TaskEvents.EVENTS.CACHE_INVALIDATE); } catch {}
  }

  /**
   * Trigger immediate validation (bypasses the periodic timer).
   * Call this when you know tasks have changed (e.g., after create/update/delete)
   * to ensure data consistency without waiting for the next periodic check.
   */
  public static async triggerValidation(): Promise<void> {
    await this.validate();
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
   * 
   * This is called periodically (every 30 seconds) by the validation timer,
   * not as part of queries. Queries should never call this directly.
   */
  public static async validate(ctx?: { serverGlobal?: string | null }): Promise<boolean> {
    if (this.validating) {
      this.log('validate: already running, skipping re-entry');
      return true;
    }
    
    // Debug gate to disable any network activity; trust local DuckDB only
    try {
      if (localStorage.getItem('wh-disable-fetch') === 'true') {
        this.log('validate: network disabled via wh-disable-fetch; skipping integrity calls');
        this.validating = false;
        return true;
      }
    } catch {}
    this.validating = true;
    try {
      if (!(await this.init())) {
        this.validating = false;
        return false;
      }

      // Ask server for current global hash of wh_tasks when not provided by caller.
      let serverGlobal: string | null | undefined =
        ctx && Object.prototype.hasOwnProperty.call(ctx, 'serverGlobal')
          ? ctx.serverGlobal
          : undefined;
      if (serverGlobal === undefined) {
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
      } else if (serverGlobal === null) {
        // Explicit hint from caller that integrity is disabled for this table.
        this.log('validate: server global explicitly null, skipping integrity and ensuring population');
        await this.ensurePopulated();
        this.validating = false;
        return true;
      }

      // Compute local global hash from current DuckDB rows.
      // Note: localGlobal can be null when the table is empty; that should still
      // proceed to integrity comparison and incremental repair.
      const localGlobal = await this.computeLocalGlobalHash();

      this.log('validate: global compare', {
        table: 'wh_tasks',
        equal: Boolean(serverGlobal && localGlobal && serverGlobal === localGlobal),
        serverGlobal: (serverGlobal || '').slice(0, 16),
        localGlobal: (localGlobal || '').slice(0, 16),
      });

      if (serverGlobal && localGlobal && serverGlobal === localGlobal) {
        // Perfect match – nothing to do.
        this.validating = false;
        return true;
      }

      // Global mismatch or empty local (null) with server integrity available:
      // run incremental repair via integrity blocks/rows and refetch only changed ids.
      this.log('validate: global hash mismatch, running incremental repair', {
        serverGlobal: (serverGlobal || '').slice(0, 16),
        localGlobal: (localGlobal || '').slice(0, 16),
      });
      const success = await this.incrementalRepairFromIntegrity(serverGlobal ?? null);

      this.validating = false;
      return success;
    } catch (e) {
      this.log('validate: unexpected error', e);
      // Don't update cache on error - force re-validation next time
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
   * Compute local server-compatible row hashes for all rows using DuckDB and cache into row_hash.
   */
  private static async computeAllLocalRowHashes(): Promise<void> {
    if (!(await this.init())) return;
    // Compute user_ids_text for rows where it's null (no-op if absent). Expect values pre-filled on insert.
    // Compute row_hash with server-compatible canonicalization.
    const sql = `
      UPDATE ${this.TABLE}
      SET row_hash = sha256(concat_ws('|',
        id,
        COALESCE(name,''),
        COALESCE(description,''),
        workspace_id,
        category_id,
        team_id,
        COALESCE(template_id,0),
        COALESCE(spot_id,0),
        status_id,
        priority_id,
        COALESCE(approval_id,0),
        COALESCE(approval_status,''),
        COALESCE(CAST(CAST(epoch(approval_triggered_at) * 1000 AS BIGINT) AS VARCHAR),''),
        COALESCE(CAST(CAST(epoch(approval_completed_at) * 1000 AS BIGINT) AS VARCHAR),''),
        COALESCE(user_ids_text,''),
        COALESCE(CAST(CAST(epoch(start_date) * 1000 AS BIGINT) AS VARCHAR),''),
        COALESCE(CAST(CAST(epoch(due_date) * 1000 AS BIGINT) AS VARCHAR),''),
        CAST(expected_duration AS VARCHAR),
        COALESCE(CAST(CAST(epoch(response_date) * 1000 AS BIGINT) AS VARCHAR),''),
        COALESCE(CAST(CAST(epoch(resolution_date) * 1000 AS BIGINT) AS VARCHAR),''),
        CAST(work_duration AS VARCHAR),
        CAST(pause_duration AS VARCHAR),
        CAST(CAST(epoch(updated_at) * 1000 AS BIGINT) AS VARCHAR)
      ))
    `;
    try {
      await DuckDB.exec(sql);
    } catch (e) {
      this.log('computeAllLocalRowHashes error', e);
    }
  }

  /**
   * Compute a single global hash over all rows in this DuckDB table using
   * DuckDB's sha256, following the same "row-hash then concat" pattern
   * as the backend:
   *
   * global = sha256( string_agg( sha256(row_expr), '' ORDER BY id ) )
   */
  private static async computeLocalGlobalHash(): Promise<string | null> {
    if (!(await this.init())) return null;

    // Ensure row hashes are computed
    await this.computeAllLocalRowHashes();

    const sql = `
      WITH rows AS (
        SELECT
          id AS row_id,
          row_hash
        FROM ${this.TABLE}
        WHERE id IS NOT NULL AND row_hash IS NOT NULL
      )
      SELECT
        COUNT(*)::BIGINT AS row_count,
        sha256(string_agg(row_hash, '' ORDER BY row_id)) AS global_hash
      FROM rows
    `;

    const table = await DuckDB.query(sql);
    if (!table) return null;
    const arr = (table as any).toArray?.() ?? [];
    if (!arr.length) return null;

    const row = arr[0];
    const rowCount = Number(row?.row_count ?? 0);
    const hash = row?.global_hash;
    if (!rowCount || !hash) return null;
    return String(hash);
  }

  /**
   * Compute local integrity blocks from stored server or local row hashes in DuckDB.
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

      // Ensure local row_hashes are populated to compute blocks
      await this.computeAllLocalRowHashes();

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
        // Only mark as mismatched if block hash or count differs
        // This avoids unnecessary row hash fetches when blocks are identical
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

      // Optimized approach: Fetch missing tasks FIRST, then check hashes only for existing tasks
      // 1. Collect all server IDs from mismatched blocks (just IDs, not hashes yet)
      // 2. Find and fetch all missing tasks immediately (no hash checking needed)
      // 3. Then fetch row hashes and check only for tasks we already have locally
      
      const uniqueBlocks = Array.from(new Set(mismatchedBlocks));
      
      // Step 1: Collect all server row IDs from mismatched blocks (we need IDs to find missing)
      // We'll fetch row hashes here but use them later for hash checking
      const blockRowHashPromises = uniqueBlocks.map(async (blockId) => {
        try {
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
          return { blockId, serverRowMap };
        } catch (e) {
          this.log('incrementalRepairFromIntegrity: failed to fetch row hashes for block', { blockId, error: e });
          return { blockId, serverRowMap: new Map<number, string>() };
        }
      });
      
      const blockRowHashResults = await Promise.all(blockRowHashPromises);
      const blockRowHashMap = new Map(blockRowHashResults.map(r => [r.blockId, r.serverRowMap]));
      
      // Collect all server IDs to check what we're missing locally
      const allServerIds = new Set<number>();
      for (const { serverRowMap } of blockRowHashResults) {
        for (const id of serverRowMap.keys()) {
          allServerIds.add(id);
        }
      }
      
      // Step 2: Convert local IDs to ranges and find missing IDs efficiently (BEFORE hash checking)
      const allLocalIdsTable = await DuckDB.query(`
        SELECT DISTINCT id 
        FROM ${this.TABLE} 
        WHERE id IS NOT NULL 
        ORDER BY id ASC
      `);
      const allLocalIdsArr = allLocalIdsTable ? (allLocalIdsTable as any).toArray?.() ?? [] : [];
      const sortedLocalIds = allLocalIdsArr
        .map((r: any) => Number(r.id))
        .filter((n: number) => Number.isFinite(n))
        .sort((a: number, b: number) => a - b);
      
      // Convert sorted IDs to ranges for efficient transmission
      const localRanges: Array<{ start: number; end: number }> = [];
      if (sortedLocalIds.length > 0) {
        let rangeStart = sortedLocalIds[0];
        let rangeEnd = sortedLocalIds[0];
        
        for (let i = 1; i < sortedLocalIds.length; i++) {
          const currentId = sortedLocalIds[i];
          // If current ID is consecutive, extend the range
          if (currentId === rangeEnd + 1) {
            rangeEnd = currentId;
          } else {
            // Gap found, save current range and start new one
            localRanges.push({ start: rangeStart, end: rangeEnd });
            rangeStart = currentId;
            rangeEnd = currentId;
          }
        }
        // Don't forget the last range
        localRanges.push({ start: rangeStart, end: rangeEnd });
      }
      
      // Determine the overall range to check (from server IDs)
      const serverIdsArray = Array.from(allServerIds).sort((a, b) => a - b);
      const minServerId = serverIdsArray.length > 0 ? serverIdsArray[0] : null;
      const maxServerId = serverIdsArray.length > 0 ? serverIdsArray[serverIdsArray.length - 1] : null;
      
      // Step 3: Use range-based endpoint to find missing IDs efficiently (BEFORE hash checking)
      let missingIds: number[] = [];
      if (localRanges.length > 0 && minServerId !== null && maxServerId !== null) {
        try {
          this.log('incrementalRepairFromIntegrity: finding missing IDs using ranges (before hash check)', {
            rangesCount: localRanges.length,
            minId: minServerId,
            maxId: maxServerId,
          });
          
          const resp = await api.post('/tasks/find-missing', {
            ranges: localRanges,
            min_id: minServerId,
            max_id: maxServerId,
          });
          
          missingIds = (resp.data?.missing_ids ?? []) as number[];
          this.log('incrementalRepairFromIntegrity: found missing IDs', {
            count: missingIds.length,
          });
        } catch (e) {
          this.log('incrementalRepairFromIntegrity: range-based find failed, falling back to local comparison', { error: e });
          // Fallback: compare locally if range endpoint fails
          const allLocalIds = new Set(sortedLocalIds);
          missingIds = Array.from(allServerIds).filter(id => !allLocalIds.has(id));
        }
      } else {
        // No local ranges or server IDs, fallback to simple comparison
        const allLocalIds = new Set(sortedLocalIds);
        missingIds = Array.from(allServerIds).filter(id => !allLocalIds.has(id));
      }
      
      // Step 4: Fetch all missing tasks FIRST (before checking hashes for existing tasks)
      if (missingIds.length > 0) {
        this.log('incrementalRepairFromIntegrity: fetching missing tasks', {
          count: missingIds.length,
        });
        
        const batchSize = 10000; // POST endpoint supports up to 10,000 IDs
        const missingBatches: number[][] = [];
        for (let i = 0; i < missingIds.length; i += batchSize) {
          missingBatches.push(missingIds.slice(i, i + batchSize));
        }
        
        // Fetch all missing tasks in parallel batches
        const missingFetchPromises = missingBatches.map(async (ids) => {
          try {
            const resp = await api.post('/tasks/batch-fetch', { ids });
            const rows = (resp.data?.data ?? []) as Task[];
            if (rows && rows.length) {
              // Get row hashes from serverRowMap for these missing tasks
              const rowsWithHash = rows.map((r: any) => {
                // Find which block this task belongs to and get its hash
                let hash: string | null = null;
                for (const { serverRowMap } of blockRowHashResults) {
                  if (serverRowMap.has(Number(r.id))) {
                    hash = serverRowMap.get(Number(r.id)) ?? null;
                    break;
                  }
                }
                return {
                  ...r,
                  row_hash: hash,
                  user_ids_text: this.formatUserIdsText((r as any)?.user_ids),
                };
              });
              return rowsWithHash as Task[];
            }
            return [];
          } catch (e) {
            this.log('incrementalRepairFromIntegrity: batch fetch missing tasks failed', { ids: ids.length, error: e });
            return [];
          }
        });
        
        const missingResults = await Promise.all(missingFetchPromises);
        const allMissingRows: Task[] = missingResults.flat();
        if (allMissingRows.length > 0) {
          await this.replaceAllOrUpsertTasks(allMissingRows);
          await this.computeAllLocalRowHashes();
          this.log('incrementalRepairFromIntegrity: fetched missing tasks (before hash check)', { count: allMissingRows.length });
        }
      }
      
      // Step 5: NOW check hashes only for tasks we already have locally (changed tasks)
      // Missing tasks are already fetched above, so we only need to check for hash mismatches
      for (const blockId of uniqueBlocks) {
        const sb = serverBlocks.find(
          (b: any) => Number(b.block_id) === Number(blockId)
        );

        const serverRowMap = blockRowHashMap.get(blockId) ?? new Map<number, string>();
        if (serverRowMap.size === 0) {
          this.log('incrementalRepairFromIntegrity: skipping block with no row hashes', { blockId });
          continue;
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

        // Only check hashes for tasks we already have locally (changed tasks, not missing)
        const changedIds: number[] = [];
        for (const [rowId, localHash] of localRowMap.entries()) {
          const sh = serverRowMap.get(rowId);
          if (!sh || !localHash || sh !== localHash) {
            changedIds.push(rowId);
          }
        }

        // Refetch changed tasks (hash mismatch) - these are tasks we have but are outdated
        if (changedIds.length > 0) {
          this.log('incrementalRepairFromIntegrity: refetch changed tasks', {
            blockId,
            count: changedIds.length,
          });
          
          // Use POST batch endpoint for changed tasks too (more efficient than GET)
          const changedBatchSize = 10000;
          for (let i = 0; i < changedIds.length; i += changedBatchSize) {
            const ids = changedIds.slice(i, i + changedBatchSize);
            try {
              const resp = await api.post('/tasks/batch-fetch', { ids });
              const rows = (resp.data?.data ?? []) as Task[];
              if (rows && rows.length) {
                const rowsWithHash = rows.map((r: any) => {
                  const h = serverRowMap.get(Number(r.id));
                  return {
                    ...r,
                    row_hash: h ?? null,
                    user_ids_text: this.formatUserIdsText((r as any)?.user_ids),
                  };
                });
                await this.replaceAllOrUpsertTasks(rowsWithHash as Task[]);
              }
            } catch (e) {
              this.log('incrementalRepairFromIntegrity: batch fetch changed tasks failed', { ids: ids.length, error: e });
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
      
      // Final hash recomputation after all updates
      await this.computeAllLocalRowHashes();

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
    // Ensure data is populated before querying (will short-circuit if already populated)
    await this.ensurePopulated();
    // Validation runs periodically in the background (every 30 seconds)
    // and on mount. Queries should never call validate() directly.

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
        // Allow sorting by any column that exists in the table
        // These match the columns in the SELECT statement below
        if (['id', 'workspace_id', 'category_id', 'team_id', 'template_id', 'spot_id', 'status_id', 'priority_id', 'name', 'description', 'due_date', 'created_at', 'updated_at'].includes(col)) {
          // For text fields (name, description), use case-insensitive sorting
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
          due_date,
          created_at,
          updated_at,
          user_ids_text
        FROM ${this.TABLE}
        WHERE ${whereSql}
        ${orderBy}
        LIMIT ${limit} OFFSET ${offset}
      `
    );

    if (!dataTable) return { rows: [], rowCount: total };
    const arrowRows = (dataTable as any).toArray?.() ?? [];
    // Arrow rows are already JS objects keyed by column name in duckdb-wasm
    const rows = arrowRows.map((r: any) => {
      const user_ids = this.parseUserIdsText((r as any).user_ids_text);
      const { user_ids_text, ...rest } = r || {};
      return user_ids != null ? { ...rest, user_ids } : { ...rest };
    });

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
        await this.replaceAllTasks(allTasks);
        // After initial load, compute local row hashes so block/global can be computed entirely locally
        await this.computeAllLocalRowHashes();
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

  private static parseUserIdsText(text: any): number[] | null {
    if (text == null) return null;
    const s = String(text).trim();
    if (!s) return null;
    // Expect format like "[1,2,3]"; tolerate whitespace
    const m = s.match(/^\[\s*([0-9,\s]*)\s*\]$/);
    if (!m) return null;
    const list = m[1]
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isFinite(n));
    return list.length ? list : [];
  }

  private static formatUserIdsText(ids: any): string | null {
    if (!Array.isArray(ids)) return null;
    const nums = ids
      .map((x: any) => Number(x))
      .filter((n: number) => Number.isFinite(n))
      .sort((a: number, b: number) => a - b);
    return nums.length ? `[${nums.join(',')}]` : '[]';
  }

  /**
   * Return all tasks currently stored in the DuckDB table.
   * Used by Redux thunks and cache registries that need a full snapshot.
   */
  public static async getAllTasks(): Promise<Task[]> {
    if (!(await this.init())) return [];
    // Validation runs periodically in the background (every 30 seconds)
    // and on mount. Queries should never call validate() directly.
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
          due_date,
          created_at,
          updated_at,
          user_ids_text
        FROM ${this.TABLE}
      `
    );
    if (!table) return [];
    const rows = (table as any).toArray?.() ?? [];
    const mapped = rows.map((r: any) => {
      const user_ids = this.parseUserIdsText((r as any).user_ids_text);
      const { user_ids_text, ...rest } = r || {};
      return user_ids != null ? { ...rest, user_ids } : { ...rest };
    });
    return mapped as Task[];
  }

  /**
   * Incremental upsert helper used by the TasksCache compatibility wrapper
   * and real-time listeners. Mirrors the INSERT logic from replaceAllTasks.
   */
  public static async upsertTask(task: any): Promise<void> {
    if (!(await this.init())) return;
    const id = this.numOrNull((task as any).id);
    if (id === 'NULL') return;

    // Check if task already exists to determine if it's a create or update
    const existing = await DuckDB.query(`SELECT id FROM ${this.TABLE} WHERE id = ${id}`);
    const exists = existing && (existing as any).toArray?.().length > 0;
    const isCreate = !exists;

    const sql = `
      INSERT OR REPLACE INTO ${this.TABLE} (
        id, workspace_id, category_id, team_id, template_id, spot_id,
        status_id, priority_id, name, description, created_at, updated_at,
        approval_id, approval_status, approval_triggered_at, approval_completed_at,
        start_date, due_date, expected_duration, response_date, resolution_date,
        work_duration, pause_duration, user_ids_text,
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
        ${this.numOrNull((task as any).approval_id)},
        ${this.textOrNull((task as any).approval_status)},
        ${this.textOrNull((task as any).approval_triggered_at)},
        ${this.textOrNull((task as any).approval_completed_at)},
        ${this.textOrNull((task as any).start_date)},
        ${this.textOrNull((task as any).due_date)},
        ${this.numOrNull((task as any).expected_duration)},
        ${this.textOrNull((task as any).response_date)},
        ${this.textOrNull((task as any).resolution_date)},
        ${this.numOrNull((task as any).work_duration)},
        ${this.numOrNull((task as any).pause_duration)},
        ${this.textOrNull(this.formatUserIdsText((task as any)?.user_ids))},
        ${this.textOrNull((task as any as any).row_hash ?? (task as any).__h)}
      )
    `;
    await DuckDB.exec(sql);
    
    // Trigger immediate validation since we've modified data locally
    // This ensures we catch any conflicts without waiting for the periodic check
    this.triggerValidation().catch((e) => {
      this.log('upsertTask: triggerValidation failed', e);
    });
    
    // Emit event to trigger stats refresh
    try {
      if (isCreate) {
        TaskEvents.emit(TaskEvents.EVENTS.TASK_CREATED, task);
      } else {
        TaskEvents.emit(TaskEvents.EVENTS.TASK_UPDATED, task);
      }
    } catch {}
  }

  /**
   * Bulk upsert tasks using multi-row VALUES for performance.
   */
  private static async bulkUpsertTasks(tasks: Task[], chunkSize = 2000): Promise<void> {
    if (!(await this.init())) return;
    if (!tasks.length) return;
    const cols =
      'id, workspace_id, category_id, team_id, template_id, spot_id, status_id, priority_id, name, description, created_at, updated_at, approval_id, approval_status, approval_triggered_at, approval_completed_at, start_date, due_date, expected_duration, response_date, resolution_date, work_duration, pause_duration, user_ids_text, row_hash';
    for (let i = 0; i < tasks.length; i += chunkSize) {
      const chunk = tasks.slice(i, i + chunkSize);
      const tuples: string[] = [];
      for (const t of chunk) {
        const id = this.numOrNull((t as any).id);
        if (id === 'NULL') continue;
        const vals = [
          id,
          this.numOrNull((t as any).workspace_id),
          this.numOrNull((t as any).category_id),
          this.numOrNull((t as any).team_id),
          this.numOrNull((t as any).template_id),
          this.numOrNull((t as any).spot_id),
          this.numOrNull((t as any).status_id),
          this.numOrNull((t as any).priority_id),
          this.textOrNull((t as any).name),
          this.textOrNull((t as any).description),
          this.textOrNull((t as any).created_at),
          this.textOrNull((t as any).updated_at),
          this.numOrNull((t as any).approval_id),
          this.textOrNull((t as any).approval_status),
          this.textOrNull((t as any).approval_triggered_at),
          this.textOrNull((t as any).approval_completed_at),
          this.textOrNull((t as any).start_date),
          this.textOrNull((t as any).due_date),
          this.numOrNull((t as any).expected_duration),
          this.textOrNull((t as any).response_date),
          this.textOrNull((t as any).resolution_date),
          this.numOrNull((t as any).work_duration),
          this.numOrNull((t as any).pause_duration),
          this.textOrNull(this.formatUserIdsText((t as any)?.user_ids)),
          this.textOrNull((t as any as any).row_hash ?? (t as any).__h),
        ];
        tuples.push(`(${vals.join(', ')})`);
      }
      if (!tuples.length) continue;
      const sql = `INSERT OR REPLACE INTO ${this.TABLE} (${cols}) VALUES ${tuples.join(', ')}`;
      await DuckDB.exec(sql);
    }
  }

  /**
   * Delete a single task by id from DuckDB.
   */
  public static async deleteTask(id: number | string): Promise<void> {
    if (!(await this.init())) return;
    const n = Number(id);
    const idSql = Number.isFinite(n) ? `${n}` : `'${String(id).replace(/'/g, "''")}'`;
    await DuckDB.exec(`DELETE FROM ${this.TABLE} WHERE id = ${idSql}`);
    // Trigger immediate validation since we've modified data locally
    this.triggerValidation().catch((e) => {
      this.log('deleteTask: triggerValidation failed', e);
    });
    // Emit event to trigger stats refresh
    try { TaskEvents.emit(TaskEvents.EVENTS.TASK_DELETED, { id: n }); } catch {}
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
    await this.bulkUpsertTasks(tasks);
    // Emit bulk update event to trigger stats refresh after incremental repair
    try { TaskEvents.emit(TaskEvents.EVENTS.TASKS_BULK_UPDATE); } catch {}
  }

  /**
   * Debug helper: compare server row hash vs locally computed hash for one random task.
   * Enable by calling from app mount guarded by a debug flag.
   */
  public static async debugCompareSingleTaskHash(): Promise<void> {
    try {
      if (!(await this.init())) return;
      // Pick a random block with rows
      const blocksResp = await api.get('/integrity/blocks', { params: { table: 'wh_tasks' } });
      const blocks: Array<{ block_id: number; row_count?: number }> =
        blocksResp.data?.data ?? blocksResp.data ?? [];
      if (!blocks || !blocks.length) {
        console.warn('[DuckTaskCache] debugCompareSingleTaskHash: no integrity blocks');
        return;
      }
      const nonEmpty = blocks.filter((b: any) => Number(b.row_count ?? 0) > 0);
      const pickBlocks = nonEmpty.length ? nonEmpty : blocks;
      const rndBlock = pickBlocks[Math.floor(Math.random() * pickBlocks.length)];
      const blockId = Number((rndBlock as any).block_id);
      if (!Number.isFinite(blockId)) {
        console.warn('[DuckTaskCache] debugCompareSingleTaskHash: invalid block id', rndBlock);
        return;
      }
      // Get rows in the block
      const rowsResp = await api.get(`/integrity/blocks/${blockId}/rows`, { params: { table: 'wh_tasks' } });
      const rows: Array<{ row_id: number; row_hash: string }> = rowsResp.data?.data ?? rowsResp.data ?? [];
      if (!rows || !rows.length) {
        console.warn('[DuckTaskCache] debugCompareSingleTaskHash: no rows in block', blockId);
        return;
      }
      const rndRow = rows[Math.floor(Math.random() * rows.length)];
      const taskId = Number((rndRow as any).row_id);
      const serverHash = String((rndRow as any).row_hash ?? '');
      if (!Number.isFinite(taskId) || !serverHash) {
        console.warn('[DuckTaskCache] debugCompareSingleTaskHash: invalid picked row', rndRow);
        return;
      }
      // Fetch the task payload from API
      let task: any | null = null;
      try {
        const resp = await api.get('/tasks', { params: { ids: String(taskId), per_page: 1, page: 1 } });
        const list = (resp.data?.data ?? resp.data?.rows ?? []) as any[];
        task = Array.isArray(list) && list.length ? list[0] : null;
      } catch (e) {
        console.warn('[DuckTaskCache] debugCompareSingleTaskHash: failed to fetch task by id', { taskId, error: e });
      }
      // Compute local hash based on server trigger canonicalization
      const localHash = task ? await this.computeTaskRowHash(task) : '';
      // Read the locally stored server row_hash in DuckDB (if any)
      let storedHash = '';
      try {
        const tbl = await DuckDB.query(`SELECT row_hash FROM ${this.TABLE} WHERE id = ${taskId}`);
        const arr = tbl ? (tbl as any).toArray?.() ?? [] : [];
        storedHash = arr.length ? String(arr[0].row_hash ?? '') : '';
      } catch {
        // ignore
      }

      // Log comparison
      console.log('[TaskHashDebug] Compare single task', {
        taskId,
        serverHash,
        localHash,
        localEqualsServer: Boolean(localHash && serverHash && localHash === serverHash),
        storedHash,
        storedEqualsServer: Boolean(storedHash && serverHash && storedHash === serverHash),
        storedEqualsLocal: Boolean(storedHash && localHash && storedHash === localHash),
        hasTaskPayload: Boolean(task),
        sampleTaskKeys: task ? Object.keys(task).slice(0, 20) : [],
      });
    } catch (e) {
      console.warn('[DuckTaskCache] debugCompareSingleTaskHash error', e);
    }
  }

  /**
   * Debug helper: compare local vs server block hashes and global hash, then print results.
   * Attempts to hydrate row_hashes if none exist locally to enable a fair comparison.
   */
  public static async debugCompareIntegrity(): Promise<void> {
    try {
      if (!(await this.init())) return;
      // Ensure local data exists
      await this.ensurePopulated(false);
      // Compute local row hashes for all rows before comparing
      await this.computeAllLocalRowHashes();
      // Ensure we have local row_hashes to compute blocks
      const localBlocks = await this.computeLocalBlocksFromRowHashes();
      const localConcat = localBlocks.map(b => b.block_hash).join('');
      let localGlobal: string | null = null;
      if (localBlocks.length) {
        const t = await DuckDB.query(`SELECT sha256(${this.textOrNull(localConcat)}) AS g`);
        const a = t ? (t as any).toArray?.() ?? [] : [];
        localGlobal = a.length ? String(a[0].g ?? '') : null;
      }

      // Server blocks and global
      let serverBlocks: Array<{ block_id: number; block_hash: string; row_count: number }> = [];
      let serverGlobal: string | null = null;
      try {
        const blocksResp = await api.get('/integrity/blocks', { params: { table: 'wh_tasks' } });
        serverBlocks = blocksResp.data?.data ?? blocksResp.data ?? [];
      } catch {}
      try {
        const globalResp = await api.get('/integrity/global', { params: { table: 'wh_tasks' } });
        const gd = globalResp.data?.data ?? globalResp.data;
        serverGlobal = (gd?.global_hash ?? null) as string | null;
      } catch {}

      // Compare blocks
      const localMap = new Map(localBlocks.map(b => [Number(b.block_id), b]));
      const serverMap = new Map(serverBlocks.map(b => [Number((b as any).block_id), b]));
      const mismatches: Array<{
        blockId: number;
        reason: 'missing_local' | 'missing_server' | 'hash' | 'count';
        local?: any;
        server?: any;
      }> = [];

      for (const [bid, sb] of serverMap.entries()) {
        const lb = localMap.get(bid);
        if (!lb) {
          mismatches.push({ blockId: bid, reason: 'missing_local', server: sb });
          continue;
        }
        const sHash = String((sb as any).block_hash ?? '');
        const sCount = Number((sb as any).row_count ?? 0);
        if (lb.block_hash !== sHash) {
          mismatches.push({ blockId: bid, reason: 'hash', local: lb, server: sb });
        } else if (Number(lb.row_count) !== sCount) {
          mismatches.push({ blockId: bid, reason: 'count', local: lb, server: sb });
        }
      }
      for (const [bid, lb] of localMap.entries()) {
        if (!serverMap.has(bid)) {
          mismatches.push({ blockId: bid, reason: 'missing_server', local: lb });
        }
      }

      console.log('[TaskHashDebug] Integrity summary', {
        global: {
          local: localGlobal,
          server: serverGlobal,
          equal: Boolean(localGlobal && serverGlobal && localGlobal === serverGlobal),
        },
        blocks: {
          localCount: localBlocks.length,
          serverCount: serverBlocks.length,
          equal:
            serverBlocks.length === localBlocks.length &&
            mismatches.length === 0 &&
            Boolean(localGlobal && serverGlobal && localGlobal === serverGlobal),
          mismatches: mismatches.slice(0, 20),
        },
      });
    } catch (e) {
      console.warn('[DuckTaskCache] debugCompareIntegrity error', e);
    }
  }

  private static async columnExists(column: string): Promise<boolean> {
    try {
      const t = await DuckDB.query(`PRAGMA table_info('${this.TABLE}')`);
      const arr = t ? (t as any).toArray?.() ?? [] : [];
      return arr.some((r: any) => {
        const name = String(r.name ?? r.column_name ?? r.column ?? r.columnname ?? '');
        return name === column;
      });
    } catch {
      return false;
    }
  }

  private static async computeTaskRowHash(row: any): Promise<string> {
    const parts: string[] = [];
    const push = (v: any, opts?: { coalesceTo?: any; isEpochTs?: boolean }) => {
      let val = v;
      if (val === null || val === undefined) {
        if (opts && Object.prototype.hasOwnProperty.call(opts, 'coalesceTo')) {
          val = opts.coalesceTo;
        }
      }
      if (opts?.isEpochTs) {
        parts.push(this.toEpochMsString(val));
        return;
      }
      if (Array.isArray(val)) {
        // For user_ids we need a bracketed, comma-separated numeric list without spaces
        const nums = val
          .map((x: any) => Number(x))
          .filter((n: number) => Number.isFinite(n))
          .sort((a: number, b: number) => a - b);
        parts.push(nums.length ? `[${nums.join(',')}]` : '');
        return;
      }
      // Booleans: Postgres casts true/false to 't'/'f' when concatenated as text
      if (typeof val === 'boolean') {
        parts.push(val ? 't' : 'f');
        return;
      }
      if (val === null || val === undefined) {
        parts.push('');
        return;
      }
      parts.push(String(val));
    };

    // Keep exact server field order
    push(row.id);
    push(row.name ?? '');
    push(row.description ?? '');
    push(row.workspace_id);
    push(row.category_id);
    push(row.team_id);
    push(row.template_id, { coalesceTo: 0 });
    push(row.spot_id, { coalesceTo: 0 });
    push(row.status_id);
    push(row.priority_id);
    push(row.approval_id, { coalesceTo: 0 });
    push(row.approval_status ?? '');
    push(row.approval_triggered_at, { isEpochTs: true });
    push(row.approval_completed_at, { isEpochTs: true });
    // user_ids: array -> stable bracketed list
    push(Array.isArray(row.user_ids) ? row.user_ids : null);
    push(row.start_date, { isEpochTs: true });
    push(row.due_date, { isEpochTs: true });
    push(row.expected_duration);
    push(row.response_date, { isEpochTs: true });
    push(row.resolution_date, { isEpochTs: true });
    push(row.work_duration);
    push(row.pause_duration);
    push(row.updated_at, { isEpochTs: true });

    const joined = parts.join('|');
    if (!(await this.init())) return '';
    const tbl = await DuckDB.query(`SELECT sha256(${this.textOrNull(joined)}) AS h`);
    const arr = tbl ? (tbl as any).toArray?.() ?? [] : [];
    return arr.length ? String(arr[0].h ?? '') : '';
  }

  private static toEpochMsString(v: any): string {
    if (!v) return '';
    let s = String(v);
    // If timestamp lacks timezone, assume UTC and force 'Z'
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s) && !/[zZ]|[+\-]\d{2}:?\d{2}$/.test(s)) {
      s = s.replace(' ', 'T') + 'Z';
    }
    const d = new Date(s);
    const ms = d.getTime();
    return Number.isFinite(ms) ? String(ms) : '';
  }
}


