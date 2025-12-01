import { HashComputationContext } from './types';

/**
 * Builds SQL expression for row hash computation that matches backend compute_row_hash_string() function.
 * This implements the same normalization rules as the backend PostgreSQL function.
 */
export function buildRowExprSql(ctx: HashComputationContext): string {
  const fields = ctx.hashFields && ctx.hashFields.length > 0 ? ctx.hashFields : ctx.columns;
  const availableColumns = new Set(ctx.columns.map((c: any) => String(c)));
  const exprs: string[] = [];
  
  for (const field of fields) {
    const col = String(field);
    
    if (!availableColumns.has(col)) {
      exprs.push(`''`);
      continue;
    }
    
    const def = ctx.columnDefs.find((c) => c.name === col);
    const type = def?.type;
    
    // Match backend normalization rules from compute_row_hash_string()
    const isBooleanField =
      col.startsWith('is_') ||
      ['enabled', 'required', 'system', 'initial', 'final', 'has_active_subscription'].includes(col);
    const isTimestampName = col.endsWith('_at') || col.endsWith('_date');
    const isIdField = col.endsWith('_id');

    // Special case: user_ids_text for tasks (frontend mirror of backend user_ids handling)
    // Backend ultimately hashes the normalized string representation of the array, e.g. "[1,2,3]" or "[]".
    // Backend checks NULL first, then processes user_ids as array → string
    if (col === 'user_ids_text' && ctx.serverTable === 'wh_tasks') {
      // Match backend: NULL or empty → '', otherwise trim the stored normalized string
      exprs.push(
        `CASE 
          WHEN ${ctx.qi(col)} IS NULL OR TRIM(CAST(${ctx.qi(col)} AS VARCHAR)) = '' THEN '' 
          ELSE TRIM(CAST(${ctx.qi(col)} AS VARCHAR))
        END`
      );
      continue;
    }

    // Match backend normalization rules exactly (same order as backend IF/ELSIF chain):
    // 1. NULL → based on field name pattern (*_id → '0', *_at/*_date → '', is_* → 'f', else → '')
    // 2. *_at / *_date → UTC epoch milliseconds
    // 3. user_ids → sorted array format (handled server-side; here we trust the stored string)
    // 4. is_* / booleans → 't' or 'f'
    // 5. else → trim text (numbers, text, JSON, etc.)
    
    // Build a CASE expression that matches backend NULL handling FIRST, then type-specific logic
    // Backend checks: IF field_value IS NULL OR field_value = 'null'::jsonb THEN ...
    // For DuckDB, we check IS NULL and also handle empty strings for text fields
    
    if (isTimestampName) {
      // Timestamps: Check NULL first (returns ''), then convert to UTC epoch milliseconds
      // Backend: ELSIF field_name LIKE '%_at' OR field_name LIKE '%_date' THEN ...
      if (type === 'TIMESTAMP') {
        // Native TIMESTAMP column: NULL → '', otherwise UTC epoch milliseconds
        exprs.push(
          `CASE 
            WHEN ${ctx.qi(col)} IS NULL THEN '' 
            ELSE CAST(CAST(epoch(${ctx.qi(col)}) * 1000 AS BIGINT) AS VARCHAR) 
          END`
        );
      } else {
        // Text column containing a timestamp string: NULL or empty → '', otherwise convert
        const trimmed = `TRIM(CAST(${ctx.qi(col)} AS VARCHAR))`;
        exprs.push(
          `CASE 
            WHEN ${ctx.qi(col)} IS NULL OR ${trimmed} = '' THEN '' 
            ELSE CAST(CAST(epoch(CAST(${trimmed} AS TIMESTAMP)) * 1000 AS BIGINT) AS VARCHAR) 
          END`
        );
      }
    } else if (col === 'user_ids') {
      // Special: user_ids array string (we expect normalized "[1,2,3]" or "[]")
      // Backend: ELSIF field_name = 'user_ids' THEN ... (checks NULL in outer IF)
      // NULL or empty → '', otherwise trim the stored normalized string
      exprs.push(
        `CASE 
          WHEN ${ctx.qi(col)} IS NULL OR TRIM(CAST(${ctx.qi(col)} AS VARCHAR)) = '' THEN '' 
          ELSE TRIM(CAST(${ctx.qi(col)} AS VARCHAR))
        END`
      );
    } else if (isBooleanField || type === 'BOOLEAN') {
      // Booleans: Check NULL first (returns 'f' for is_* fields), then 't' or 'f'
      // Backend: ELSIF field_name LIKE 'is_%' OR field_name IN (...) THEN ...
      // Backend NULL handling: sets to 'f' for is_* fields in the initial NULL check
      if (type === 'BOOLEAN') {
        exprs.push(
          `CASE 
            WHEN ${ctx.qi(col)} IS NULL THEN 'f' 
            WHEN ${ctx.qi(col)} THEN 't' 
            ELSE 'f' 
          END`
        );
      } else {
        // TEXT field that represents boolean: NULL or empty → 'f', otherwise parse
        const trimmed = `TRIM(CAST(${ctx.qi(col)} AS VARCHAR))`;
        exprs.push(
          `CASE 
            WHEN ${ctx.qi(col)} IS NULL OR ${trimmed} = '' THEN 'f'
            WHEN UPPER(${trimmed}) IN ('TRUE', 'T', '1', 'YES', 'Y', 'ON') THEN 't'
            ELSE 'f'
          END`
        );
      }
    } else if (isIdField) {
      // IDs: NULL → '0', otherwise cast to text (matches backend)
      // Backend: IF field_name LIKE '%_id' THEN normalized_values := array_append(normalized_values, '0')
      // Backend NULL handling: sets to '0' for *_id fields ONLY when field_value IS NULL
      // For non-NULL values (including empty strings), backend goes to ELSE branch and trims
      // So: NULL → '0', empty string → '' (via ELSE branch), otherwise cast to text
      exprs.push(
        `CASE 
          WHEN ${ctx.qi(col)} IS NULL THEN '0'
          ELSE COALESCE(NULLIF(TRIM(CAST(${ctx.qi(col)} AS VARCHAR)), ''), '')
        END`
      );
    } else {
      // Default: trim text (matches backend COALESCE(NULLIF(TRIM(val_text), ''), ''))
      // Backend: ELSE normalized_values := array_append(normalized_values, COALESCE(NULLIF(TRIM(val_text), ''), ''))
      // Backend NULL handling: sets to '' in the initial NULL check
      // This handles: numbers, text, JSONB arrays/objects (teams, spots, options, etc.)
      // Backend extracts JSONB as text first (val_text#>>'{}'), then trims
      // For JSONB fields stored as TEXT in DuckDB, we just trim the stored text
      exprs.push(
        `CASE 
          WHEN ${ctx.qi(col)} IS NULL THEN ''
          ELSE COALESCE(NULLIF(TRIM(CAST(${ctx.qi(col)} AS VARCHAR)), ''), '')
        END`
      );
    }
  }

  if (!exprs.length) {
    return `''`;
  }
  return `concat_ws('|', ${exprs.join(', ')})`;
}

