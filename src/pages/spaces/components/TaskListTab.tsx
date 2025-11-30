

import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { DuckTaskCache } from "@/store/database/DuckTaskCache";
import { TaskRow } from "@/components/TaskList/TaskRow";
import { motion } from "motion/react";

function createStatusMap(statuses: any[]) {
  const m: Record<number, any> = {};
  for (const s of statuses || []) m[Number(s.id)] = s;
  return m;
}

function createPriorityMap(priorities: any[]) {
  const m: Record<number, any> = {};
  for (const p of priorities || []) m[Number(p.id)] = p;
  return m;
}

function createSpotMap(spots: any[]) {
  const m: Record<number, any> = {};
  for (const sp of spots || []) m[Number(sp.id)] = sp;
  return m;
}

function createCategoryMap(categories: any[]) {
  const m: Record<number, any> = {};
  for (const c of categories || []) m[Number(c.id)] = c;
  return m;
}

export default function TaskListTab({
  workspaceId,
  searchText = "",
}: {
  workspaceId: string | undefined;
  searchText?: string;
}) {
  const statuses = useSelector((s: RootState) => (s as any).statuses.value as any[]);
  const priorities = useSelector((s: RootState) => (s as any).priorities.value as any[]);
  const spots = useSelector((s: RootState) => (s as any).spots.value as any[]);
  const categories = useSelector((s: RootState) => (s as any).categories.value as any[]);
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Get row density from localStorage and listen for changes
  const [density, setDensity] = useState<'compact' | 'comfortable' | 'spacious'>(() => {
    try { return (localStorage.getItem('wh_workspace_density') as 'compact' | 'comfortable' | 'spacious') || 'comfortable'; } 
    catch { return 'comfortable'; }
  });
  
  useEffect(() => {
    const handler = (e: any) => {
      const v = e?.detail as any;
      if (v === 'compact' || v === 'comfortable' || v === 'spacious') setDensity(v);
    };
    window.addEventListener('wh:rowDensityChanged', handler);
    return () => window.removeEventListener('wh:rowDensityChanged', handler);
  }, []);

  const statusMap = useMemo(() => createStatusMap(statuses || []), [statuses]);
  const priorityMap = useMemo(() => createPriorityMap(priorities || []), [priorities]);
  const spotMap = useMemo(() => createSpotMap(spots || []), [spots]);
  const categoryMap = useMemo(() => createCategoryMap(categories || []), [categories]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        setRows(null);
        await DuckTaskCache.init();
        const baseParams: any = { search: searchText };
        const ws = workspaceId && workspaceId !== "all" ? workspaceId : undefined;
        if (ws) baseParams.workspace_id = ws;
        const countResp = await DuckTaskCache.queryForAgGrid({ ...baseParams, startRow: 0, endRow: 0 });
        const total = countResp?.rowCount ?? 0;
        const rowsResp = await DuckTaskCache.queryForAgGrid({ ...baseParams, startRow: 0, endRow: Math.min(500, total) });
        if (!cancelled) setRows(rowsResp?.rows || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load tasks");
      }
    })();
    return () => { cancelled = true; };
  }, [workspaceId, searchText]);

  // status icon resolver is provided in WorkspaceTable; here we pass undefined so StatusBadge shows dot by color
  const getStatusIcon = undefined as any;

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-destructive">{error}</div>
      </div>
    );
  }

  if (!rows) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[84px] rounded-xl border border-border bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-40 h-40 rounded-full bg-gradient-secondary mb-4" aria-hidden />
        <h3 className="text-lg font-semibold tracking-tight mb-1">No tasks yet</h3>
        <p className="text-sm text-muted-foreground mb-4">Create your first task to get started.</p>
        <div className="inline-flex items-center gap-2 text-sm text-primary">Add Task in header</div>
      </div>
    );
  }

  return (
    <motion.div className="space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {rows.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          statusMap={statusMap}
          priorityMap={priorityMap}
          spotMap={spotMap}
          categoryMap={categoryMap}
          getStatusIcon={getStatusIcon}
          density={density}
        />
      ))}
    </motion.div>
  );
}


