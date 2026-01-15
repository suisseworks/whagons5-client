/**
 * Hook for getting done status ID
 */

import { useMemo } from 'react';

export function useDoneStatusId(globalStatusesRef: React.MutableRefObject<any[]>) {
  return useMemo((): (() => number | undefined) => {
    return () => {
      const statusesArr = globalStatusesRef.current || [];
      const byAction = statusesArr.find((s: any) => String((s as any).action || '').toUpperCase() === 'DONE');
      if (byAction?.id != null) return Number(byAction.id);
      const byName = statusesArr.find((s: any) => String((s as any).name || '').toLowerCase().includes('done'));
      if (byName?.id != null) return Number(byName.id);
      return undefined;
    };
  }, [globalStatusesRef]);
}
