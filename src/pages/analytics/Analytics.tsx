import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faChartLine } from "@fortawesome/free-solid-svg-icons";
import ReactECharts from "echarts-for-react";
import { DndContext, useDraggable, useDroppable, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TasksCache } from "@/store/indexedDB/TasksCache";
import { DB } from "@/store/indexedDB/DB";
import type { Task } from "@/store/types";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Aggregation = 'count';
interface ReportValue { field: string; agg: Aggregation; }
type VizType = 'bar' | 'stacked_bar' | 'line' | 'table';
interface ReportDef {
  name: string;
  dataset: 'tasks_v1';
  kind: 'status_team_90d' | 'throughput_month_created';
  rows?: string[];
  columns?: string[];
  values?: ReportValue[];
  filters?: Array<{ field: string; op: string; value: any }>;
  viz?: { type: VizType };
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Unknown";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function lastNMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const di = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    keys.push(`${di.getUTCFullYear()}-${String(di.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function Analytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusMap, setStatusMap] = useState<Record<number, string>>({});
  const [teamMap, setTeamMap] = useState<Record<number, string>>({});
  const [report, setReport] = useState<ReportDef>({
    name: 'Tasks by Status x Team (Last 90d)',
    dataset: 'tasks_v1',
    kind: 'status_team_90d',
    viz: { type: 'stacked_bar' }
  });
  const [savedReports, setSavedReports] = useState<Array<{ id: string; name: string; def: ReportDef }>>([]);
  const [rowsZone, setRowsZone] = useState<string[]>(['team']);
  const [colsZone, setColsZone] = useState<string[]>(['status']);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await TasksCache.init();
        const [ts, statuses, teams] = await Promise.all([
          TasksCache.getTasks(),
          DB.getAll("statuses"),
          DB.getAll("teams"),
        ]);
        if (cancelled) return;
        setTasks(ts || []);
        const sm: Record<number, string> = {};
        for (const s of (statuses || [])) {
          if (s && typeof s.id === "number") sm[s.id] = s.name || String(s.id);
        }
        const tm: Record<number, string> = {};
        for (const t of (teams || [])) {
          if (t && typeof t.id === "number") tm[t.id] = t.name || String(t.id);
        }
        setStatusMap(sm);
        setTeamMap(tm);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const ninetyDaysAgo = useMemo(() => daysAgo(90), []);

