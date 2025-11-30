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
      return `${c.name} ${c.type}${pk}`;
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
   * Read all rows from this DuckDB table.
   * NOTE: Callers should avoid this for very large tables and prefer
   * windowed SQL queries instead.
   */
  public async getAll(): Promise<T[]> {
    if (!(await this.init())) return [];
    const table = await DuckDB.query(`SELECT * FROM ${this.table}`);
    const rows = table ? ((table as any).toArray?.() ?? []) : [];
    return rows as T[];
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

    for (const row of rows) {
      await this.upsert(row);
    }
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
      cols.push(col);
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
  public async validate(): Promise<boolean> {
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

      // Fast bootstrap: if table is empty, just fetchAll once.
      const countTable = await DuckDB.query(
        `SELECT COUNT(*)::BIGINT AS cnt FROM ${this.table}`
      );
      const countRows = countTable ? ((countTable as any).toArray?.() ?? []) : [];
      const total = countRows.length > 0 ? Number(countRows[0].cnt ?? 0) : 0;
      if (!Number.isFinite(total) || total === 0) {
        this.dlog('validate: no local rows, running fetchAll bootstrap');
        await this.fetchAll();
        this.validating = false;
        return true;
      }

      // Compute local global hash from current DuckDB rows using DuckDB's sha256.
      const localGlobal = await this.computeLocalGlobalHash();
      if (!localGlobal) {
        this.dlog('validate: failed to compute local hash, skipping');
        this.validating = false;
        return false;
      }

      // Ask server for current global hash.
      let serverGlobal: string | undefined | null = undefined;
      try {
        const globalResp = await api.get('/integrity/global', {
          params: { table: this.serverTable },
        });
        const data = globalResp.data?.data ?? globalResp.data;
        serverGlobal = (data?.global_hash ?? null) as string | undefined | null;

        // If endpoint is present but integrity hashing is not configured for this table,
        // keep existing data and skip further validation.
        if (!serverGlobal) {
          this.dlog('validate: integrity hashing not configured for table, skipping', {
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
          this.dlog('validate: integrity endpoint not available, skipping', {
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

      this.dlog('validate: global compare', {
        table: this.serverTable,
        equal: serverGlobal === localGlobal,
        serverGlobal: (serverGlobal || '').slice(0, 16),
        localGlobal: localGlobal.slice(0, 16),
      });

      if (serverGlobal && serverGlobal === localGlobal) {
        // Perfect match – nothing to do.
        this.validating = false;
        return true;
      }

      // Fallback: full refresh when hashes differ.
      this.dlog('validate: global hash mismatch, running full fetchAll refresh', {
        table: this.serverTable,
      });
      await this.fetchAll();
      this.validating = false;
      return true;
    } catch (e) {
      this.dlog('validate: error', e);
      this.validating = false;
      return false;
    }
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
          `CASE WHEN ${col} IS NULL THEN '' WHEN ${col} THEN 't' ELSE 'f' END`
        );
      } else if (type === 'TIMESTAMP') {
        // TIMESTAMP column: use epoch * 1000 for ms, then cast to text
        exprs.push(
          `CASE WHEN ${col} IS NULL THEN '' ELSE CAST(CAST(epoch(${col}) * 1000 AS BIGINT) AS VARCHAR) END`
        );
      } else if (col.endsWith('_at') || col.endsWith('_date')) {
        // Text-based datetime column: cast to TIMESTAMP first, then epoch * 1000
        exprs.push(
          `CASE WHEN ${col} IS NULL THEN '' ELSE CAST(CAST(epoch(CAST(${col} AS TIMESTAMP)) * 1000 AS BIGINT) AS VARCHAR) END`
        );
      } else {
        exprs.push(`COALESCE(CAST(${col} AS VARCHAR), '')`);
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
    const idCol = String(this.idField);

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
}


