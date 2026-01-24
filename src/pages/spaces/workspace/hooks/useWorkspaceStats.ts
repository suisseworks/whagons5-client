import { useEffect, useRef, useState } from 'react';
import { TasksCache } from '@/store/indexedDB/TasksCache';
import { TaskEvents } from '@/store/eventEmiters/taskEvents';

export interface WorkspaceStats {
  total: number;
  inProgress: number;
  completedToday: number;
  trend: number[];
  loading: boolean;
}

export function useWorkspaceStats(params: {
  workspaceId: string | undefined;
  isAllWorkspaces: boolean;
  doneStatusId: number | undefined;
  workingStatusIds: number[];
}) {
  const { workspaceId, isAllWorkspaces, doneStatusId, workingStatusIds } = params;
  
  const [stats, setStats] = useState<WorkspaceStats>({
    total: 0,
    inProgress: 0,
    completedToday: 0,
    trend: [],
    loading: true
  });
  
  const isInitialLoadRef = useRef(true);
  
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (isInitialLoadRef.current) {
          setStats((s) => ({ ...s, loading: true }));
        }
        if (!TasksCache.initialized) {
          await TasksCache.init();
        }
        const base: any = {};
        const ws = isAllWorkspaces ? undefined : workspaceId;
        if (ws) base.workspace_id = ws;

        const totalResp = await TasksCache.queryTasks({ ...base, startRow: 0, endRow: 0 });
        const total = totalResp?.rowCount ?? 0;

        let inProgress = 0;
        if (workingStatusIds.length > 0) {
          for (const sid of workingStatusIds) {
            const r = await TasksCache.queryTasks({ ...base, status_id: sid, startRow: 0, endRow: 0 });
            inProgress += r?.rowCount ?? 0;
          }
        }

        let completedToday = 0;
        let trend: number[] = [];
        if (doneStatusId != null) {
          const midnight = new Date();
          midnight.setHours(0, 0, 0, 0);
          const r = await TasksCache.queryTasks({ ...base, status_id: Number(doneStatusId), updated_after: midnight.toISOString(), startRow: 0, endRow: 0 });
          completedToday = r?.rowCount ?? 0;

          const sevenDaysAgo = new Date(midnight);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
          const trendResp = await TasksCache.queryTasks({ ...base, updated_after: sevenDaysAgo.toISOString() });
          const trendRows: any[] = (trendResp as any)?.rows ?? [];
          trend = Array.from({ length: 7 }, (_, idx) => {
            const dayStart = new Date(sevenDaysAgo);
            dayStart.setDate(dayStart.getDate() + idx);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);
            return trendRows.filter((t: any) => Number(t.status_id) === Number(doneStatusId) && new Date(t.updated_at) >= dayStart && new Date(t.updated_at) < dayEnd).length;
          });
        }

        if (!cancelled) {
          setStats({ total, inProgress, completedToday, trend, loading: false });
          isInitialLoadRef.current = false;
        }
      } catch (error) {
        console.error('[Workspace Stats] Error loading stats:', error);
        if (!cancelled) {
          setStats((prev) => ({ ...prev, loading: false }));
          isInitialLoadRef.current = false;
        }
      }
    };
    
    isInitialLoadRef.current = true;
    load();
    const unsubs = [
      TaskEvents.on(TaskEvents.EVENTS.TASK_CREATED, load),
      TaskEvents.on(TaskEvents.EVENTS.TASK_UPDATED, load),
      TaskEvents.on(TaskEvents.EVENTS.TASK_DELETED, load),
      TaskEvents.on(TaskEvents.EVENTS.TASKS_BULK_UPDATE, load),
      TaskEvents.on(TaskEvents.EVENTS.CACHE_INVALIDATE, load),
    ];
    return () => { cancelled = true; unsubs.forEach((u) => { try { u(); } catch {} }); };
  }, [workspaceId, isAllWorkspaces, doneStatusId, workingStatusIds.join(',')]);

  return stats;
}
