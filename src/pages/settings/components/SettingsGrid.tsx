import { useRef, useCallback, useEffect } from "react";
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent } from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { RowGroupingModule, TreeDataModule } from 'ag-grid-enterprise';

// Register AG Grid modules (community + enterprise needed for grouping/tree)
ModuleRegistry.registerModules([AllCommunityModule, RowGroupingModule, TreeDataModule]);

export interface SettingsGridProps<T = any> {
  rowData: T[];
  columnDefs: ColDef[];
  onGridReady?: (params: GridReadyEvent) => void;
  height?: string;
  className?: string;
  noRowsMessage?: string;
  defaultColDef?: ColDef;
  rowSelection?: 'single' | 'multiple' | any; // allow object config per example
  onSelectionChanged?: (selectedRows: T[]) => void;
  onRowDoubleClicked?: (row: T) => void;
  onCellValueChanged?: (event: any) => void;
  autoGroupColumnDef?: ColDef;
  gridOptions?: any;
  quickFilterText?: string;
  style?: React.CSSProperties;
  rowHeight?: number;
  zebraRows?: boolean;
}

export function SettingsGrid<T = any>({
  rowData,
  columnDefs,
  onGridReady,
  height,
  className,
  noRowsMessage = "No data found",
  defaultColDef = {
    sortable: true,
    filter: true,
    resizable: true
  },
  rowSelection,
  onSelectionChanged,
  onRowDoubleClicked,
  onCellValueChanged,
  autoGroupColumnDef,
  gridOptions,
  quickFilterText,
  style,
  rowHeight,
  zebraRows
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
    <div
      className={`ag-theme-quartz wh-settings-grid wh-modern-grid wh-density-comfortable w-full ${className ?? ""}`}
      style={{ height: height ?? "100%", ...(style ?? {}) }}
    >
      <AgGridReact
        ref={gridRef}
        rowData={rowData}
        columnDefs={columnDefs}
        onGridReady={handleGridReady}
        rowSelection={rowSelection}
        suppressColumnVirtualisation={true}
        animateRows={true}
        rowHeight={rowHeight ?? 50}
        headerHeight={44}
        defaultColDef={{
          ...defaultColDef,
          resizable: true
        }}
        onCellValueChanged={onCellValueChanged}
        autoGroupColumnDef={autoGroupColumnDef}
        {...(gridOptions || {})}
        quickFilterText={quickFilterText}
        getRowStyle={zebraRows ? (params: any) => {
          const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
          if (params.node.rowIndex % 2 === 0) {
            return { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' };
          }
          return undefined as any;
        } : undefined}
        onSelectionChanged={() => {
          if (gridRef.current?.api && onSelectionChanged) {
            const selected = gridRef.current.api.getSelectedRows() as T[];
            onSelectionChanged(selected);
          }
        }}
        onRowDoubleClicked={(event: any) => {
          if (onRowDoubleClicked && event?.data) {
            onRowDoubleClicked(event.data as T);
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
