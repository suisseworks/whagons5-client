import { DuckDB } from '../DuckDB';

function toHexString(val: any): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer?.(val)) {
    return val.toString('hex');
  }
  if (val instanceof Uint8Array || Array.isArray(val)) {
    const uint = val instanceof Uint8Array ? val : Uint8Array.from(val as any);
    return Array.from(uint)
      .map((b) => Number(b).toString(16).padStart(2, '0'))
      .join('');
  }
  return String(val);
}

export interface HashComputationContext {
  table: string;
  idField: string;
  blockSize: number;
  buildRowExprSql: () => string;
  qi: (name: string) => string;
  computeAllLocalRowHashes?: () => Promise<void>;
}

/**
 * Compute local row hashes in a bounded id range.
 */
export async function computeLocalRowHashesInRange(
  ctx: HashComputationContext,
  minId: number,
  maxId: number
): Promise<Array<{ row_id: number; row_hash: string }>> {
  if (!(await DuckDB.init())) return [];
  
  const rowExpr = ctx.buildRowExprSql();
  const idCol = ctx.qi(ctx.idField);
  const sql = `
    SELECT
      CAST(${idCol} AS BIGINT) AS row_id,
      sha256(${rowExpr}) AS row_hash
    FROM ${ctx.table}
    WHERE ${idCol} IS NOT NULL AND CAST(${idCol} AS BIGINT) >= ${minId} AND CAST(${idCol} AS BIGINT) <= ${maxId}
    ORDER BY ${idCol}
  `;
  
  let table;
  try {
    table = await DuckDB.query(sql);
  } catch (error: any) {
    const errorMsg = String(error?.message || error || '');
    if (errorMsg.includes('not found') || errorMsg.includes('Referenced column')) {
      // Schema migration should be handled by caller
      return [];
    }
    throw error;
  }
  
  if (!table) return [];
  const arr = (table as any).toArray?.() ?? [];
  return arr.map((r: any) => ({
    row_id: Number(r.row_id),
    row_hash: toHexString(r.row_hash),
  }));
}

/**
 * Compute local integrity blocks from row hashes.
 */
export async function computeLocalBlocksFromRowHashes(
  ctx: HashComputationContext
): Promise<Array<{
  block_id: number;
  min_row_id: number;
  max_row_id: number;
  row_count: number;
  block_hash: string;
}>> {
  if (!(await DuckDB.init())) return [];

  // Ensure row hashes are computed if needed
  if (ctx.computeAllLocalRowHashes) {
    await ctx.computeAllLocalRowHashes();
  }

  const sql = `
    WITH rows AS (
      SELECT
        CAST(${ctx.qi(ctx.idField)} AS BIGINT) AS id,
        CAST(FLOOR(CAST(${ctx.qi(ctx.idField)} AS BIGINT) / ${ctx.blockSize}) AS BIGINT) AS block_id,
        sha256(${ctx.buildRowExprSql()}) AS row_hash
      FROM ${ctx.table}
      WHERE ${ctx.qi(ctx.idField)} IS NOT NULL
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
      block_hash: toHexString(r.block_hash),
    }))
    .filter((b: { block_id: number }) => Number.isFinite(b.block_id));
}

/**
 * Compute local blocks from row expression (includes row_expr_value for debugging).
 * This is used by incremental repair to compare block-level hashes.
 */
export async function computeLocalBlocksFromRowExpr(
  ctx: HashComputationContext
): Promise<Array<{
  block_id: number;
  min_row_id: number;
  max_row_id: number;
  row_count: number;
  block_hash: string;
}>> {
  if (!(await DuckDB.init())) return [];
  
  const rowExpr = ctx.buildRowExprSql();
  const idCol = ctx.qi(ctx.idField);
  const BLOCK_SIZE = ctx.blockSize;
  const sql = `
    WITH rows AS (
      SELECT
        CAST(${idCol} AS BIGINT) AS row_id,
        sha256(${rowExpr}) AS row_hash,
        ${rowExpr} AS row_expr_value
      FROM ${ctx.table}
      WHERE ${idCol} IS NOT NULL
    ),
    bucketed AS (
      SELECT
        row_id,
        row_hash,
        row_expr_value,
        CAST(FLOOR(row_id / ${BLOCK_SIZE}) AS BIGINT) AS block_id
      FROM rows
    )
    SELECT
      block_id,
      MIN(row_id)::BIGINT AS min_row_id,
      MAX(row_id)::BIGINT AS max_row_id,
      COUNT(*)::BIGINT AS row_count,
      sha256(string_agg(row_hash, '' ORDER BY row_id)) AS block_hash,
      string_agg(row_expr_value, '|' ORDER BY row_id) AS block_row_exprs
    FROM bucketed
    GROUP BY block_id
    ORDER BY block_id
  `;
  
  let table;
  try {
    table = await DuckDB.query(sql);
  } catch (error: any) {
    const errorMsg = String(error?.message || error || '');
    if (errorMsg.includes('not found') || errorMsg.includes('Referenced column')) {
      // Schema migration should be handled by caller
      return [];
    }
    throw error;
  }
  
  if (!table) return [];
  const arr = (table as any).toArray?.() ?? [];
  return arr
    .map((r: any) => ({
      block_id: Number(r.block_id),
      min_row_id: Number(r.min_row_id),
      max_row_id: Number(r.max_row_id),
      row_count: Number(r.row_count ?? 0),
      block_hash: toHexString(r.block_hash),
    }))
    .filter((b: { block_id: number }) => Number.isFinite(b.block_id));
}

/**
 * Compute a single global hash over all rows.
 */
export async function computeLocalGlobalHash(
  ctx: HashComputationContext
): Promise<string | null> {
  if (!(await DuckDB.init())) return null;

  // Ensure row hashes are computed if needed
  if (ctx.computeAllLocalRowHashes) {
    await ctx.computeAllLocalRowHashes();
  }

  const rowExpr = ctx.buildRowExprSql();
  const idCol = ctx.qi(ctx.idField);

  const blockSize = ctx.blockSize;
  const sql = `
    WITH rows AS (
      SELECT
        CAST(${idCol} AS BIGINT) AS row_id,
        sha256(${rowExpr}) AS row_hash,
        CAST(FLOOR(CAST(${idCol} AS BIGINT) / ${blockSize}) AS BIGINT) AS block_id
      FROM ${ctx.table}
      WHERE ${idCol} IS NOT NULL
    ),
    blocks AS (
      SELECT
        block_id,
        COUNT(*)::BIGINT AS row_count,
        sha256(string_agg(row_hash, '' ORDER BY row_id)) AS block_hash
      FROM rows
      GROUP BY block_id
    ),
    concat AS (
      SELECT
        SUM(row_count)::BIGINT AS total_rows,
        sha256(string_agg(block_hash, '' ORDER BY block_id)) AS global_hash
      FROM blocks
    )
    SELECT total_rows AS row_count, global_hash FROM concat
  `;

  let table;
  try {
    table = await DuckDB.query(sql);
  } catch (error: any) {
    const errorMsg = String(error?.message || error || '');
    if (errorMsg.includes('not found') || errorMsg.includes('Referenced column')) {
      return null;
    }
    throw error;
  }
  
  if (!table) return null;
  const arr = (table as any).toArray?.() ?? [];
  if (!arr.length) return null;
  
  const row = arr[0] as any;
  const rowCount = Number(row.row_count ?? 0);
  const hash = toHexString(row.global_hash);
  if (!rowCount || !hash) return null;
  return String(hash);
}

