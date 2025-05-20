import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { useEffect, useState } from 'react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { Input } from '../ui/input';
import { fetchTasks } from '@/store/reducers/tasksSlice';
import { useDispatch } from 'react-redux';
import { RootState } from '@/store';
import { useSelector } from 'react-redux';
import { Task } from '@/store/reducers/tasksSlice';
// main.tsx or root file

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);


function AGGrid() {
  const dispatch = useDispatch();
  const { value: tasks } = useSelector((state: RootState) => state.tasks);
  const [rowData, setRowData] = useState(tasks);

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


  useEffect(() => {
    dispatch(fetchTasks() as any);
    console.log(tasks)
  }, [dispatch]);

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
        rowData={rowData}
        columnDefs={colDefs}
      />
    </div>
  );
}

export default AGGrid;
