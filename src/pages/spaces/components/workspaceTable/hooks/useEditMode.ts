import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Hook for managing edit mode state and click behavior:
 * - Single click: enter edit mode + select row
 * - Double click: exit edit mode + clear selection + open TaskDialog
 */
export const useEditMode = () => {
  const [editModeEnabled, setEditModeEnabled] = useState(false);
  const editModeJustEnabledRef = useRef(false);
  const lastClickRef = useRef<{ rowId: any; timestamp: number } | null>(null);

  // Listen for Escape key to exit edit mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editModeEnabled) {
        setEditModeEnabled(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editModeEnabled]);

  const handleRowClick = useCallback((e: any, onOpenTaskDialog?: (task: any) => void) => {
    // Don't handle clicks on status column or checkbox column
    const target = e?.event?.target as HTMLElement;
    if (target) {
      const statusCell = target.closest('.ag-cell[col-id="status_id"]');
      const checkboxCell = target.closest('.ag-cell[col-id="ag-Grid-SelectionColumn"]');
      if (statusCell || checkboxCell) {
        return;
      }
    }
    if (e?.column?.colId === 'status_id' || e?.column?.colId === 'ag-Grid-SelectionColumn') {
      return;
    }

    const rowId = e?.data?.id;
    if (rowId == null) return;

    // Detect double-click for opening dialog (and exiting edit mode)
    const now = Date.now();
    const lastClick = lastClickRef.current;

    if (lastClick && lastClick.rowId === rowId && (now - lastClick.timestamp) < 300) {
      // Double-click detected:
      // - exit edit mode
      // - clear selection
      // - open dialog
      lastClickRef.current = null;

      setEditModeEnabled(false);
      try {
        e.api?.deselectAll?.();
      } catch {
        // ignore
      }

      if (onOpenTaskDialog && e?.data) {
        onOpenTaskDialog(e.data);
      }
      return;
    }

    // Single click: enter edit mode immediately and select this row
    lastClickRef.current = { rowId, timestamp: now };

    // Select this row (single-select) when entering edit mode
    e.node?.setSelected(true, false);

    editModeJustEnabledRef.current = true;
    setEditModeEnabled(true);
    setTimeout(() => {
      editModeJustEnabledRef.current = false;
    }, 100);
  }, []);

  const handleSelectionChanged = useCallback((e: any, onSelectionChanged?: (selectedIds: number[]) => void) => {
    try {
      const rows = e.api.getSelectedRows?.() || [];
      const ids = rows.map((r: any) => Number(r.id)).filter((n: any) => Number.isFinite(n));

      // Exit edit mode if no rows are selected (but not if we just enabled it)
      if (ids.length === 0 && editModeEnabled && !editModeJustEnabledRef.current) {
        setEditModeEnabled(false);
      }

      if (onSelectionChanged) {
        onSelectionChanged(ids);
      }
    } catch {
      if (onSelectionChanged) {
        onSelectionChanged([] as number[]);
      }
    }
  }, [editModeEnabled]);

  const exitEditMode = useCallback((gridApi?: any) => {
    setEditModeEnabled(false);
    gridApi?.deselectAll();
  }, []);

  return {
    editModeEnabled,
    handleRowClick,
    handleSelectionChanged,
    exitEditMode,
  };
};