  const statusCounts90d = useMemo(() => {
    if (report.kind !== 'status_team_90d') return { labels: [], values: [] };
    const counts = new Map<number, number>();
    for (const t of tasks) {
      const created = new Date(t.created_at);
      if (isNaN(created.getTime()) || created < ninetyDaysAgo) continue;
      const key = t.status_id;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    // Convert to arrays sorted desc by count
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const labels = entries.map(([id]) => statusMap[id] || String(id));
    const values = entries.map(([, c]) => c);
    return { labels, values };
  }, [tasks, statusMap, ninetyDaysAgo, report.kind]);

  const throughputByMonth = useMemo(() => {
    if (report.kind !== 'throughput_month_created') return { labels: [], values: [] };
    const months = lastNMonthKeys(12);
    const initial: Record<string, number> = months.reduce((acc, k) => (acc[k] = 0, acc), {} as Record<string, number>);
    for (const t of tasks) {
      const key = monthKey(t.created_at);
      if (initial[key] != null) initial[key] += 1;
    }
    const labels = months;
    const values = months.map((m) => initial[m] || 0);
    return { labels, values };
  }, [tasks, report.kind]);

  const statusTeamPivot = useMemo(() => {
    if (report.kind !== 'status_team_90d') return { teams: [], statuses: [], matrix: [] as number[][] };
    const since = ninetyDaysAgo;
    const teamIdsSet = new Set<number>();
    const statusIdsSet = new Set<number>();
    const counts = new Map<number, Map<number, number>>(); // status -> team -> count
    for (const t of tasks) {
      const created = new Date(t.created_at);
      if (isNaN(created.getTime()) || created < since) continue;
      const st = t.status_id;
      const tm = t.team_id;
      if (st == null || tm == null) continue;
      statusIdsSet.add(st);
      teamIdsSet.add(tm);
      const byTeam = counts.get(st) || new Map<number, number>();
      byTeam.set(tm, (byTeam.get(tm) || 0) + 1);
      counts.set(st, byTeam);
    }
    const teams = Array.from(teamIdsSet.values()).sort((a, b) => (teamMap[a] || '').localeCompare(teamMap[b] || ''));
    const statuses = Array.from(statusIdsSet.values()).sort((a, b) => (statusMap[a] || '').localeCompare(statusMap[b] || ''));
    const matrix: number[][] = statuses.map((sid) => teams.map((tid) => counts.get(sid)?.get(tid) || 0));
    return { teams: teams.map((id) => teamMap[id] || String(id)), statuses: statuses.map((id) => statusMap[id] || String(id)), matrix };
  }, [tasks, teamMap, statusMap, ninetyDaysAgo, report.kind]);

  // --- DnD builder minimal ---
  const availableDimensions = useMemo(() => ([
    { id: 'status', label: 'Status' },
    { id: 'team', label: 'Team' },
    { id: 'category', label: 'Category' },
    { id: 'created_month', label: 'Created Month' },
  ]), []);

  // Precompute per-task dimension labels for worker consumption
  const taskWithDims = useMemo(() => {
    return tasks.map(t => ({
      ...t,
      status: statusMap[t.status_id] || String(t.status_id || ''),
      team: teamMap[t.team_id] || String(t.team_id || ''),
      category: String(t.category_id || ''),
      created_month: monthKey(t.created_at),
    }));
  }, [tasks, statusMap, teamMap]);

  const [pivotResult, setPivotResult] = useState<{ rows: string[]; columns: string[]; matrix: number[][] } | null>(null);
  const [workerRef, setWorkerRef] = useState<Worker | null>(null);

  useEffect(() => {
    const w = new Worker(new URL('./analytics-worker.ts', import.meta.url), { type: 'module' });
    setWorkerRef(w as any);
    const onMsg = (ev: MessageEvent<any>) => {
      if (ev?.data?.type === 'pivot_result') {
        setPivotResult({ rows: ev.data.rows, columns: ev.data.columns, matrix: ev.data.matrix });
      }
    };
    (w as any).addEventListener('message', onMsg);
    return () => {
      (w as any).removeEventListener('message', onMsg);
      (w as any).terminate?.();
    };
  }, []);

  useEffect(() => {
    if (!workerRef) return;
    if (rowsZone.length === 0 && colsZone.length === 0) return;
    const since = report.kind === 'status_team_90d' ? ninetyDaysAgo.getTime() : undefined;
    const msg = {
      type: 'pivot',
      tasks: taskWithDims,
      rows: rowsZone,
      columns: colsZone,
      filters: since ? { createdAfter: since } : undefined,
    } as any;
    workerRef.postMessage(msg);
  }, [workerRef, taskWithDims, rowsZone, colsZone, report.kind, ninetyDaysAgo]);

  function FieldPill({ id, label }: { id: string; label: string }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
    const style: React.CSSProperties = {
      transform: CSS.Translate.toString(transform),
      opacity: isDragging ? 0.6 : 1,
    };
    return (
      <div ref={setNodeRef} style={style} className="px-2 py-1 rounded border text-xs bg-background cursor-grab" {...listeners} {...attributes}>
        {label}
      </div>
    );
  }

  function Zone({ title, items, onDrop }: { title: string; items: string[]; onDrop: (id: string) => void }) {
    const { isOver, setNodeRef } = useDroppable({ id: title });
    return (
      <div ref={setNodeRef} className={`p-2 rounded border ${isOver ? 'bg-muted/50' : ''}`}>
        <div className="text-xs text-muted-foreground mb-2">{title}</div>
        <div className="flex items-center gap-2 flex-wrap">
          {items.map((it) => {
            const found = availableDimensions.find(d => d.id === it);
            return <div key={it} className="px-2 py-1 rounded border text-xs bg-muted">{found?.label || it}</div>;
          })}
        </div>
      </div>
    );
  }

  function onDragEnd(ev: DragEndEvent) {
    const id = String(ev.active?.id || '');
    const overId = String(ev.over?.id || '');
    if (!id || !overId) return;
    if (!availableDimensions.some(d => d.id === id)) return;
    if (overId === 'Rows') {
      if (!rowsZone.includes(id)) setRowsZone((prev) => [...prev, id]);
    } else if (overId === 'Columns') {
      if (!colsZone.includes(id)) setColsZone((prev) => [...prev, id]);
    }
  }

  const statusChartOption = useMemo(() => {
    if (report.kind !== 'status_team_90d') return undefined;
    if (statusTeamPivot.teams.length > 0 && statusTeamPivot.statuses.length > 0) {
      return {
        tooltip: { trigger: "axis" },
        legend: { top: 0 },
        grid: { left: 40, right: 20, top: 40, bottom: 40 },
        xAxis: { type: "category", data: statusTeamPivot.teams, axisLabel: { interval: 0, rotate: 20 } },
        yAxis: { type: "value" },
        series: statusTeamPivot.statuses.map((sname, idx) => ({
          name: sname,
          type: "bar",
          stack: "total",
          data: statusTeamPivot.matrix[idx],
        }))
      } as any;
    }
    // Fallback to simple status counts
    return {
      tooltip: { trigger: "axis" },
      grid: { left: 40, right: 20, top: 20, bottom: 40 },
      xAxis: { type: "category", data: statusCounts90d.labels, axisLabel: { interval: 0, rotate: 30 } },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: statusCounts90d.values, itemStyle: { color: "#3b82f6" } }]
    } as any;
  }, [statusTeamPivot, statusCounts90d, report.kind]);

  const throughputChartOption = useMemo(() => ({
    tooltip: { trigger: "axis" },
    grid: { left: 40, right: 20, top: 20, bottom: 40 },
    xAxis: { type: "category", data: throughputByMonth.labels },
    yAxis: { type: "value" },
    series: [{ type: "line", data: throughputByMonth.values, smooth: true, areaStyle: {} }]
  }), [throughputByMonth]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('wh-analytics-reports');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setSavedReports(arr);
      }
    } catch {}
  }, []);

  function saveCurrentReport() {
    const name = prompt('Save report as:', report.name || 'Untitled Report');
    if (!name) return;
    const entry = { id: `${Date.now()}`, name, def: report };
    const next = [...savedReports, entry];
    setSavedReports(next);
    try { localStorage.setItem('wh-analytics-reports', JSON.stringify(next)); } catch {}
  }

  function loadReportById(id: string) {
    const found = savedReports.find(r => r.id === id);
    if (found) setReport(found.def);
  }

  const handleBackClick = () => { navigate('/'); };

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
          <button onClick={handleBackClick} className="flex items-center space-x-1 hover:text-foreground transition-colors">
            <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
            <span>Back</span>
          </button>
          <span>»</span>
          <span className="text-foreground">Analytics</span>
        </nav>
        <div className="flex items-center space-x-3">
          <FontAwesomeIcon icon={faChartLine} className="text-blue-500 text-2xl" />
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        </div>
        <p className="text-muted-foreground">Insights and metrics across your workspaces.</p>
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm"
            onClick={() => setReport({ name: 'Tasks by Status x Team (Last 90d)', dataset: 'tasks_v1', kind: 'status_team_90d', viz: { type: 'stacked_bar' } })}
          >
            Preset: Status × Team (90d)
          </button>
          <button
            className="px-3 py-1.5 rounded-md bg-slate-700 text-white hover:bg-slate-800 text-sm"
            onClick={() => setReport({ name: 'Throughput by Month (Created)', dataset: 'tasks_v1', kind: 'throughput_month_created', viz: { type: 'line' } })}
          >
            Preset: Throughput by Month
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-md border text-sm" onClick={saveCurrentReport}>Save</button>
          {savedReports.length > 0 && (
            <select className="px-2 py-1.5 border rounded-md text-sm bg-background" onChange={(e) => e.target.value && loadReportById(e.target.value)} defaultValue="">
              <option value="" disabled>Load…</option>
              {savedReports.map(r => (<option key={r.id} value={r.id}>{r.name}</option>))}
            </select>
          )}
        </div>
      </div>

      {/* Builder */}
      <DndContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1 p-3 rounded border space-y-2">
            <div className="font-medium text-sm">Fields</div>
            <div className="flex items-center gap-2 flex-wrap">
              {availableDimensions.map((d) => (
                <FieldPill key={d.id} id={d.id} label={d.label} />
              ))}
            </div>
          </div>
          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Zone title="Rows" items={rowsZone} onDrop={(id) => setRowsZone((p) => [...p, id])} />
            <Zone title="Columns" items={colsZone} onDrop={(id) => setColsZone((p) => [...p, id])} />
          </div>
        </div>
      </DndContext>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading local data…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{report.kind === 'status_team_90d' ? 'Tasks by Status × Team (Last 90 days)' : 'Throughput by Month (Created)'}</CardTitle>
              <CardDescription>
                {report.kind === 'status_team_90d' ? 'Stacked by status across teams' : 'New tasks per month (last 12 months)'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.kind === 'status_team_90d' && statusChartOption && (
                <>
                  <ReactECharts option={statusChartOption} notMerge={true} lazyUpdate={true} style={{ height: 360 }} />
                  <div className="mt-4 overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="text-left pr-4 py-1">Team</th>
                          {statusTeamPivot.statuses.map((s) => (
                            <th key={s} className="text-right py-1 px-2">{s}</th>
                          ))}
                          <th className="text-right py-1 px-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statusTeamPivot.teams.map((teamName, tIdx) => {
                          const cells = statusTeamPivot.matrix.map((row) => row[tIdx] || 0);
                          const total = cells.reduce((a, b) => a + b, 0);
                          return (
                            <tr key={teamName} className="border-t border-border/50">
                              <td className="pr-4 py-1">{teamName}</td>
                              {cells.map((v, i) => (<td key={i} className="text-right py-1 px-2">{v}</td>))}
                              <td className="text-right py-1 px-2 font-medium">{total}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {report.kind === 'throughput_month_created' && (
                <ReactECharts option={throughputChartOption} notMerge={true} lazyUpdate={true} style={{ height: 360 }} />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default Analytics;
