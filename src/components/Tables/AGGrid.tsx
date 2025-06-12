import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { useEffect, useState, useRef, useCallback } from 'react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { Input } from '../ui/input';
import { fetchTasks } from '@/store/reducers/tasksSlice';
import { useDispatch } from 'react-redux';
import { RootState } from '@/store';
import { useSelector } from 'react-redux';
import { Task } from '@/store/reducers/tasksSlice';
import { useSidebar } from '@/components/ui/sidebar';
// main.tsx or root file

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);


function AGGrid() {
  const dispatch = useDispatch();
  const { value: tasks } = useSelector((state: RootState) => state.tasks);
  const [rowData, setRowData] = useState(tasks);
  const gridRef = useRef<AgGridReact>(null);
  const { state } = useSidebar();

  // Explicitly define column types
  const [colDefs] = useState<ColDef[]>([
    { field: 'id' },
    { field: 'name' },
    { field: 'workspace_id' },
    { field: 'template_id' },
    { field: 'spot_id' },
    { field: 'team_id' },
    { field: 'status_id' },
    { field: 'response_date' },
    { field: 'resolution_date' },
    { field: 'work_duration' },
    { field: 'pause_duration' },
  ]);

  // Handle smooth resizing when sidebar state changes
  const handleResize = useCallback(() => {
    if (gridRef.current?.api) {
      // Small delay to allow sidebar animation to complete
      setTimeout(() => {
        gridRef.current?.api?.sizeColumnsToFit();
      }, 160); // Slightly longer than the 150ms sidebar animation
    }
  }, []);

  useEffect(() => {
    dispatch(fetchTasks() as any);
    console.log(tasks)
  }, [dispatch]);

  // Trigger resize when sidebar state changes
  useEffect(() => {
    handleResize();
  }, [state, handleResize]);

  // Also handle window resize events
  useEffect(() => {
    const handleWindowResize = () => {
      if (gridRef.current?.api) {
        gridRef.current.api.sizeColumnsToFit();
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  const handleSearch = (value: string) => {
    const lowerCaseValue = value.toLowerCase();
    if (lowerCaseValue === '') {
      setRowData(tasks); // Reset to original data if search is empty
    } else {
      // Filter original data based on substring match in any string field
      const filteredData = tasks.filter((row) => {
        return Object.values(row).some((field) =>
          typeof field === 'string' && field.toLowerCase().includes(lowerCaseValue) ||
          typeof field === 'number' && field.toString().includes(lowerCaseValue) // Also check numbers as strings
        );
      });
      setRowData(filteredData);
    }
  };

  const onGridReady = useCallback(() => {
    // Ensure columns fit when grid is first ready
    if (gridRef.current?.api) {
      gridRef.current.api.sizeColumnsToFit();
    }
  }, []);

  return (
    <div className='ag-theme-quartz h-full w-full'>
      <Input
        placeholder='Search'
        className='w-full mb-2'
        onChange={(e) => {
          handleSearch(e.target.value);
        }}
      />
      <AgGridReact
        ref={gridRef}
        rowData={rowData}
        columnDefs={colDefs}
        onGridReady={onGridReady}
        suppressColumnVirtualisation={true}
        animateRows={true}
      />
    </div>
  );
}

export default AGGrid;
