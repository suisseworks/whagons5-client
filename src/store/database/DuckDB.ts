/**
 * DuckDB abstraction (backed by @duckdb/duckdb-wasm, Vite-friendly).
 *
 * This centralizes how we:
 * - instantiate the AsyncDuckDB + worker
 * - keep a shared connection
 * - run simple queries/execs
 *
 * It does NOT yet replace our IndexedDB `DB` layer – this is a building
 * block for a future "DuckDB-backed cache" or analytics layer.
 */

import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: mvp_worker,
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: eh_worker,
  },
};

// Use a stable OPFS-backed database file so DuckDB state survives reloads.
// When OPFS is not available, we transparently fall back to an in‑memory DB.
const OPFS_DB_PATH = 'opfs://whagons_tasks.duckdb';

function isOpfsSupported(): boolean {
  try {
    const hasNavigator = typeof navigator !== 'undefined';
    const hasStorage = hasNavigator && 'storage' in navigator;
    const hasGetDirectory =
      hasStorage && (navigator.storage as any) && 'getDirectory' in navigator.storage;
    return hasNavigator && hasStorage && hasGetDirectory;
  } catch {
    return false;
  }
}

export class DuckDB {
  // Async bindings + connection types live under the "parallel" namespace.
  private static db: duckdb.AsyncDuckDB | null = null;
  private static conn: duckdb.AsyncDuckDBConnection | null = null;
  private static initPromise: Promise<boolean> | null = null;
  private static closing = false;
  private static lifecycleHookInstalled = false;
  private static debugLogging = false;
  private static verboseLogging = false;
  private static flushing = false;

  /**
   * Initialize the AsyncDuckDB instance and open a shared connection.
   * Safe to call multiple times – subsequent calls will just await the
   * in-flight promise or return true if already initialized.
   */
  public static async init(): Promise<boolean> {
    if (typeof window === 'undefined') {
      // Avoid doing anything during SSR / non-browser environments.
      return false;
    }

    if (this.db && this.conn) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
        if (!bundle.mainWorker || !bundle.mainModule) {
          console.error('[DuckDB] No suitable WASM bundle found');
          return false;
        }

        // Create the worker from the selected bundle's worker URL.
        const worker = new Worker(bundle.mainWorker);
        const useDebug = (() => {
          try { return localStorage.getItem('wh-debug-duckdb') === 'true'; } catch { return false; }
        })();
        const useVerbose = (() => {
          try { return localStorage.getItem('wh-debug-duckdb-verbose') === 'true'; } catch { return false; }
        })();
        const useEngineLogs = (() => {
          try { return localStorage.getItem('wh-debug-duckdb-engine') === 'true'; } catch { return false; }
        })();
        this.debugLogging = useDebug;
        this.verboseLogging = useVerbose;
        const logger: any = useEngineLogs
          ? new duckdb.ConsoleLogger()
          : { log: (_lvl: number, _origin: number, _code: number, _msg: string) => {} };
        const db = new duckdb.AsyncDuckDB(logger, worker);

        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

        // Prefer an OPFS-backed database file so that DuckDB state (tables, rows)
        // persists across browser reloads. Fall back to an in‑memory DB when
        // OPFS is not available or opening fails.
        const opfs = isOpfsSupported();
        const targetPath = opfs ? OPFS_DB_PATH : ':memory:';
        try {
          await (db as any).open({
            path: targetPath,
            accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
          });
          if (useDebug) {
            console.log(
              '[DuckDB] Opened database',
              targetPath,
              opfs ? '(OPFS persistent)' : '(in‑memory)'
            );
          }
        } catch (openErr) {
          console.warn(
            '[DuckDB] Failed to open OPFS database, falling back to in‑memory',
            openErr
          );
          await (db as any).open({ path: ':memory:' });
        }

        const conn = await db.connect();
        this.db = db;
        this.conn = conn;
        this.installLifecycleHooks();
        await this.logCacheState('after-init');

        if (useDebug) {
          console.log('[DuckDB] Initialized AsyncDuckDB + connection');
        }
        return true;
      } catch (e) {
        console.error('[DuckDB] init failed', e);
        this.db = null;
        this.conn = null;
        return false;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  private static async ensureConnection(): Promise<duckdb.AsyncDuckDBConnection | null> {
    if (this.conn && this.db) return this.conn;
    const ok = await this.init();
    if (!ok || !this.conn) {
      console.warn('[DuckDB] ensureConnection: no connection available');
      return null;
    }
    return this.conn;
  }

  /**
   * Run a SELECT-style query.
   *
   * DuckDB-wasm returns Arrow-backed results; for now we surface the raw
   * duckdb result object and let callers decide how to materialize it.
   */
  public static async query(sql: string): Promise<any> {
    const conn = await this.ensureConnection();
    if (!conn) return null;
    const start = this.verboseLogging ? performance.now() : 0;
    const label = this.verboseLogging ? this.summarizeSql(sql) : '';
    try {
      const result = await conn.query(sql);
      if (this.verboseLogging) {
        const elapsed = (performance.now() - start).toFixed(1);
        const rowCount = (result as any)?.toArray?.()?.length ?? 0;
        console.log(`[DuckDB][query] ${label} (${elapsed}ms, ${rowCount} rows)`);
      }
      return result;
    } catch (e) {
      console.error('[DuckDB] query failed', { sql, error: e });
      throw e;
    }
  }

  /**
   * Execute a statement that doesn't need a result set (DDL/DML).
   */
  public static async exec(sql: string, opts?: { suppressErrorLog?: boolean }): Promise<void> {
    const conn = await this.ensureConnection();
    if (!conn) return;
    const start = this.verboseLogging ? performance.now() : 0;
    const label = this.verboseLogging ? this.summarizeSql(sql) : '';
    try {
      await conn.query(sql);
      if (this.verboseLogging) {
        const elapsed = (performance.now() - start).toFixed(1);
        console.log(`[DuckDB][exec] ${label} (${elapsed}ms)`);
      }
    } catch (e) {
      if (!opts?.suppressErrorLog) {
        console.error('[DuckDB] exec failed', { sql, error: e });
      }
      throw e;
    }
  }

  /**
   * Close the shared connection and underlying DB.
   */
  public static async close(): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    try {
      await this.conn?.close();
      const maybeFlush = (this.db as any)?.flushFiles;
      if (typeof maybeFlush === 'function') {
        await maybeFlush.call(this.db);
      }
    } catch (error) {
      console.warn('[DuckDB] close failed', error);
    } finally {
      this.conn = null;
      this.db = null;
      this.closing = false;
    }
  }

