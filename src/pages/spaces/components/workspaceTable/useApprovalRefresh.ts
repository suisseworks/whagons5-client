/**
 * Hook for handling approval refresh events
 */

import { useEffect } from 'react';

/**
 * Hook to refresh approvals when a decision is recorded
 */
export function useApprovalRefresh(gridRef: React.RefObject<any>, refreshGrid: () => void) {
  useEffect(() => {
    const handler = () => {
      // Refresh grid so pivot-driven approval instances reflect latest decision
      refreshGrid();
      try { gridRef.current?.api?.refreshCells({ force: true }); } catch {}
      try { gridRef.current?.api?.refreshInfiniteCache(); } catch {}
    };
    window.addEventListener('wh:approvalDecision:success' as any, handler as any);
    return () => window.removeEventListener('wh:approvalDecision:success' as any, handler as any);
  }, [refreshGrid, gridRef]);
}
