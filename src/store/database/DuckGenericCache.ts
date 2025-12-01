import { DuckDB } from './DuckDB';
import api from '@/api/whagonsApi';

export type DuckDBColumnType =
  | 'BIGINT'
  | 'INT'
  | 'DOUBLE'
  | 'BOOLEAN'
  | 'TEXT'
  | 'TIMESTAMP';

export interface DuckColumn<T> {
  /** Column name, must be a key of the entity type. */
  name: keyof T & string;
  /** DuckDB column type. */
  type: DuckDBColumnType;
  /** Optional PRIMARY KEY flag. Only one column should have this. */
  primaryKey?: boolean;
}

export interface DuckGenericCacheOptions<T> {
  /** Logical name for this cache (for debugging/logging). */
  name: string;
  /** SQL table name inside DuckDB (e.g., 'wh_statuses_cache'). */
  table: string;
  /** Server table name used by integrity endpoints (e.g., 'wh_statuses'). */
  serverTable: string;
  /** REST resource path (e.g., '/statuses') used for remote sync. */
  endpoint: string;
  /**
   * Column definitions used both to construct the DuckDB table schema
   * and to drive INSERT/UPDATE operations. This is where you "encode"
   * the TypeScript type into a DuckDB schema.
   */
  columns: DuckColumn<T>[];
  /** Field name to use as primary key when ingesting rows (defaults to first primaryKey or 'id'). */
  idField?: keyof T & string;
  /**
   * Optional list of fields used to build local row hashes that match
   * backend integrity triggers.
   */
  hashFields?: Array<keyof T & string>;
}

/**
 * Experimental DuckDB-backed generic cache.
 *
 * This is analogous in *purpose* to `GenericCache`, but:
 * - Data is stored in DuckDB, not IndexedDB.
 * - Rows are stored in **structured columns**, not as JSON blobs.
 *
 * NOTE: This cache is not yet wired into the app; it's a building block
 * for future experiments where we want SQL over cached data. We
 * intentionally do NOT expose a `getAll()` – callers should use SQL.
 */
export class DuckGenericCache<T = any> {
  private readonly name: string;
  private readonly table: string;
  private readonly serverTable: string;
  private readonly endpoint: string;
  private readonly schemaSql: string;
  private readonly idField: keyof T & string;
  private readonly columns: Array<keyof T & string>;
  private readonly columnDefs: DuckColumn<T>[];
  private readonly hashFields?: Array<keyof T & string>;
  private initialized = false;
  private validating = false;

  constructor(options: DuckGenericCacheOptions<T>) {
    this.name = options.name;
    this.table = options.table;
    this.serverTable = options.serverTable;
    this.endpoint = options.endpoint;
    this.columns = options.columns.map((c) => c.name);
    this.columnDefs = options.columns;
    this.hashFields = options.hashFields;

    const primary = options.columns.find((c) => c.primaryKey)?.name;
    this.idField = (options.idField ?? (primary ?? 'id')) as keyof T & string;

    // Auto-generate a structured schema from the typed column config
    const defs = options.columns.map((c) => {
      const pk = c.primaryKey ? ' PRIMARY KEY' : '';
      return `${this.qi(c.name)} ${c.type}${pk}`;
    });
    this.schemaSql = `(${defs.join(', ')})`;
  }

  /** Server table name used by integrity tooling / CacheRegistry. */
  public getTableName(): string {
    return this.serverTable;
  }

  private log(...args: any[]) {
    try {
      if (localStorage.getItem('wh-debug-duckdb') === 'true') {
        // eslint-disable-next-line no-console
        console.log(`[DuckGenericCache:${this.name}]`, ...args);
      }
    } catch {
      // ignore
    }
  }

  private get debug(): boolean {
    try {
      return localStorage.getItem('wh-debug-integrity') === 'true';
    } catch {
      return false;
    }
  }