  public static async flush(label = 'manual'): Promise<void> {
    if (this.flushing) return;
    const flushFn = (this.db as any)?.flushFiles;
    if (typeof flushFn !== 'function') return;
    this.flushing = true;
    try {
      await flushFn.call(this.db);
      if (this.verboseLogging) {
        console.log(`[DuckDB][flush] ${label}`);
      }
    } catch (error) {
      console.warn('[DuckDB] flush failed', error);
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Drop all tables and close the database connection.
   * Used on logout to clear all cached data.
   */
  public static async dropAllTables(): Promise<void> {
    if (!this.conn) return;
    
    try {
      // Get all table names
      const tablesResult = await this.conn.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'main' AND table_type = 'BASE TABLE'
      `);
      
      const tables = (tablesResult as any).toArray?.() ?? [];
      
      // Drop each table
      for (const row of tables) {
        const tableName = (row as any).table_name;
        if (tableName) {
          try {
            await this.conn.query(`DROP TABLE IF EXISTS ${tableName}`);
          } catch (e) {
            console.warn(`[DuckDB] Failed to drop table ${tableName}:`, e);
          }
        }
      }
      
      console.log(`[DuckDB] Dropped ${tables.length} tables`);
    } catch (e) {
      console.warn('[DuckDB] Failed to drop tables:', e);
    }
  }

  /**
   * Delete the OPFS database file(s). Closes connection first to release file handles.
   * Returns true if deletion succeeded, false otherwise.
   */
  public static async deleteFile(): Promise<boolean> {
    try {
      // Close connection first to release file handles
      await this.close();
      
      if (!isOpfsSupported()) {
        console.log('[DuckDB] OPFS not supported, nothing to delete');
        return false;
      }

      const opfsRoot = await navigator.storage.getDirectory();
      let deleted = false;

      // Try to delete both the main file and WAL file
      const filesToDelete = ['whagons_tasks.duckdb', 'whagons_tasks.duckdb.wal'];
      
      for (const fileName of filesToDelete) {
        try {
          const fileHandle = await opfsRoot.getFileHandle(fileName, { create: false }).catch(() => null);
          if (fileHandle) {
            await opfsRoot.removeEntry(fileName, { recursive: true });
            console.log(`[DuckDB] Deleted OPFS file: ${fileName}`);
            deleted = true;
          }
        } catch (e: any) {
          // File might be locked or already deleted
          const errorMsg = String(e?.message || e || '');
          if (errorMsg.includes('NoModificationAllowedError') || errorMsg.includes('not allowed')) {
            console.warn(`[DuckDB] Cannot delete ${fileName}: file is locked (close all tabs and try again)`);
          } else if (!errorMsg.includes('not found')) {
            console.warn(`[DuckDB] Failed to delete ${fileName}:`, e);
          }
        }
      }

      return deleted;
    } catch (e) {
      console.error('[DuckDB] Error deleting OPFS file:', e);
      return false;
    }
  }

  /**
   * Completely reset the database: drop all tables, close connection, and delete OPFS file.
   * Used on logout to ensure no data persists.
   */
  public static async reset(): Promise<void> {
    try {
      // Drop all tables first
      await this.dropAllTables();
      
      // Close the connection
      await this.close();
      
      // Delete the OPFS file if it exists
      await this.deleteFile();
      
      console.log('[DuckDB] Database reset complete');
    } catch (e) {
      console.error('[DuckDB] Error during reset:', e);
      // Still try to close even if reset failed
      await this.close();
    }
  }

  private static installLifecycleHooks(): void {
    if (typeof window === 'undefined') return;
    if (this.lifecycleHookInstalled) return;

    const handler = () => {
      this.close().catch(() => {});
    };

    window.addEventListener('pagehide', handler);
    window.addEventListener('beforeunload', handler);
    this.lifecycleHookInstalled = true;
  }

  public static async logStateSnapshot(context: string, force = false): Promise<void> {
    await this.logCacheState(context, force);
  }

  private static async logCacheState(context: string, force = false): Promise<void> {
    if (!force && !this.debugLogging) return;
    const conn = await this.ensureConnection();
    if (!conn) return;
    try {
      const tablesResult = await conn.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'main' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      const tables = (tablesResult as any).toArray?.().map((row: any) => row.table_name) ?? [];
      console.log(`[DuckDB] (${context}) tables:`, tables.length ? tables : '(none)');
      for (const tableName of tables.slice(0, 25)) {
        try {
          const countResult = await conn.query(`SELECT COUNT(*) AS cnt FROM ${tableName}`);
          const countRows = (countResult as any).toArray?.() ?? [];
          const count = countRows.length ? Number(countRows[0].cnt ?? 0) : 0;
          console.log(`[DuckDB] (${context}) table ${tableName}: ${count} rows`);
        } catch (error) {
          console.warn(`[DuckDB] (${context}) failed to count rows for ${tableName}`, error);
        }
      }
      if (tables.length > 25) {
        console.log(`[DuckDB] (${context}) additional tables not logged: ${tables.length - 25}`);
      }
    } catch (error) {
      console.warn('[DuckDB] logCacheState failed', error);
    }
  }

  private static summarizeSql(sql: string): string {
    const trimmed = sql.replace(/\s+/g, ' ').trim();
    if (!trimmed) return '(empty SQL)';
    const firstSpace = trimmed.indexOf(' ');
    if (firstSpace === -1) return trimmed.slice(0, 120);
    const keyword = trimmed.slice(0, firstSpace).toUpperCase();
    let remainder = trimmed.slice(firstSpace + 1).trim();
    if (keyword === 'SELECT') {
      const fromIndex = remainder.toUpperCase().indexOf(' FROM ');
      if (fromIndex !== -1) {
        const table = remainder.slice(fromIndex + 6).split(/\s+/)[0];
        return `SELECT ... FROM ${table}`;
      }
    } else if (keyword === 'INSERT' || keyword === 'UPDATE' || keyword === 'DELETE' || keyword === 'DROP') {
      const parts = remainder.split(/\s+/);
      const table = parts.length ? parts[0] : '';
      return `${keyword} ${table}`;
    }
    return trimmed.slice(0, 160);
  }
}

// Expose DuckDB static API on window/globalThis for console debugging
try {
  (globalThis as any).DuckDB = DuckDB;
} catch {
  // ignore
}