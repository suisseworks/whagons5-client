/**
 * Task-specific utility functions for DuckTaskCache.
 */

export function numOrNull(v: any): string {
  if (v === null || v === undefined || v === '') return 'NULL';
  const n = Number(v);
  return Number.isFinite(n) ? `${n}` : 'NULL';
}

export function textOrNull(v: any): string {
  if (v === null || v === undefined) return 'NULL';
  const s = String(v);
  if (!s.length) return 'NULL';
  const escaped = s.replace(/'/g, "''");
  return `'${escaped}'`;
}

export function parseUserIdsText(text: any): number[] | null {
  if (text == null) return null;
  const s = String(text).trim();
  if (!s) return null;
  // Expect format like "[1,2,3]"; tolerate whitespace
  const m = s.match(/^\[\s*([0-9,\s]*)\s*\]$/);
  if (!m) return null;
  const list = m[1]
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n));
  return list.length ? list : [];
}

export function formatUserIdsText(ids: any): string {
  if (!Array.isArray(ids)) return '[]';
  const nums = ids
    .map((x: any) => Number(x))
    .filter((n: number) => Number.isFinite(n))
    .sort((a: number, b: number) => a - b);
  return nums.length ? `[${nums.join(',')}]` : '[]';
}

export function toEpochMsString(v: any): string {
  if (!v) return '';
  let s = String(v);
  // If timestamp lacks timezone, assume UTC and force 'Z'
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s) && !/[zZ]|[+\-]\d{2}:?\d{2}$/.test(s)) {
    s = s.replace(' ', 'T') + 'Z';
  }
  const d = new Date(s);
  const ms = d.getTime();
  return Number.isFinite(ms) ? String(ms) : '';
}

