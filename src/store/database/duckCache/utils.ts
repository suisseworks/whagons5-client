/**
 * Quote identifier for DuckDB SQL (handles special characters)
 */
export function quoteIdentifier(name: string): string {
  const safe = String(name).replace(/"/g, '""');
  return `"${safe}"`;
}

/**
 * Simple heuristic to turn a JS value into a SQL literal, respecting
 * NULL vs text/number/boolean. Callers should still use parameterized
 * queries for ad-hoc SQL; this is only for cache ingestion.
 */
export function toSqlLiteral(v: any): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') {
    return Number.isFinite(v) ? String(v) : 'NULL';
  }
  if (typeof v === 'boolean') {
    return v ? 'TRUE' : 'FALSE';
  }
  // Handle JSON objects and arrays - stringify them properly
  if (Array.isArray(v) || (typeof v === 'object' && v !== null)) {
    try {
      const jsonStr = JSON.stringify(v);
      const escaped = jsonStr.replace(/'/g, "''");
      return `'${escaped}'`;
    } catch {
      // Fallback to string conversion if JSON.stringify fails
      const s = String(v);
      if (!s.length) return 'NULL';
      const escaped = s.replace(/'/g, "''");
      return `'${escaped}'`;
    }
  }
  const s = String(v);
  if (!s.length) return 'NULL';
  const escaped = s.replace(/'/g, "''");
  return `'${escaped}'`;
}

/**
 * Normalize all ID fields (ending with _id or exactly 'id') to JS numbers when possible
 * to ensure strict equality checks against numeric ids work across the app.
 */
export function normalizeRowIds(row: any): any {
  try {
    if (!row || typeof row !== 'object') return row;
    const normalized: any = { ...row };
    for (const key of Object.keys(normalized)) {
      const value = normalized[key];
      if (key === 'id' || key.endsWith('_id')) {
        if (value != null) {
          const num = toJsNumber(value);
          if (typeof num === 'number' && Number.isFinite(num)) {
            normalized[key] = num;
          }
        }
      } else if (key === 'user_ids' && Array.isArray(value)) {
        normalized[key] = value.map((v: any) => {
          const n = toJsNumber(v);
          return typeof n === 'number' && Number.isFinite(n) ? n : v;
        });
      }
    }
    return normalized;
  } catch {
    return row;
  }
}

/**
 * Convert a value to a JavaScript number if possible, otherwise return the original value.
 */
export function toJsNumber(v: any): number | any {
  if (v == null) return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : v;
  if (typeof v === 'string') {
    const num = Number(v);
    return Number.isFinite(num) ? num : v;
  }
  return v;
}

