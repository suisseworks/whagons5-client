import { DuckDB } from '../DuckDB';
import { DuckColumn } from './types';

export interface SchemaMigrationContext {
  table: string;
  columns: Array<string>;
  columnDefs: Array<DuckColumn<any>>;
  qi: (name: string) => string;
  log: (...args: any[]) => void;
}

/**
 * Check if a column exists in the DuckDB table.
 */
export async function columnExists(table: string, column: string): Promise<boolean> {
  try {
    const t = await DuckDB.query(`PRAGMA table_info('${table}')`);
    const arr = t ? (t as any).toArray?.() ?? [] : [];
    return arr.some((r: any) => {
      const name = String(r.name ?? r.column_name ?? r.column ?? r.columnname ?? '');
      return name === column;
    });
  } catch {
    return false;
  }
}

/**
 * Migrate schema by adding any missing columns from hashFields/columns.
 * Returns true if any columns were added, false otherwise.
 */
export async function migrateSchema(ctx: SchemaMigrationContext): Promise<boolean> {
  if (!(await DuckDB.init())) return false;
  
  const allRequiredColumns = new Set<string>();
  // Add all columns from columnDefs
  for (const col of ctx.columnDefs) {
    allRequiredColumns.add(String(col.name));
  }
  // Also ensure all hashFields have columns (if hashFields is defined)
  // This is handled by the caller passing all required columns in columnDefs

  let addedAny = false;
  for (const colName of allRequiredColumns) {
    const exists = await columnExists(ctx.table, colName);
    if (!exists) {
      const def = ctx.columnDefs.find((c) => c.name === colName);
      if (!def) continue;
      
      const type = def.type;
      const colDef = `${ctx.qi(colName)} ${type}`;
      
      try {
        await DuckDB.exec(`ALTER TABLE ${ctx.table} ADD COLUMN ${colDef}`);
        ctx.log('migrateSchema: added column', { table: ctx.table, column: colName, type });
        addedAny = true;
      } catch (e: any) {
        const errorMsg = String(e?.message || e || '');
        // If column already exists (race condition), that's fine
        if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
          ctx.log('migrateSchema: column already exists (race condition)', { table: ctx.table, column: colName });
        } else {
          ctx.log('migrateSchema: failed to add column', { table: ctx.table, column: colName, error: errorMsg });
        }
      }
    }
  }
  
  return addedAny;
}

