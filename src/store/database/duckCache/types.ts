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
  /**
   * Optional event emitter callback for cache operations.
   * Called with event name and optional data.
   */
  eventEmitter?: (event: string, data?: any) => void;
  /**
   * Optional transform function to convert row before storing (e.g., user_ids array -> user_ids_text).
   */
  transformInput?: (row: T) => any;
  /**
   * Optional transform function to convert row after reading (e.g., user_ids_text -> user_ids array).
   */
  transformOutput?: (row: any) => T;
}

export interface HashComputationContext {
  hashFields: Array<string>;
  columns: Array<string>;
  columnDefs: Array<DuckColumn<any>>;
  serverTable: string;
  qi: (name: string) => string;
}

