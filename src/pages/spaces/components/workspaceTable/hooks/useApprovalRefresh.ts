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
      // Refresh approval instances immediately (this is safe)
      dispatch(genericActions.taskApprovalInstances.fetchFromAPI());
      dispatch(genericActions.taskApprovalInstances.getFromIndexedDB());

      // Refresh tags immediately when realtime listener is off
      dispatch(genericActions.taskTags.fetchFromAPI());
      dispatch(genericActions.taskTags.getFromIndexedDB());
      dispatch(genericActions.tags.fetchFromAPI());
      dispatch(genericActions.tags.getFromIndexedDB());
      
      // DON'T refresh grid immediately - it will overwrite the local node update with stale server data
      // The node has already been updated locally with the correct approval_status
      // Delay the refresh to give the server time to process the approval and any actions
      
      // DON'T refresh cells either - the node has already been updated in columns.tsx
      // Any refresh here will potentially overwrite the local update with stale server data
      
      // Delay the cache refresh significantly to prevent overwriting local update
      // The server needs time to:
      // 1. Process the approval decision
      // 2. Execute approval actions (status changes, etc.)
      // 3. Commit all database transactions
      // Increased delay to 8 seconds to be safe
      setTimeout(() => {
        // Refresh tag data so approval tag actions show up
        dispatch(genericActions.taskTags.fetchFromAPI());
        dispatch(genericActions.taskTags.getFromIndexedDB());
        dispatch(genericActions.tags.fetchFromAPI());
        dispatch(genericActions.tags.getFromIndexedDB());

        // Refresh grid after server has had plenty of time to process
        refreshGrid();
        try { 
          gridRef.current?.api?.refreshInfiniteCache(); 
        } catch {}
      }, 8000); // Wait 8 seconds for server to fully process approval and actions
    };
    window.addEventListener('wh:approvalDecision:success' as any, handler as any);
    return () => window.removeEventListener('wh:approvalDecision:success' as any, handler as any);
  }, [dispatch, refreshGrid, gridRef]);
}