  private dlog(...args: any[]) {
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log(`[DuckGenericCache:${this.name}]`, ...args);
    }
  }

  /**
   * Ensure DuckDB is ready and the backing table exists.
   */
  public async init(): Promise<boolean> {
    if (this.initialized) return true;
    const ok = await DuckDB.init();
    if (!ok) {
      this.log('DuckDB.init failed, cannot initialize cache');
      return false;
    }
    await DuckDB.exec(`CREATE TABLE IF NOT EXISTS ${this.table} ${this.schemaSql}`);
    this.initialized = true;
    this.log('initialized table');
    return true;
  }

  /**
   * Fast emptiness check to decide whether we need a bootstrap fetch when
   * integrity is not configured on the server for this table.
   */
  // (removed; no longer needed)

  /**
   * Read all rows from this DuckDB table.
   * NOTE: Callers should avoid this for very large tables and prefer
   * windowed SQL queries instead.
   */
  public async getAll(): Promise<T[]> {
    if (!(await this.init())) return [];
    const table = await DuckDB.query(`SELECT * FROM ${this.table}`);
    const rows = table ? ((table as any).toArray?.() ?? []) : [];
    // Normalize all ID fields to JavaScript numbers to avoid type mismatches
    // (e.g., BigInt/string vs number) in Redux comparisons/selectors.
    const normalized = rows.map((r: any) => this.normalizeRowIds(r)) as T[];
    return normalized;
  }

  /**
   * Clear and replace all rows in this cache with the provided array.
   * Rows are written using the structured column list defined for this cache.
   */
  public async replaceAll(rows: T[]): Promise<void> {
    if (!(await this.init())) return;
    this.log('replaceAll: rows', rows.length);

    await DuckDB.exec(`DELETE FROM ${this.table}`);
    if (!rows.length) return;
    await this.bulkUpsert(rows);
  }

  /**
   * Upsert a single row into the cache.
   */
  public async upsert(row: T): Promise<void> {
    if (!(await this.init())) return;
    const idVal = (row as any)?.[this.idField];
    if (idVal === undefined || idVal === null) {
      this.log('upsert: skipping row without id field', {
        idField: this.idField,
        row,
      });
      return;
    }
    const idNumeric = Number(idVal);
    const idLiteral = Number.isFinite(idNumeric)
      ? `${idNumeric}`
      : `'${String(idVal).replace(/'/g, "''")}'`;

    const cols: string[] = [];
    const vals: string[] = [];
    for (const col of this.columns) {
      cols.push(this.qi(col));
      if (col === this.idField) {
        vals.push(idLiteral);
      } else {
        vals.push(this.toSqlLiteral((row as any)[col]));
      }
    }

    const sql = `INSERT OR REPLACE INTO ${this.table} (${cols.join(
      ', '
    )}) VALUES (${vals.join(', ')})`;
    await DuckDB.exec(sql);
  }

  /**
   * Bulk upsert rows using multi-values INSERT for performance.
   * Automatically chunks the operation to avoid excessively large SQL statements.
   */
  public async bulkUpsert(rows: T[], chunkSize = 500): Promise<void> {
    if (!(await this.init())) return;
    if (!rows.length) return;

    const colsList = this.columns.map((c) => this.qi(c)).join(', ');
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const valuesTuples: string[] = [];
      for (const row of chunk) {
        const idVal = (row as any)?.[this.idField];
        if (idVal === undefined || idVal === null) continue;
        const idNumeric = Number(idVal);
        const idLiteral = Number.isFinite(idNumeric)
          ? `${idNumeric}`
          : `'${String(idVal).replace(/'/g, "''")}'`;

        const vals: string[] = [];
        for (const col of this.columns) {
          if (col === this.idField) {
            vals.push(idLiteral);
          } else {
            vals.push(this.toSqlLiteral((row as any)[col]));
          }
        }
        valuesTuples.push(`(${vals.join(', ')})`);
      }
      if (valuesTuples.length === 0) continue;
      const sql = `INSERT OR REPLACE INTO ${this.table} (${colsList}) VALUES ${valuesTuples.join(', ')}`;
      await DuckDB.exec(sql);
    }
  }

  /**
   * Delete a row by id.
   */
  public async remove(id: number | string): Promise<void> {
    if (!(await this.init())) return;
    const idNumeric = Number(id);
    const idLiteral = Number.isFinite(idNumeric)
      ? `${idNumeric}`
      : `'${String(id).replace(/'/g, "''")}'`;
    await DuckDB.exec(`DELETE FROM ${this.table} WHERE id = ${idLiteral}`);
  }

  /**
   * Alias helpers to match the old GenericCache API used by genericSliceFactory
   * and CacheRegistry.
   */
  public async add(row: T): Promise<void> {
    await this.upsert(row);
  }

  public async update(_id: number | string, row: T): Promise<void> {
    await this.upsert(row);
  }

  // --- Remote CRUD + sync ---------------------------------------------------

  /**
   * Create on server and return created row (tries common REST response shapes).
   * NOTE: Does NOT automatically upsert into DuckDB; callers should do so.
   */
  public async createRemote(row: Partial<T>): Promise<T> {
    const resp = await api.post(this.endpoint, row);
    const created = (resp.data?.data ?? resp.data?.row ?? resp.data) as T;
    return created;
  }

  /**
   * Update on server and return updated row.
   * NOTE: Does NOT automatically upsert into DuckDB; callers should do so.
   */
  public async updateRemote(id: number | string, updates: Partial<T>): Promise<T> {
    const resp = await api.patch(`${this.endpoint}/${id}`, updates);
    const updated = (resp.data?.data ?? resp.data?.row ?? resp.data) as T;
    return updated;
  }

  /**
   * Delete on server.
   * NOTE: Does NOT automatically delete from DuckDB; callers should do so.
   */
  public async deleteRemote(id: number | string): Promise<boolean> {
    await api.delete(`${this.endpoint}/${id}`);
    return true;
  }

  /**
   * Fetch all rows from the REST endpoint and fully refresh the local DuckDB table.
   * On success:
   *   - DELETE FROM table
   *   - INSERT/REPLACE all fetched rows using the structured schema
   *
   * On error:
   *   - keep existing local data intact.
   */
  public async fetchAll(params: Record<string, any> = {}): Promise<boolean> {
    try {
      const resp = await api.get(this.endpoint, { params });
      const raw = resp.data;
      const rows = (raw?.rows ?? raw?.data ?? raw) as T[];

      if (!Array.isArray(rows)) {
        this.log('fetchAll: response is not an array', { type: typeof rows, raw });
        return false;
      }

      if (resp.status < 200 || resp.status >= 300) {
        this.log('fetchAll: non-success status, skipping update', resp.status);
        return false;
      }

      if (!(await this.init())) return false;
      this.log('fetchAll: replacing rows', rows.length);

      await DuckDB.exec(`DELETE FROM ${this.table}`);
      for (const row of rows) {
        await this.upsert(row);
      }

      return true;
    } catch (e) {
      this.log('fetchAll error', e);
      return false;
    }
  }

  // --- Integrity (simplified, global-hash only) -----------------------------

  /**
   * Very small first-pass integrity check modeled after GenericCache:
   *
   * - If no local rows: bootstrap via fetchAll().
   * - Else:
   *   - Compute local global hash from hashFields (or stable JSON) in JS.
   *   - Compare with /integrity/global?table=serverTable.
   *   - If equal → done; if mismatch → full refresh via fetchAll().
   *
   * This intentionally skips block/row-level diffs for now to keep the
   * Duck path simple; it can be extended later to mirror GenericCache
   * exactly using DuckDB.query for block windows.
   */
  public async validate(ctx?: { serverGlobal?: string | null }): Promise<boolean> {
    if (this.validating) {
      this.dlog('validate: already running');
      return true;
    }
    this.validating = true;
    try {
      if (!(await this.init())) {
        this.validating = false;
        return false;
      }

      // Compute local global hash from current DuckDB rows using DuckDB's sha256.
      // Note: localGlobal can be null when the table is empty; that should still
      // proceed to integrity comparison and incremental repair.
      const localGlobal = await this.computeLocalGlobalHash();

      // Ask server for current global hash when not provided.
      let serverGlobal: string | undefined | null = ctx?.serverGlobal;
      if (serverGlobal === undefined) {
        try {
          const globalResp = await api.get('/integrity/global', {
            params: { table: this.serverTable },
          });
          const data = globalResp.data?.data ?? globalResp.data;
          serverGlobal = (data?.global_hash ?? null) as string | undefined | null;

          // If endpoint is present but integrity hashing is not configured for this table,
          // keep existing data and skip further validation (no bootstrap here).
          if (!serverGlobal) {
            this.dlog('validate: integrity hashing not configured for table (skipping)', {
              table: this.serverTable,
              data,
            });
            this.validating = false;
            return true;
          }
        } catch (e: any) {
          const status = e?.response?.status;
          if (status && status >= 400 && status < 500) {
            // 4xx → treat as "no integrity for this table", keep data.
            this.dlog('validate: integrity endpoint not available (skipping)', {
              table: this.serverTable,
              status,
            });
            this.validating = false;
            return true;
          }
          this.dlog('validate: integrity/global request failed, skipping', e);
          this.validating = false;
          return false;
        }
      } else if (serverGlobal === null) {
        // Explicit signal from caller that integrity is not configured.
        this.dlog('validate: server global explicitly null (no integrity, skipping)', {
          table: this.serverTable,
        });
        this.validating = false;
        return true;
      }

      this.dlog('validate: global compare', {
        table: this.serverTable,
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
      this.dlog('validate: global hash mismatch, running incremental repair', {
        table: this.serverTable,
      });
      await this.incrementalRepairFromIntegrity();
      this.validating = false;
      return true;
    } catch (e) {
      this.dlog('validate: error', e);
      this.validating = false;
      return false;
    }
  }

  /**
   * Incrementally repair local DuckDB table by comparing computed local block hashes
   * against server integrity blocks, then refetching only changed/missing rows by id.
   */
  private async incrementalRepairFromIntegrity(): Promise<void> {
    if (!(await this.init())) return;

    // Compute local blocks from computed row hashes
    const localBlocks = await this.computeLocalBlocksFromRowExpr();

    // Fetch server blocks
    let serverBlocksResp;
    let serverBlocks: Array<{ block_id: number; block_hash: string; min_row_id: number; max_row_id: number; row_count: number }> = [];
    try {
      serverBlocksResp = await api.get('/integrity/blocks', { params: { table: this.serverTable } });
      serverBlocks = (serverBlocksResp.data?.data ?? serverBlocksResp.data ?? []) as typeof serverBlocks;
    } catch (e: any) {
      // If integrity endpoint not available, bail (keep current data)
      const status = e?.response?.status;
      if (status && status >= 400) {
        this.dlog('incrementalRepairFromIntegrity: integrity endpoint not available; skipping', { table: this.serverTable, status });
        return;
      }
      throw e;
    }

    // If server has no blocks, nothing to compare; skip to avoid destructive behavior
    if (!serverBlocks || serverBlocks.length === 0) {
      this.dlog('incrementalRepairFromIntegrity: no server blocks; skipping');
      return;
    }

    const localMap = new Map(localBlocks.map((b) => [b.block_id, b]));
    const mismatchedBlocks: number[] = [];

    for (const sb of serverBlocks) {
      const blkId = Number((sb as any).block_id);
      if (!Number.isFinite(blkId)) continue;
      const lb = localMap.get(blkId);
      const sHash = String((sb as any).block_hash ?? '');
      const sCount = Number((sb as any).row_count ?? 0);
      if (!lb || !lb.block_hash || lb.block_hash !== sHash || lb.row_count !== sCount) {
        mismatchedBlocks.push(blkId);
      }
    }
    // Also consider local blocks that the server no longer has
    const serverBlockIds = new Set(serverBlocks.map((sb: any) => Number(sb.block_id)).filter((n) => Number.isFinite(n)));
    for (const lb of localBlocks) {
      if (!serverBlockIds.has(lb.block_id)) {
        mismatchedBlocks.push(lb.block_id);
      }
    }

    if (!mismatchedBlocks.length) {
      this.dlog('incrementalRepairFromIntegrity: blocks equal; nothing to repair');
      return;
    }

    const uniqueBlocks = Array.from(new Set(mismatchedBlocks));
    for (const blockId of uniqueBlocks) {
      const sb = serverBlocks.find((b: any) => Number(b.block_id) === Number(blockId));
      let minId: number;
      let maxId: number;
      if (sb && Number.isFinite(Number((sb as any).min_row_id))) {
        minId = Number((sb as any).min_row_id);
        maxId = Number((sb as any).max_row_id);
      } else {
        const BLOCK_SIZE = 1024;
        const base = blockId * BLOCK_SIZE;
        minId = base;
        maxId = base + BLOCK_SIZE - 1;
      }

      // Server rows + hashes for this block
      const serverRowsResp = await api.get(`/integrity/blocks/${blockId}/rows`, {
        params: { table: this.serverTable },
      });
      const serverRows: Array<{ row_id: number; row_hash: string }> =
        (serverRowsResp.data?.data ?? serverRowsResp.data ?? []) as any[];
      const serverRowMap = new Map<number, string>();
      for (const r of serverRows) {
        const id = Number((r as any).row_id);
        const h = (r as any).row_hash;
        if (!Number.isFinite(id) || !h) continue;
        serverRowMap.set(id, String(h));
      }

      // Local rows + computed hashes in the same id window
      const localRows = await this.computeLocalRowHashesInRange(minId, maxId);
      const localRowMap = new Map<number, string>();
      for (const r of localRows) {
        const id = Number((r as any).row_id);
        const h = (r as any).row_hash;
        if (!Number.isFinite(id)) continue;
        localRowMap.set(id, h ? String(h) : '');
      }

      // Diff
      const toRefetch: number[] = [];
      for (const [rowId, localHash] of localRowMap.entries()) {
        const sh = serverRowMap.get(rowId);
        if (!sh || !localHash || sh !== localHash) {
          toRefetch.push(rowId);
        }
      }
      for (const [rowId] of serverRowMap.entries()) {
        if (!localRowMap.has(rowId)) {
          toRefetch.push(rowId);
        }
      }

      if (toRefetch.length > 0) {
        const chunk = 1000;
        const fetchedIds = new Set<number>();
        for (let i = 0; i < toRefetch.length; i += chunk) {
          const ids = toRefetch.slice(i, i + chunk);
          try {
            const resp = await api.get(this.endpoint, {
              params: {
                ids: ids.join(','),
                per_page: ids.length,
                page: 1,
              },
            });
            const rows = (resp.data?.data ?? resp.data?.rows ?? []) as Array<Record<string, any>>;
            if (rows && rows.length) {
              // Track fetched ids
              for (const r of rows) {
                const idNum = Number((r as any)[this.idField]);
                if (Number.isFinite(idNum)) fetchedIds.add(idNum);
              }
              // Upsert in bulk
              await this.bulkUpsert(rows as any[]);
            } else {
              // If ids fetch returned nothing, check if those ids exist on serverRows.
              const idsSet = new Set(ids.map((id) => Number(id)));
              const hasServerRowsForIds = Array.from(idsSet).some((id) => serverRowMap.has(id));
              if (!hasServerRowsForIds) {
                // Rows were deleted on server; we'll delete locally below.
                this.dlog('incrementalRepairFromIntegrity: ids fetch 0 and no server rows; deleted', {
                  table: this.serverTable,
                  ids: Array.from(idsSet),
                });
              } else {
                // Endpoint likely doesn't support ids filter; fallback to full fetchAll once.
                this.dlog('incrementalRepairFromIntegrity: ids fetch 0; falling back to full fetchAll');
                await this.fetchAll();
                // After fetchAll, treat all server block ids as fetched
                for (const id of serverRowMap.keys()) fetchedIds.add(id);
                break; // No need to continue chunking if we fetched all
              }
            }
          } catch (e) {
            this.dlog('incrementalRepairFromIntegrity: batch ids fetch failed', e);
          }
        }

        // Remove local rows that are not present in server rows for this block
        const serverIds = new Set<number>(Array.from(serverRowMap.keys()));
        for (const localId of Array.from(localRowMap.keys())) {
          if (!serverIds.has(localId)) {
            await this.remove(localId);
          }
        }
      }
    }

    this.dlog('incrementalRepairFromIntegrity: completed', { table: this.serverTable });
  }

  /**
   * Compute local block hashes from on-the-fly row hashes (derived from configured hash fields).
   */
  private async computeLocalBlocksFromRowExpr(): Promise<
    Array<{ block_id: number; min_row_id: number; max_row_id: number; row_count: number; block_hash: string }>
  > {
    if (!(await this.init())) return [];
    const rowExpr = this.buildRowExprSql();
    const idCol = this.qi(String(this.idField));
    const BLOCK_SIZE = 1024;
    const sql = `
      WITH rows AS (
        SELECT
          CAST(${idCol} AS BIGINT) AS row_id,
          sha256(${rowExpr}) AS row_hash
        FROM ${this.table}
        WHERE ${idCol} IS NOT NULL
      ),
      bucketed AS (
        SELECT
          row_id,
          row_hash,
          CAST(FLOOR(row_id / ${BLOCK_SIZE}) AS BIGINT) AS block_id
        FROM rows
      )
      SELECT
        block_id,
        MIN(row_id)::BIGINT AS min_row_id,
        MAX(row_id)::BIGINT AS max_row_id,
        COUNT(*)::BIGINT AS row_count,
        sha256(string_agg(row_hash, '' ORDER BY row_id)) AS block_hash
      FROM bucketed
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
   * Compute local row hashes in a bounded id range, using the configured row expression.
   */
  private async computeLocalRowHashesInRange(minId: number, maxId: number): Promise<Array<{ row_id: number; row_hash: string }>> {
    if (!(await this.init())) return [];
    const rowExpr = this.buildRowExprSql();
    const idCol = this.qi(String(this.idField));
    const sql = `
      SELECT
        CAST(${idCol} AS BIGINT) AS row_id,
        sha256(${rowExpr}) AS row_hash
      FROM ${this.table}
      WHERE ${idCol} IS NOT NULL AND CAST(${idCol} AS BIGINT) >= ${minId} AND CAST(${idCol} AS BIGINT) <= ${maxId}
      ORDER BY ${idCol}
    `;
    const table = await DuckDB.query(sql);
    if (!table) return [];
    const arr = (table as any).toArray?.() ?? [];
    return arr.map((r: any) => ({ row_id: Number(r.row_id), row_hash: String(r.row_hash ?? '') }));
  }

  /**
   * Simple heuristic to turn a JS value into a SQL literal, respecting
   * NULL vs text/number/boolean. Callers should still use parameterized
   * queries for ad-hoc SQL; this is only for cache ingestion.
   */
  private toSqlLiteral(v: any): string {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') {
      return Number.isFinite(v) ? String(v) : 'NULL';
    }
    if (typeof v === 'boolean') {
      return v ? 'TRUE' : 'FALSE';
    }
    const s = String(v);
    if (!s.length) return 'NULL';
    const escaped = s.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  // --- Local hashing helpers using DuckDB's sha256 --------------------------

  /**
   * Build a DuckDB SQL expression that canonicalizes all hash fields into
   * a single pipe-delimited text string, mirroring the server's habits:
   * - *_at / *_date → epoch ms (UTC) when possible
   * - booleans → 't'/'f'
   * - others → CAST(col AS VARCHAR) with empty string for NULL
   */
  private buildRowExprSql(): string {
    const fields =
      this.hashFields && this.hashFields.length > 0 ? this.hashFields : this.columns;

    const exprs: string[] = [];
    for (const field of fields) {
      const col = String(field);
      const def = this.columnDefs.find((c) => c.name === col);
      const type = def?.type;

      if (type === 'BOOLEAN') {
        exprs.push(
          `CASE WHEN ${this.qi(col)} IS NULL THEN '' WHEN ${this.qi(col)} THEN 't' ELSE 'f' END`
        );
      } else if (type === 'TIMESTAMP') {
        // TIMESTAMP column: use epoch * 1000 for ms, then cast to text
        exprs.push(
          `CASE WHEN ${this.qi(col)} IS NULL THEN '' ELSE CAST(CAST(epoch(${this.qi(col)}) * 1000 AS BIGINT) AS VARCHAR) END`
        );
      } else if (col.endsWith('_at') || col.endsWith('_date')) {
        // Text-based datetime column: cast to TIMESTAMP first, then epoch * 1000
        exprs.push(
          `CASE WHEN ${this.qi(col)} IS NULL THEN '' ELSE CAST(CAST(epoch(CAST(${this.qi(col)} AS TIMESTAMP)) * 1000 AS BIGINT) AS VARCHAR) END`
        );
      } else {
        exprs.push(`COALESCE(CAST(${this.qi(col)} AS VARCHAR), '')`);
      }
    }

    if (!exprs.length) {
      return `''`;
    }
    return `concat_ws('|', ${exprs.join(', ')})`;
  }

  /**
   * Compute a single global hash over all rows in this DuckDB table using
   * DuckDB's sha256, following the same "row-hash then concat" pattern
   * as the backend:
   *
   * global = sha256( string_agg( sha256(row_expr), '' ORDER BY id ) )
   */
  private async computeLocalGlobalHash(): Promise<string | null> {
    if (!(await this.init())) return null;

    const rowExpr = this.buildRowExprSql();
    const idCol = this.qi(String(this.idField));

    const sql = `
      WITH rows AS (
        SELECT
          CAST(${idCol} AS BIGINT) AS row_id,
          sha256(${rowExpr}) AS row_hash
        FROM ${this.table}
        WHERE ${idCol} IS NOT NULL
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
    const row = arr[0] as any;
    const rowCount = Number(row.row_count ?? 0);
    const hash = row.global_hash;
    if (!rowCount || !hash) return null;
    return String(hash);
  }

  private qi(name: string): string {
    const safe = String(name).replace(/"/g, '""');
    return `"${safe}"`;
  }

  /**
   * Normalize all ID fields (ending with _id or exactly 'id') to JS numbers when possible
   * to ensure strict equality checks against numeric ids work across the app.
   */
  private normalizeRowIds(row: any): any {
    if (!row || typeof row !== 'object') return row;
    
    try {
      const normalized = { ...row };
      
      // Normalize all fields that look like IDs (end with _id or are exactly 'id')
      for (const key in normalized) {
        if (Object.prototype.hasOwnProperty.call(normalized, key)) {
          const value = normalized[key];
          
          // Check if this is an ID field
          if (key === 'id' || (typeof key === 'string' && key.endsWith('_id'))) {
            if (value != null && value !== '') {
              const n = this.toJsNumber(value);
              if (typeof n === 'number' && Number.isFinite(n)) {
                normalized[key] = n;
              }
            }
          }
          // Handle arrays of IDs (like user_ids)
          else if (key === 'user_ids' && Array.isArray(value)) {
            normalized[key] = value.map((v: any) => {
              const n = this.toJsNumber(v);
              return typeof n === 'number' && Number.isFinite(n) ? n : v;
            });
          }
        }
      }
      
      return normalized;
    } catch {
      return row;
    }
  }

  /**
   * @deprecated Use normalizeRowIds instead - kept for backward compatibility
   */
  private normalizeRowPrimaryKey(row: any): any {
    return this.normalizeRowIds(row);
  }

  private toJsNumber(v: any): number | any {
    if (typeof v === 'number') return v;
    if (typeof v === 'bigint') {
      // Convert BigInt to Number when safe; for ids we assume safe ranges
      return Number(v);
    }
    if (typeof v === 'string') {
      // Numeric strings → number; otherwise return original
      if (/^[+-]?\d+(\.\d+)?$/.test(v.trim())) {
        const n = Number(v);
        return Number.isFinite(n) ? n : v;
      }
      return v;
    }
    return v;
  }
}


