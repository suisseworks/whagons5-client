import { DuckDB } from './DuckDB';
import api from '@/api/whagonsApi';
import { buildRowExprSql } from './duckCache/hashComputation';
import { quoteIdentifier, toSqlLiteral, normalizeRowIds } from './duckCache/utils';
import { migrateSchema as migrateSchemaUtil } from './duckCache/schemaMigration';
import { repairFromIdRanges as repairFromIdRangesHelper } from './duckCache/dataRepair';
import { validateIntegrity } from './duckCache/integrityValidation';
import { computeLocalGlobalHash, computeLocalRowHashesInRange, computeLocalBlocksFromRowExpr } from './duckCache/hashComputationHelpers';
import { incrementalRepairFromIntegrity } from './duckCache/incrementalRepair';
import { buildUpsertSql, buildBulkUpsertSql, buildDeleteSql, buildCountSql, buildSelectAllSql } from './duckCache/sqlOperations';
import type { DuckDBColumnType, DuckColumn, DuckGenericCacheOptions } from './duckCache/types';

// Re-export types for backward compatibility
export type { DuckDBColumnType, DuckColumn, DuckGenericCacheOptions };

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
  private readonly eventEmitter?: (event: string, data?: any) => void;
  private readonly transformInput?: (row: T) => any;
  private readonly transformOutput?: (row: any) => T;
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
    this.eventEmitter = options.eventEmitter;
    this.transformInput = options.transformInput;
    this.transformOutput = options.transformOutput;

    const primary = options.columns.find((c) => c.primaryKey)?.name;
    this.idField = (options.idField ?? (primary ?? 'id')) as keyof T & string;

    // Auto-generate a structured schema from the typed column config
    const defs = options.columns.map((c) => {
      const pk = c.primaryKey ? ' PRIMARY KEY' : '';
      return `${this.qi(c.name)} ${c.type}${pk}`;
    });
    this.schemaSql = `(${defs.join(', ')})`;
  }

  private qi(name: string): string {
    return quoteIdentifier(name);
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

  private emitEvent(event: string, data?: any): void {
    if (this.eventEmitter) {
      try {
        this.eventEmitter(event, data);
      } catch {
        // ignore event emitter errors
      }
    }
  }

  /**
   * Migrate schema by adding any missing columns from hashFields/columns.
   * Returns true if any columns were added, false otherwise.
   */
  private async migrateSchema(): Promise<boolean> {
    // Ensure all hashFields are in columnDefs for migration
    const allColumnDefs = [...this.columnDefs];
    if (this.hashFields) {
      for (const field of this.hashFields) {
        if (!allColumnDefs.find(c => c.name === field)) {
          // Add missing hashField as TEXT column (will be added by migration)
          allColumnDefs.push({ name: field as any, type: 'TEXT' });
        }
      }
    }
    
    return migrateSchemaUtil({
      table: this.table,
      columns: this.columns,
      columnDefs: allColumnDefs,
      qi: (name) => this.qi(name),
      log: (...args) => this.log(...args),
    });
  }

  /**
   * Ensure DuckDB is ready and the backing table exists.
   * Also migrates the schema by adding any missing columns from hashFields.
   */
  public async init(): Promise<boolean> {
    if (this.initialized) return true;
    const ok = await DuckDB.init();
    if (!ok) {
      this.log('DuckDB.init failed, cannot initialize cache');
      return false;
    }
    await DuckDB.exec(`CREATE TABLE IF NOT EXISTS ${this.table} ${this.schemaSql}`);
    
    // Migrate schema: add any missing columns from hashFields/columns
    // This handles cases where hashFields were updated but the table already exists
    await this.migrateSchema();
    
    this.initialized = true;
    this.log('initialized table');
    return true;
  }

  /**
   * Fast emptiness check to decide whether we need a bootstrap fetch when
   * integrity is not configured on the server for this table.
   */
  // (removed; no longer needed)

  private async waitForReady(): Promise<boolean> {
    if (await DuckDB.init()) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return DuckDB.init();
  }

  public async getAll(): Promise<T[]> {
    if (!(await this.init())) return [];
    if (!(await this.waitForReady())) return [];
    const sql = buildSelectAllSql({
      table: this.table,
      columns: this.columns,
      idField: String(this.idField),
      qi: (name) => this.qi(name),
      toSqlLiteral: (v) => this.toSqlLiteral(v),
    });
    const table = await DuckDB.query(sql);
    const rows = table ? ((table as any).toArray?.() ?? []) : [];
    const normalized = rows.map((r: any) => normalizeRowIds(r));
    return this.transformOutput 
      ? normalized.map((r: any) => this.transformOutput!(r))
      : normalized as T[];
  }

  /**
   * Clear and replace all rows in this cache with the provided array.
   * Rows are written using the structured column list defined for this cache.
   */
  public async replaceAll(rows: T[]): Promise<void> {
    if (!(await this.init())) return;
    if (!(await this.waitForReady())) return;
    this.log('replaceAll: rows', rows.length);

    await DuckDB.exec(`DELETE FROM ${this.table}`);
    if (!rows.length) {
      try {
        await DuckDB.flush('replaceAll-empty');
      } catch {
        // ignore
      }
      this.emitEvent('cache:invalidate');
      return;
    }
    await this.bulkUpsert(rows);
    this.emitEvent('cache:invalidate');
  }

  public async upsert(row: T): Promise<void> {
    if (!(await this.init())) return;
    if (!(await this.waitForReady())) return;
    const idVal = (row as any)?.[this.idField];
    if (idVal === undefined || idVal === null) {
      return;
    }
    
    const transformedRow = this.transformInput ? this.transformInput(row) : row;
    
    const existing = await DuckDB.query(`SELECT ${this.qi(String(this.idField))} FROM ${this.table} WHERE ${this.qi(String(this.idField))} = ${typeof idVal === 'number' ? idVal : `'${String(idVal).replace(/'/g, "''")}'`}`);
    const exists = existing && (existing as any).toArray?.().length > 0;
    const isCreate = !exists;
    
    try {
      const sql = buildUpsertSql({
        table: this.table,
        columns: this.columns,
        idField: String(this.idField),
        qi: (name) => this.qi(name),
        toSqlLiteral: (v) => this.toSqlLiteral(v),
      }, transformedRow);
      await DuckDB.exec(sql);
      
      if (isCreate) {
        this.emitEvent('task:created', row);
      } else {
        this.emitEvent('task:updated', row);
      }
    } catch (e) {
      this.log('upsert failed', e);
    }
  }

  public async bulkUpsert(rows: T[], chunkSize = 500): Promise<void> {
    if (!(await this.init())) return;
    if (!rows.length) return;

    const transformedRows = this.transformInput 
      ? rows.map(r => this.transformInput!(r))
      : rows;

    const ctx = {
      table: this.table,
      columns: this.columns,
      idField: String(this.idField),
      qi: (name: string) => this.qi(name),
      toSqlLiteral: (v: any) => this.toSqlLiteral(v),
    };

    for (let i = 0; i < transformedRows.length; i += chunkSize) {
      const chunk = transformedRows.slice(i, i + chunkSize);
      const sqlStatements = buildBulkUpsertSql(ctx, chunk);
      if (sqlStatements.length === 0) continue;
      
      const valuesTuples = sqlStatements.map(sql => {
        const match = sql.match(/VALUES\s+(.+)$/);
        return match ? match[1] : '';
      }).filter(v => v);
      
      if (valuesTuples.length === 0) continue;
      const colsList = this.columns.map((c) => this.qi(c)).join(', ');
      const sql = `INSERT OR REPLACE INTO ${this.table} (${colsList}) VALUES ${valuesTuples.join(', ')}`;
      await DuckDB.exec(sql);
    }
    
    if (rows.length > 1) {
      this.emitEvent('tasks:bulk_update');
    }

    try {
      await DuckDB.flush('bulkUpsert');
    } catch {
      // best-effort
    }
  }

  public async remove(id: number | string): Promise<void> {
    if (!(await this.init())) return;
    const sql = buildDeleteSql({
      table: this.table,
      columns: this.columns,
      idField: String(this.idField),
      qi: (name: string) => this.qi(name),
      toSqlLiteral: (v: any) => this.toSqlLiteral(v),
    }, id);
    await DuckDB.exec(sql);
    const n = typeof id === 'number' ? id : Number(id);
    if (Number.isFinite(n)) {
      this.emitEvent('task:deleted', { id: n });
    }
  }

  public async add(row: T): Promise<void> {
    await this.upsert(row);
  }

  public async update(_id: number | string, row: T): Promise<void> {
    await this.upsert(row);
  }

  public async createRemote(row: Partial<T>): Promise<T> {
    const resp = await api.post(this.endpoint, row);
    const created = (resp.data?.data ?? resp.data?.row ?? resp.data) as T;
    return created;
  }

  public async updateRemote(id: number | string, updates: Partial<T>): Promise<T> {
    const resp = await api.patch(`${this.endpoint}/${id}`, updates);
    const updated = (resp.data?.data ?? resp.data?.row ?? resp.data) as T;
    return updated;
  }

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
    if (!(await this.waitForReady())) return false;
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

  public async validate(ctx?: { serverGlobal?: string | null }): Promise<boolean> {
    return validateIntegrity({
      table: this.table,
      serverTable: this.serverTable,
      endpoint: this.endpoint,
      validating: { current: this.validating },
      init: () => this.init(),
      getLocalRowCount: () => this.getLocalRowCount(),
      computeLocalGlobalHash: () => this.computeLocalGlobalHash(),
      repairFromIdRanges: (count) => this.repairFromIdRanges(count),
      incrementalRepairFromIntegrity: () => this.incrementalRepairFromIntegrity(),
      fetchAll: () => this.fetchAll(),
      ensurePopulated: () => this.ensurePopulated(),
      log: (...args) => this.log(...args),
      dlog: (...args) => this.dlog(...args),
      debugEnabled: () => {
        try { return localStorage.getItem('wh-debug-integrity') === 'true'; } catch { return false; }
      },
    }, ctx?.serverGlobal);
  }

  private async ensurePopulated(): Promise<void> {
    if (!(await this.init())) return;
    const count = await this.getLocalRowCount();
    if (count > 0) return;
    this.dlog('ensurePopulated: cache empty, fetching all rows before integrity validation');
    await this.fetchAll();
  }

  private async incrementalRepairFromIntegrity(): Promise<void> {
    this.dlog('Starting incrementalRepairFromIntegrity');
    await incrementalRepairFromIntegrity({
      table: this.table,
      serverTable: this.serverTable,
      endpoint: this.endpoint,
      idField: String(this.idField),
      buildRowExprSql: () => this.buildRowExprSql(),
      computeLocalBlocksFromRowExpr: () => this.computeLocalBlocksFromRowExpr(),
      computeLocalRowHashesInRange: (minId, maxId) => this.computeLocalRowHashesInRange(minId, maxId),
      bulkUpsert: (rows) => this.bulkUpsert(rows),
      remove: (id) => this.remove(id),
      fetchAll: () => this.fetchAll(),
      migrateSchema: () => this.migrateSchema(),
      init: () => this.init(),
      log: (...args) => this.log(...args),
      dlog: (...args) => this.dlog(...args),
    });
  }

  private async computeLocalBlocksFromRowExpr(): Promise<
    Array<{ block_id: number; min_row_id: number; max_row_id: number; row_count: number; block_hash: string }>
  > {
    if (!(await this.waitForReady())) return [];
    if (!(await this.init())) return [];
    try {
      return await computeLocalBlocksFromRowExpr({
        table: this.table,
        idField: String(this.idField),
        blockSize: 1024,
        buildRowExprSql: () => this.buildRowExprSql(),
        qi: (name) => this.qi(name),
      });
    } catch (error: any) {
      const errorMsg = String(error?.message || error || '');
      if (errorMsg.includes('not found') || errorMsg.includes('Referenced column')) {
        const migrated = await this.migrateSchema();
        if (migrated) {
          return computeLocalBlocksFromRowExpr({
            table: this.table,
            idField: String(this.idField),
            blockSize: 1024,
            buildRowExprSql: () => this.buildRowExprSql(),
            qi: (name) => this.qi(name),
          });
        }
      }
      return [];
    }
  }
  

  private async computeLocalRowHashesInRange(minId: number, maxId: number): Promise<Array<{ row_id: number; row_hash: string }>> {
    if (!(await this.waitForReady())) return [];
    try {
      return await computeLocalRowHashesInRange({
        table: this.table,
        idField: String(this.idField),
        blockSize: 1024,
        buildRowExprSql: () => this.buildRowExprSql(),
        qi: (name) => this.qi(name),
      }, minId, maxId);
    } catch (error: any) {
      const errorMsg = String(error?.message || error || '');
      if (errorMsg.includes('not found') || errorMsg.includes('Referenced column')) {
        const migrated = await this.migrateSchema();
        if (migrated) {
          return computeLocalRowHashesInRange({
            table: this.table,
            idField: String(this.idField),
            blockSize: 1024,
            buildRowExprSql: () => this.buildRowExprSql(),
            qi: (name) => this.qi(name),
          }, minId, maxId);
        }
      }
      return [];
    }
  }

  private toSqlLiteral(v: any): string {
    return toSqlLiteral(v);
  }

  private buildRowExprSql(): string {
    return buildRowExprSql({
      hashFields: this.hashFields || [],
      columns: this.columns,
      columnDefs: this.columnDefs,
      serverTable: this.serverTable,
      qi: (name) => this.qi(name),
    });
  }

  private async getLocalRowCount(): Promise<number> {
    if (!(await this.waitForReady())) return 0;
    if (!(await this.init())) return 0;
    try {
      const sql = buildCountSql({
        table: this.table,
        columns: this.columns,
        idField: String(this.idField),
        qi: (name: string) => this.qi(name),
        toSqlLiteral: (v: any) => this.toSqlLiteral(v),
      });
      const result = await DuckDB.query(sql);
      const arr = (result as any).toArray?.() ?? [];
      return arr.length > 0 ? Number(arr[0].cnt ?? 0) : 0;
    } catch {
      return 0;
    }
  }

  private async repairFromIdRanges(serverRowCount: number): Promise<void> {
    await repairFromIdRangesHelper({
      table: this.table,
      serverTable: this.serverTable,
      endpoint: this.endpoint,
      idField: String(this.idField),
      qi: (name) => this.qi(name),
      getLocalRowCount: () => this.getLocalRowCount(),
      fetchAll: () => this.fetchAll(),
      bulkUpsert: (rows) => this.bulkUpsert(rows),
      log: (...args) => this.log(...args),
      dlog: (...args) => this.dlog(...args),
    }, serverRowCount);
  }

  /**
   * Compute a single global hash over all rows.
   */
  private async computeLocalGlobalHash(): Promise<string | null> {
    if (!(await this.waitForReady())) return null;
    try {
      const result = await computeLocalGlobalHash({
        table: this.table,
        idField: String(this.idField),
        blockSize: 1024,
        buildRowExprSql: () => this.buildRowExprSql(),
        qi: (name) => this.qi(name),
      });
      
      // Handle schema migration if needed
      if (!result) {
        const migrated = await this.migrateSchema();
        if (migrated) {
          return computeLocalGlobalHash({
            table: this.table,
            idField: String(this.idField),
            blockSize: 1024,
            buildRowExprSql: () => this.buildRowExprSql(),
            qi: (name) => this.qi(name),
          });
        }
      }
      return result;
    } catch (error: any) {
      const errorMsg = String(error?.message || error || '');
      if (errorMsg.includes('not found') || errorMsg.includes('Referenced column')) {
        const migrated = await this.migrateSchema();
        if (migrated) {
          return computeLocalGlobalHash({
            table: this.table,
            idField: String(this.idField),
            blockSize: 1024,
            buildRowExprSql: () => this.buildRowExprSql(),
            qi: (name) => this.qi(name),
          });
        }
      }
      return null;
    }
  }

  /**
   * Debug function to inspect how a field is stored and computed.
   */
  public async debugInspectField(fieldName: string, rowId: number | string = 1): Promise<void> {
    try {
      if (!(await this.init())) return;
      const { DuckDB } = await import('./DuckDB');
      const idVal = typeof rowId === 'number' ? rowId : Number(rowId);
      const result = await DuckDB.query(
        `SELECT ${this.qi(fieldName)}, typeof(${this.qi(fieldName)}) as field_type FROM ${this.table} WHERE ${this.qi(String(this.idField))} = ${idVal} LIMIT 1`
      );
      if (result) {
        const arr = (result as any).toArray?.() ?? [];
        if (arr.length > 0) {
          console.log(`[DuckGenericCache:${this.name}] Field ${fieldName}:`, {
            value: arr[0][fieldName],
            stored_as: arr[0].field_type,
            value_type: typeof arr[0][fieldName],
          });
        }
      }
    } catch (e) {
      console.error(`[DuckGenericCache:${this.name}] debugInspectField error:`, e);
    }
  }

  /**
   * Debug function to compare a single row's hash computation.
   * Helps identify hash mismatches by showing the actual row expression.
   */
  public async debugCompareSingleRowHash(rowId: number | string): Promise<void> {
    try {
      if (!(await this.init())) {
        console.warn(`[DuckGenericCache:${this.name}] debugCompareSingleRowHash: cache not initialized`);
        return;
      }

      const { DuckDB } = await import('./DuckDB');
      const idVal = typeof rowId === 'number' ? rowId : Number(rowId);
      
      // Get the row
      const rowResult = await DuckDB.query(`SELECT * FROM ${this.table} WHERE ${this.qi(String(this.idField))} = ${idVal} LIMIT 1`);
      if (!rowResult) {
        console.warn(`[DuckGenericCache:${this.name}] Row ${rowId} not found`);
        return;
      }

      const arr = (rowResult as any).toArray?.() ?? [];
      if (arr.length === 0) {
        console.warn(`[DuckGenericCache:${this.name}] Row ${rowId} not found`);
        return;
      }

      const row = arr[0];
      console.log(`[DuckGenericCache:${this.name}] Row ${rowId}:`, row);

      // Compute local hash expression
      const rowExpr = this.buildRowExprSql();
      const hashResult = await DuckDB.query(
        `SELECT sha256(${rowExpr}) AS row_hash, ${rowExpr} AS row_expr FROM ${this.table} WHERE ${this.qi(String(this.idField))} = ${idVal}`
      );
      
      if (hashResult) {
        const hashArr = (hashResult as any).toArray?.() ?? [];
        if (hashArr.length > 0) {
          console.log(`[DuckGenericCache:${this.name}] Local hash computation:`, {
            row_expr: hashArr[0].row_expr,
            row_hash: hashArr[0].row_hash,
          });
        }
      }

      // Try to get server hash + normalization for comparison
      try {
        const { default: api } = await import('@/api/whagonsApi');
        const hashFields =
          (this.hashFields && this.hashFields.length > 0 ? this.hashFields : this.columns).map((f) =>
            String(f)
          );
        const serverResp = await api.post('/integrity/debug-hash', {
          table: this.serverTable,
          id: idVal,
          fields: hashFields,
        });
        const serverData = (serverResp.data?.data ?? serverResp.data) as {
          row_expr?: string;
          row_hash?: string;
          normalized_values?: Array<{ field: string; normalized: string; original: any }>;
        };

        if (serverData) {
          console.log(`[DuckGenericCache:${this.name}] Server hash computation:`, serverData);
          const hashArr = (hashResult as any).toArray?.() ?? [];
          const localExpr = hashArr.length > 0 ? String(hashArr[0].row_expr ?? '') : '';
          const localHash = hashArr.length > 0 ? String(hashArr[0].row_hash ?? '') : '';
          const serverHash = String(serverData.row_hash ?? '');

          if (localHash && serverHash && localHash !== serverHash) {
            const localParts = localExpr.split('|');
            const serverParts =
              serverData.normalized_values?.map((v) => String(v.normalized ?? '')) ?? [];

            const mismatches: Array<{
              field: string;
              local: string;
              server: string;
              original: { local: any; server: any };
            }> = [];

            hashFields.forEach((field, index) => {
              const localVal = localParts[index] ?? '';
              const serverVal = serverParts[index] ?? '';
              if (localVal !== serverVal) {
                mismatches.push({
                  field,
                  local: localVal,
                  server: serverVal,
                  original: {
                    local: (row as any)?.[field],
                    server: serverData.normalized_values?.[index]?.original,
                  },
                });
              }
            });

            console.warn(`[DuckGenericCache:${this.name}] ❌ Hash mismatch detected`, {
              local: localHash,
              server: serverHash,
              local_expr: localExpr,
              server_expr: serverData.row_expr,
              mismatches,
            });
          } else if (localHash && serverHash) {
            console.log(`[DuckGenericCache:${this.name}] ✅ Hash matches`, {
              hash: localHash,
            });
          }
        }
      } catch (e) {
        console.warn(`[DuckGenericCache:${this.name}] Could not fetch server hash details:`, e);
      }
    } catch (e) {
      console.error(`[DuckGenericCache:${this.name}] debugCompareSingleRowHash error:`, e);
    }
  }

  public async debugCompareBlockHash(blockId: number): Promise<void> {
    try {
      if (!(await this.init())) {
        console.warn(`[DuckGenericCache:${this.name}] debugCompareBlockHash: cache not initialized`);
        return;
      }
      const localBlocks = await this.computeLocalBlocksFromRowExpr();
      const localBlock = localBlocks.find((b) => Number(b.block_id) === Number(blockId));
      const serverResp = await api.post('/integrity/debug-block-hash', {
        table: this.serverTable,
        block_id: blockId,
      });
      const serverData = serverResp.data?.data ?? serverResp.data;
      console.log(`[DuckGenericCache:${this.name}] Block ${blockId} local vs server:`, {
        local: localBlock,
        server: serverData,
      });
    } catch (e) {
      console.error(`[DuckGenericCache:${this.name}] debugCompareBlockHash error:`, e);
    }
  }

  public async debugCompareGlobalHash(): Promise<void> {
    try {
      if (!(await this.init())) {
        console.warn(`[DuckGenericCache:${this.name}] debugCompareGlobalHash: cache not initialized`);
        return;
      }
      const [localGlobal, localBlocks] = await Promise.all([
        this.computeLocalGlobalHash(),
        this.computeLocalBlocksFromRowExpr(),
      ]);
      const serverResp = await api.post('/integrity/debug-global-hash', {
        table: this.serverTable,
      });
      const serverData = serverResp.data?.data ?? serverResp.data;
      console.log(`[DuckGenericCache:${this.name}] Global hash comparison:`, {
        localGlobal,
        localBlocks,
        server: serverData,
      });
    } catch (e) {
      console.error(`[DuckGenericCache:${this.name}] debugCompareGlobalHash error:`, e);
    }
  }

}




