import React, { useRef, useCallback, useEffect } from "react";
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent } from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

export interface SettingsGridProps<T = any> {
  rowData: T[];
  columnDefs: ColDef[];
  onGridReady?: (params: GridReadyEvent) => void;
  height?: string;
  className?: string;
  noRowsMessage?: string;
  defaultColDef?: ColDef;
  rowSelection?: 'single' | 'multiple';
  onSelectionChanged?: (selectedRows: T[]) => void;
  onRowDoubleClicked?: (row: T) => void;
  onCellValueChanged?: (event: any) => void;
}

export function SettingsGrid<T = any>({
  rowData,
  columnDefs,
  onGridReady,
  height = "400px",
  className = "",
  noRowsMessage = "No data found",
  defaultColDef = {
    sortable: true,
    filter: true,
    resizable: true
  },
  rowSelection,
  onSelectionChanged,
  onRowDoubleClicked,
  onCellValueChanged
}: SettingsGridProps<T>) {
  const gridRef = useRef<AgGridReact>(null);

  const handleGridReady = useCallback((params: GridReadyEvent) => {
    if (gridRef.current?.api) {
      gridRef.current.api.sizeColumnsToFit();
    }
    onGridReady?.(params);
  }, [onGridReady]);

  // Handle window resize
  useEffect(() => {
    const handleWindowResize = () => {
      if (gridRef.current?.api) {
        gridRef.current.api.sizeColumnsToFit();
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  return (
    <div className={`ag-theme-quartz wh-settings-grid w-full ${className}`} style={{ height }}>
      <AgGridReact
        ref={gridRef}
        rowData={rowData}
        columnDefs={columnDefs}
        onGridReady={handleGridReady}
        rowSelection={rowSelection}
        suppressColumnVirtualisation={true}
        animateRows={true}
        rowHeight={50}
        headerHeight={44}
        defaultColDef={defaultColDef}
        onCellValueChanged={onCellValueChanged}
        onSelectionChanged={() => {
          if (gridRef.current?.api && onSelectionChanged) {
            const selected = gridRef.current.api.getSelectedRows() as T[];
            onSelectionChanged(selected);
          }
        }}
        onRowDoubleClicked={(event: any) => {
          if (onRowDoubleClicked) {
            onRowDoubleClicked(event?.data as T);
          }
        }}
        noRowsOverlayComponent={() => (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">{noRowsMessage}</p>
          </div>
        )}
      />
    </div>
  );
}

export default SettingsGrid;
