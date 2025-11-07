// Redux state management and derived state utilities for WorkspaceTable

import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import type { User } from '@/store/types';
import { TasksCache } from '@/store/indexedDB/TasksCache';
import { GRID_CONSTANTS } from './gridConfig';

export interface GridStateOptions {
  workspaceId: string;
  searchText?: string;
}

export const useGridReduxState = () => {
  // Redux state selectors
  const statuses = useSelector((s: RootState) => (s as any).statuses.value as any[]);
  const priorities = useSelector((s: RootState) => (s as any).priorities.value as any[]);
  const spots = useSelector((s: RootState) => (s as any).spots.value as any[]);
  const workspaces = useSelector((s: RootState) => (s as any).workspaces.value as any[]);
  const users = useSelector((s: RootState) => (s as any).users.value as User[]);
  const categories = useSelector((s: RootState) => (s as any).categories.value as any[]);
  const statusTransitions = useSelector((s: RootState) => (s as any).statusTransitions.value as any[]);
  const approvals = useSelector((s: RootState) => (s as any).approvals?.value as any[] || []);
  const taskApprovalInstances = useSelector((s: RootState) => (s as any).taskApprovalInstances?.value as any[] || []);

  return {
    statuses,
    priorities,
    spots,
    workspaces,
    users,
    categories,
    statusTransitions,
    approvals,
    taskApprovalInstances,
  };
};

export const useDerivedGridState = (reduxState: ReturnType<typeof useGridReduxState>, options: GridStateOptions) => {
  const { workspaceId } = options;
  const { workspaces } = reduxState;

  // Derived state
  const isAllWorkspaces = useMemo(() => workspaceId === 'all', [workspaceId]);
  const workspaceNumericId = useMemo(() => isAllWorkspaces ? null : Number(workspaceId), [workspaceId, isAllWorkspaces]);

  const currentWorkspace = useMemo(() => {
    if (isAllWorkspaces) return null;
    return workspaces.find((w: any) => Number(w.id) === workspaceNumericId);
  }, [workspaces, workspaceNumericId, isAllWorkspaces]);

  const defaultCategoryId = currentWorkspace?.category_id ?? null;

  return {
    isAllWorkspaces,
    workspaceNumericId,
    currentWorkspace,
    defaultCategoryId,
  };
};

export const useGridModeDecision = (workspaceId: string, searchText: string) => {
  return useMemo(() => {
    const decideMode = async () => {
      try {
        if (!TasksCache.initialized) await TasksCache.init();

        // Build minimal params equivalent to the grid query
        const baseParams: any = { search: searchText };
        if (workspaceId !== 'all') baseParams.workspace_id = workspaceId;

        // Get filtered count only
        const countResp = await TasksCache.queryTasks({ ...baseParams, startRow: 0, endRow: 0 });
        const totalFiltered = countResp?.rowCount ?? 0;

        return {
          useClientSide: totalFiltered > 0 && totalFiltered <= GRID_CONSTANTS.CLIENT_THRESHOLD,
          totalFiltered,
        };
      } catch (e) {
        console.warn('decideMode failed', e);
        return {
          useClientSide: false,
          totalFiltered: 0,
        };
      }
    };

    return decideMode;
  }, [workspaceId, searchText]);
};

export const useMetadataLoadedFlags = (reduxState: ReturnType<typeof useGridReduxState>) => {
  const { statuses, priorities, spots, users } = reduxState;

  return useMemo(() => ({
    statusesLoaded: !!(statuses && statuses.length > 0),
    prioritiesLoaded: !!(priorities && priorities.length > 0),
    spotsLoaded: !!(spots && spots.length > 0),
    usersLoaded: !!(users && users.length > 0),
  }), [statuses, priorities, spots, users]);
};
