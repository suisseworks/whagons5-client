import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook for managing column visibility and ordering
 */
export const useColumnManagement = (workspaceId: string) => {
  const workspaceRef = useRef(workspaceId);
  
  useEffect(() => {
    workspaceRef.current = workspaceId;
  }, [workspaceId]);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const allDefault = ['id', 'name', 'config', 'form', 'notes', 'status_id', 'priority_id', 'user_ids', 'due_date', 'spot_id', 'created_at'];
    try {
      const key = `wh_workspace_columns_${workspaceId || 'all'}`;
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (!raw) return allDefault;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        return Array.from(new Set(['name', 'id', ...parsed]));
      }
    } catch {
      // ignore
    }
    return allDefault;
  });

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const key = `wh_workspace_column_order_${workspaceId || 'all'}`;
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  // Reload preferences when workspace changes
  useEffect(() => {
    try {
      const key = `wh_workspace_column_order_${workspaceId || 'all'}`;
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
          const normalized = Array.from(new Set(parsed));
          setColumnOrder(['id', ...normalized.filter((c) => c !== 'id')]);
        } else {
          setColumnOrder([]);
        }
      } else {
        setColumnOrder([]);
      }
    } catch {
      setColumnOrder([]);
    }

    const allDefault = ['id', 'name', 'config', 'form', 'notes', 'status_id', 'priority_id', 'user_ids', 'due_date', 'spot_id', 'created_at'];
    try {
      const key = `wh_workspace_columns_${workspaceId || 'all'}`;
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (!raw) {
        setVisibleColumns(['id', ...allDefault.filter((c) => c !== 'id')]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        setVisibleColumns(Array.from(new Set(['name', 'id', ...parsed])));
      } else {
        setVisibleColumns(['id', ...allDefault.filter((c) => c !== 'id')]);
      }
    } catch {
      setVisibleColumns(['id', ...allDefault.filter((c) => c !== 'id')]);
    }
  }, [workspaceId]);

  // Listen for settings changes
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<any>;
      const detail = custom.detail || {};
      if (!detail) return;
      const targetId = detail.workspaceId ?? 'all';
      const currentId = workspaceRef.current || 'all';
      if (String(targetId) !== String(currentId)) return;
      if (Array.isArray(detail.visibleColumns)) {
        const next = detail.visibleColumns.filter((x: any) => typeof x === 'string');
        if (next.length > 0) {
          setVisibleColumns(Array.from(new Set(['name', 'id', ...next])));
        }
      }
    };

    try {
      window.addEventListener('wh:workspaceColumnsChanged' as any, handler as any);
    } catch {
      // no-op (SSR)
    }

    return () => {
      try {
        window.removeEventListener('wh:workspaceColumnsChanged' as any, handler as any);
      } catch {
        // ignore
      }
    };
  }, []);

  const persistColumnOrder = useCallback((orderedIds: string[]) => {
    if (!orderedIds || orderedIds.length === 0) return;
    const normalized = Array.from(new Set(orderedIds));
    const withIdFirst = ['id', ...normalized.filter((c) => c !== 'id')];
    setColumnOrder(withIdFirst);
    try {
      const key = `wh_workspace_column_order_${workspaceRef.current || 'all'}`;
      localStorage.setItem(key, JSON.stringify(withIdFirst));
    } catch {
      // ignore storage errors
    }
  }, []);

  const applyStoredColumnOrder = useCallback((colApi?: any) => {
    if (!colApi) return;
    const order = columnOrder || [];
    if (!order || order.length === 0) return;
    try {
      const ordered = ['id', ...order.filter((c) => c !== 'id')];
      const state = ordered.map((colId, idx) => ({ colId, order: idx }));
      colApi.applyColumnState({ state, applyOrder: true });
    } catch {
      // ignore apply errors
    }
  }, [columnOrder]);

  const handleColumnOrderChanged = useCallback((colApi?: any) => {
    if (!colApi) return;
    try {
      const state = colApi.getColumnState?.() || [];
      if (!Array.isArray(state)) return;
      const ordered = state
        .filter((s: any) => s?.colId)
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        .map((s: any) => String(s.colId));
      if (ordered.length === 0) return;
      persistColumnOrder(ordered);
    } catch {
      // ignore
    }
  }, [persistColumnOrder]);

  return {
    visibleColumns,
    columnOrder,
    persistColumnOrder,
    applyStoredColumnOrder,
    handleColumnOrderChanged,
  };
};
