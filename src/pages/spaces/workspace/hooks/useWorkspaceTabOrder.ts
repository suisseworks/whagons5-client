import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_TAB_SEQUENCE, FIXED_TABS, type WorkspaceTabKey } from '../constants';

function buildTabSequence(order: WorkspaceTabKey[]) {
  const sequence: WorkspaceTabKey[] = [];
  const seen = new Set<WorkspaceTabKey>();
  const pushUnique = (key: WorkspaceTabKey) => {
    if (!seen.has(key)) {
      seen.add(key);
      sequence.push(key);
    }
  };
  order.forEach(pushUnique);
  FIXED_TABS.forEach((key) => pushUnique(key));
  return sequence;
}

export function useWorkspaceTabOrder(workspaceKey: string) {
  // Ensure 'grid' (tasks) is always first
  const [customTabOrder, setCustomTabOrder] = useState<WorkspaceTabKey[]>(() => {
    try {
      const key = `wh_workspace_tab_order_${workspaceKey}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
          const order = parsed as WorkspaceTabKey[];
          if (order[0] !== 'grid') {
            const filtered = order.filter((tab) => tab !== 'grid');
            return ['grid', ...filtered] as WorkspaceTabKey[];
          }
          return order;
        }
      }
    } catch {}
    return DEFAULT_TAB_SEQUENCE;
  });

  // Update custom tab order when workspace changes
  useEffect(() => {
    try {
      const key = `wh_workspace_tab_order_${workspaceKey}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
          const order = parsed as WorkspaceTabKey[];
          if (order[0] !== 'grid') {
            const filtered = order.filter((tab) => tab !== 'grid');
            setCustomTabOrder(['grid', ...filtered] as WorkspaceTabKey[]);
          } else {
            setCustomTabOrder(order);
          }
          return;
        }
      }
    } catch {}
    setCustomTabOrder(DEFAULT_TAB_SEQUENCE);
  }, [workspaceKey]);

  // Save custom tab order to localStorage
  useEffect(() => {
    try {
      const key = `wh_workspace_tab_order_${workspaceKey}`;
      localStorage.setItem(key, JSON.stringify(customTabOrder));
    } catch {}
  }, [customTabOrder, workspaceKey]);

  const resolvedOrder = useMemo(() => buildTabSequence(customTabOrder), [customTabOrder]);
  const primaryTabValue = resolvedOrder[0] || 'grid';

  return {
    customTabOrder,
    setCustomTabOrder,
    resolvedOrder,
    primaryTabValue,
  };
}

