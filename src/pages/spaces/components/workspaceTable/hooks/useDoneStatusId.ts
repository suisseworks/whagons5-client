/**
 * Hook for getting done status ID
 */

import { useMemo } from 'react';

export function useDoneStatusId(globalStatusesRef: React.MutableRefObject<any[]>) {
  return useMemo((): (() => number | undefined) => {
    return () => {
      const statusesArr = globalStatusesRef.current || [];
      // Check for FINISHED action first (most specific), then DONE
      const byFinished = statusesArr.find((s: any) => String((s as any).action || '').toUpperCase() === 'FINISHED');
      if (byFinished?.id != null) return Number(byFinished.id);
      const byDone = statusesArr.find((s: any) => String((s as any).action || '').toUpperCase() === 'DONE');
      if (byDone?.id != null) return Number(byDone.id);
      // Fallback to name matching
      const byName = statusesArr.find((s: any) => {
        const nameLower = String((s as any).name || '').toLowerCase();
        return nameLower.includes('done') || nameLower.includes('finished') || nameLower.includes('complete');
      });
      if (byName?.id != null) return Number(byName.id);
      return undefined;
    };
  }, [globalStatusesRef]);
}
