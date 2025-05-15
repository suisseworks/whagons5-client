import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { useState } from 'react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { Input } from '../ui/input';
// main.tsx or root file

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);

const initialData = [
  { make: 'Tesla', model: 'Model Y', price: 64950, electric: true },
  { make: 'Ford', model: 'F-Series', price: 33850, electric: false },
  { make: 'Toyota', model: 'Corolla', price: 29600, electric: false },
  { make: 'Audi', model: 'A4', price: 49600, electric: false },
  { make: 'BMW', model: '320', price: 32000, electric: false },
  { make: 'Mercedes', model: 'C-Class', price: 45600, electric: false },
  { make: 'Volkswagen', model: 'Golf', price: 29600, electric: false },
];

function AGGrid() {
  const [originalRowData] = useState(initialData); // Store original data
  const [rowData, setRowData] = useState(initialData); // Data displayed in the grid

  // Explicitly define column types
  const [colDefs] = useState<ColDef[]>([
    { field: 'make' },
    { field: 'model' },
    { field: 'price', filter: 'agNumberColumnFilter' },
    { field: 'electric', filter: 'agBooleanColumnFilter' },
  ]);


  const handleSearch = (value: string) => {
    const lowerCaseValue = value.toLowerCase();
    if (lowerCaseValue === '') {
      setRowData(originalRowData); // Reset to original data if search is empty
    } else {
      // Filter original data based on substring match in any string field
      const filteredData = originalRowData.filter((row) => {
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
