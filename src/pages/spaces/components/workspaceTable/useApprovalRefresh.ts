/**
 * Hook for handling approval refresh events
 */

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store/store';
import { genericActions } from '@/store/genericSlices';

/**
 * Hook to refresh approvals when a decision is recorded
 */
export function useApprovalRefresh(gridRef: React.RefObject<any>, refreshGrid: () => void) {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const handler = () => {
      dispatch(genericActions.taskApprovalInstances.fetchFromAPI());
      dispatch(genericActions.taskApprovalInstances.getFromIndexedDB());
      dispatch(genericActions.taskTags.fetchFromAPI());
      dispatch(genericActions.taskTags.getFromIndexedDB());
      dispatch(genericActions.tags.fetchFromAPI());
      dispatch(genericActions.tags.getFromIndexedDB());
      // Also refresh tasks so approval_status reflects latest decision
      refreshGrid();
      try { gridRef.current?.api?.refreshCells({ force: true }); } catch {}
      try { gridRef.current?.api?.refreshInfiniteCache(); } catch {}
    };
    window.addEventListener('wh:approvalDecision:success' as any, handler as any);
    return () => window.removeEventListener('wh:approvalDecision:success' as any, handler as any);
  }, [dispatch, refreshGrid, gridRef]);
}
