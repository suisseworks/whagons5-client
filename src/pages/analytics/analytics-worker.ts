// Simple analytics aggregation worker
// Receives: { type: 'pivot', tasks: TaskLike[], rows: string[], columns: string[], filters?: { createdAfter?: number } }
// Returns: { type: 'pivot_result', rows: string[], columns: string[], matrix: number[][] }

export type TaskLike = {
  id: number;
  created_at: string;
  status_id?: number;
  team_id?: number;
  category_id?: number;
  [k: string]: any;
};

export type PivotMsg = {
  type: 'pivot';
  tasks: TaskLike[];
  rows: string[]; // precomputed dimension labels per task will exist under these keys on the task
  columns: string[];
  filters?: { createdAfter?: number };
};

export type PivotResult = {
  type: 'pivot_result';
  rows: string[];
  columns: string[];
  matrix: number[][]; // rows x columns
};

function ensureLabel(v: unknown): string {
  if (v === null || v === undefined) return 'Unknown';
  const s = String(v);
  return s.trim().length === 0 ? 'Unknown' : s;
}

function makeKey(parts: string[]): string {
  return parts.map(ensureLabel).join(' | ');
}

self.onmessage = (e: MessageEvent<PivotMsg>) => {
  const msg = e.data;
  if (!msg || msg.type !== 'pivot') return;
  const { tasks, rows, columns, filters } = msg;
  try {
    const rowSet = new Set<string>();
    const colSet = new Set<string>();
    const countMap = new Map<string, number>(); // key: rowKey\tcolKey

    for (const t of tasks) {
      if (filters?.createdAfter) {
        const createdMs = new Date(t.created_at).getTime();
        if (!isFinite(createdMs) || createdMs < filters.createdAfter) continue;
      }
      const rowKey = rows.length ? makeKey(rows.map((r) => ensureLabel((t as any)[r]))) : 'All';
      const colKey = columns.length ? makeKey(columns.map((c) => ensureLabel((t as any)[c]))) : 'All';
      rowSet.add(rowKey);
      colSet.add(colKey);
      const key = rowKey + '\t' + colKey;
      countMap.set(key, (countMap.get(key) || 0) + 1);
    }

    const rowLabels = Array.from(rowSet.values()).sort((a, b) => a.localeCompare(b));
    const colLabels = Array.from(colSet.values()).sort((a, b) => a.localeCompare(b));
    const matrix: number[][] = rowLabels.map((rk) => colLabels.map((ck) => countMap.get(rk + '\t' + ck) || 0));

    const out: PivotResult = { type: 'pivot_result', rows: rowLabels, columns: colLabels, matrix };
    (self as any).postMessage(out);
  } catch (_e) {
    const out: PivotResult = { type: 'pivot_result', rows: [], columns: [], matrix: [] };
    (self as any).postMessage(out);
  }
};


