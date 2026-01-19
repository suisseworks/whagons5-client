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
      setTimeout(() => {
        refreshGrid();
        try { 
          gridRef.current?.api?.refreshInfiniteCache(); 
        } catch {}
      }, 8000); // Wait 8 seconds for server to fully process approval and actions
    };
    window.addEventListener('wh:approvalDecision:success' as any, handler as any);
    return () => window.removeEventListener('wh:approvalDecision:success' as any, handler as any);
  }, [refreshGrid, gridRef]);
}
