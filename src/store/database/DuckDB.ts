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
        const logger: any = useDebug ? new duckdb.ConsoleLogger() : { log: (_lvl: number, _origin: number, _code: number, _msg: string) => {} };
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
    try {
      return await conn.query(sql);
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
    try {
      await conn.query(sql);
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
    try {
      await this.conn?.close();
      // AsyncDuckDB does not currently expose an explicit close in all versions,
      // but if it does in the future, call it here.
    } catch {
      // ignore
    } finally {
      this.conn = null;
      this.db = null;
    }
  }
}

// Expose DuckDB static API on window/globalThis for console debugging
try {
  (globalThis as any).DuckDB = DuckDB;
} catch {
  // ignore
}