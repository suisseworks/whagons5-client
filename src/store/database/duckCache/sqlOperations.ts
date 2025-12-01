import { toSqlLiteral } from './utils';

export interface SqlOperationContext {
  table: string;
  columns: string[];
  idField: string;
  qi: (name: string) => string;
  toSqlLiteral: (v: any) => string;
}

/**
 * Build INSERT OR REPLACE SQL for a single row.
 */
export function buildUpsertSql(ctx: SqlOperationContext, row: any): string {
  const idVal = row?.[ctx.idField];
  if (idVal === undefined || idVal === null) {
    throw new Error(`Row missing id field: ${ctx.idField}`);
  }
  const idNumeric = Number(idVal);
  const idLiteral = Number.isFinite(idNumeric)
    ? `${idNumeric}`
    : `'${String(idVal).replace(/'/g, "''")}'`;

  const cols: string[] = [];
  const vals: string[] = [];
  for (const col of ctx.columns) {
    cols.push(ctx.qi(col));
    if (col === ctx.idField) {
      vals.push(idLiteral);
    } else {
      vals.push(ctx.toSqlLiteral(row[col]));
    }
  }

  return `INSERT OR REPLACE INTO ${ctx.table} (${cols.join(', ')}) VALUES (${vals.join(', ')})`;
}

/**
 * Build bulk INSERT OR REPLACE SQL for multiple rows.
 */
export function buildBulkUpsertSql(ctx: SqlOperationContext, rows: any[]): string[] {
  const colsList = ctx.columns.map((c) => ctx.qi(c)).join(', ');
  const sqlStatements: string[] = [];

  for (const row of rows) {
    const idVal = row?.[ctx.idField];
    if (idVal === undefined || idVal === null) continue;

    const idNumeric = Number(idVal);
    const idLiteral = Number.isFinite(idNumeric)
      ? `${idNumeric}`
      : `'${String(idVal).replace(/'/g, "''")}'`;

    const vals: string[] = [];
    for (const col of ctx.columns) {
      if (col === ctx.idField) {
        vals.push(idLiteral);
      } else {
        vals.push(ctx.toSqlLiteral(row[col]));
      }
    }
    sqlStatements.push(`INSERT OR REPLACE INTO ${ctx.table} (${colsList}) VALUES (${vals.join(', ')})`);
  }

  return sqlStatements;
}

/**
 * Build DELETE SQL for a single ID.
 */
export function buildDeleteSql(ctx: SqlOperationContext, id: number | string): string {
  const idNumeric = Number(id);
  const idLiteral = Number.isFinite(idNumeric)
    ? `${idNumeric}`
    : `'${String(id).replace(/'/g, "''")}'`;
  return `DELETE FROM ${ctx.table} WHERE ${ctx.qi(ctx.idField)} = ${idLiteral}`;
}

/**
 * Build DELETE SQL for multiple IDs.
 */
export function buildBulkDeleteSql(ctx: SqlOperationContext, ids: (number | string)[]): string {
  const idList = ids.map(id => {
    const idNumeric = Number(id);
    return Number.isFinite(idNumeric) ? String(idNumeric) : `'${String(id).replace(/'/g, "''")}'`;
  }).join(',');
  return `DELETE FROM ${ctx.table} WHERE ${ctx.qi(ctx.idField)} IN (${idList})`;
}

/**
 * Build SELECT COUNT SQL.
 */
export function buildCountSql(ctx: SqlOperationContext): string {
  const idCol = ctx.qi(ctx.idField);
  return `SELECT COUNT(*) AS cnt FROM ${ctx.table} WHERE ${idCol} IS NOT NULL`;
}

/**
 * Build SELECT all SQL.
 */
export function buildSelectAllSql(ctx: SqlOperationContext): string {
  return `SELECT * FROM ${ctx.table}`;
}

/**
 * Build SELECT IDs SQL.
 */
export function buildSelectIdsSql(ctx: SqlOperationContext): string {
  const idCol = ctx.qi(ctx.idField);
  return `SELECT ${idCol} FROM ${ctx.table} WHERE ${idCol} IS NOT NULL ORDER BY ${idCol}`;
}

