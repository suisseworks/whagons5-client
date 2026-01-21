"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";
import { TasksCache } from "@/store/indexedDB/TasksCache";
import { TaskRow } from "@/components/TaskList/TaskRow";
import { motion } from "motion/react";
import { removeTaskAsync, restoreTaskAsync } from "@/store/reducers/tasksSlice";
import { DeleteTaskDialog } from "@/components/tasks/DeleteTaskDialog";
import toast from "react-hot-toast";
import { useLanguage } from "@/providers/LanguageProvider";

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
  const { t } = useLanguage();
  const statuses = useSelector((s: RootState) => (s as any).statuses.value as any[]);
  const priorities = useSelector((s: RootState) => (s as any).priorities.value as any[]);
  const spots = useSelector((s: RootState) => (s as any).spots.value as any[]);
  const categories = useSelector((s: RootState) => (s as any).categories.value as any[]);
  const dispatch = useDispatch<AppDispatch>();
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  
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
        if (!TasksCache.initialized) await TasksCache.init();
        const baseParams: any = { search: searchText };
        const ws = workspaceId && workspaceId !== "all" ? workspaceId : undefined;
        if (ws) baseParams.workspace_id = ws;
        const countResp = await TasksCache.queryTasks({ ...baseParams, startRow: 0, endRow: 0 });
        const total = countResp?.rowCount ?? 0;
        const rowsResp = await TasksCache.queryTasks({ ...baseParams, startRow: 0, endRow: Math.min(500, total) });
        if (!cancelled) setRows(rowsResp?.rows || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load tasks");
      }
    })();
    return () => { cancelled = true; };
  }, [workspaceId, searchText]);

  // status icon resolver is provided in WorkspaceTable; here we pass undefined so StatusBadge shows dot by color
  const getStatusIcon = undefined as any;

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<{ id: number; name?: string } | null>(null);

  const handleDeleteTask = async (taskId: number) => {
    const numericId = Number(taskId);
    if (!Number.isFinite(numericId)) {
      console.warn("Invalid task id for delete", taskId);
      return;
    }
    
    // Find task data from rows
    const task = rows?.find((t) => Number(t?.id) === numericId);
    const taskData = { id: numericId, name: task?.name };
    
    setTaskToDelete(taskData);
    setDeleteDialogOpen(true);
  };

  // Confirm delete action
  const confirmDelete = async () => {
    if (!taskToDelete) return;
    
    const taskId = taskToDelete.id;
    const taskName = taskToDelete.name;
    
    setDeleteDialogOpen(false);
    setActionError(null);
    
    // Store toast ID to dismiss on error
    let successToastId: string | undefined;
    
    try {
      await dispatch(removeTaskAsync(taskId)).unwrap();
      setRows((prev) => prev ? prev.filter((t) => Number(t?.id) !== taskId) : prev);
      
      // Show success toast with undo option
      successToastId = toast.success(
        (t) => (
          <div className="flex flex-col gap-1">
            <div className="font-semibold">Task deleted</div>
            <div className="text-sm opacity-90">
              {taskName ? `"${taskName}" has been deleted.` : "Task has been deleted."}
            </div>
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                const restoreToast = toast.loading("Restoring task...");
                try {
                  await dispatch(restoreTaskAsync(taskId)).unwrap();
                  toast.dismiss(restoreToast);
                  toast.success(
                    taskName ? `"${taskName}" has been restored.` : "Task has been restored.",
                    { duration: 5000 }
                  );
                  // Refresh the list with same pagination as initial load
                  const baseParams: any = { search: searchText };
                  const ws = workspaceId && workspaceId !== "all" ? workspaceId : undefined;
                  if (ws) baseParams.workspace_id = ws;
                  const countResp = await TasksCache.queryTasks({ ...baseParams, startRow: 0, endRow: 0 });
                  const total = countResp?.rowCount ?? 0;
                  const rowsResp = await TasksCache.queryTasks({ ...baseParams, startRow: 0, endRow: Math.min(500, total) });
                  setRows(rowsResp?.rows || []);
                } catch (error: any) {
                  toast.dismiss(restoreToast);
                  const errorMessage = error?.message || error?.response?.data?.message || "Could not restore the task.";
                  toast.error(errorMessage, { duration: 5000 });
                }
              }}
              className="text-left text-sm font-medium underline underline-offset-4 hover:no-underline mt-1"
            >
              Undo
            </button>
          </div>
        ),
        { duration: 8000 }
      );
    } catch (e: any) {
      // Dismiss success toast if it was shown (shouldn't happen, but just in case)
      if (successToastId) {
        toast.dismiss(successToastId);
      }
      
      const status = e?.response?.status || e?.status;
      // Only log and show errors for non-403 errors (403 errors are handled by API interceptor)
      if (status !== 403) {
        console.error("Failed to delete task", e);
        const errorMessage = e?.message || e?.response?.data?.message || e?.toString() || "Failed to delete task";
        setActionError(errorMessage);
        toast.error(errorMessage, { duration: 5000 });
      }
    } finally {
      setTaskToDelete(null);
    }
  };

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
      {actionError ? (
        <div className="text-sm text-destructive" role="alert">
          {actionError}
        </div>
      ) : null}
      {rows.map((task, index) => (
        <TaskRow
          key={task.id}
          task={task}
          statusMap={statusMap}
          priorityMap={priorityMap}
          spotMap={spotMap}
          categoryMap={categoryMap}
          getStatusIcon={getStatusIcon}
          density={density}
          onDelete={() => handleDeleteTask(Number(task?.id))}
          onLog={() => console.info("Log action selected (placeholder) for task", task?.id)}
          rowIndex={index}
        />
      ))}
      
      <DeleteTaskDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        taskName={taskToDelete?.name}
      />
    </motion.div>
  );
}


