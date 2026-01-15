/**
 * Hook for context menu items
 */

import { useCallback } from 'react';

export function useContextMenu(opts: {
  handleDeleteTask: (id: number) => void;
}) {
  const { handleDeleteTask } = opts;

  return useCallback((params: any) => {
    const row = params?.node?.data;
    const id = Number(row?.id);
    const items: any[] = [];

    if (row && Number.isFinite(id)) {
      items.push({
        name: 'Delete task',
        action: () => handleDeleteTask(id),
        cssClasses: ['wh-context-danger'],
      });
      items.push({
        name: 'Log (placeholder)',
        action: () => console.info('Log action selected (placeholder) for task', id),
      });
      items.push('separator');
    }

    if (params?.defaultItems) {
      items.push(...params.defaultItems);
    } else {
      items.push('copy', 'copyWithHeaders', 'paste');
    }

    return items;
  }, [handleDeleteTask]);
}
