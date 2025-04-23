import { AgGridReact } from 'ag-grid-react';
import { ColDef, themeMaterial } from 'ag-grid-community';
import { useState } from 'react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
// main.tsx or root file

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);

const gridOptions = {
  theme: themeMaterial,
};

function AGGrid() {
  const [rowData, setRowData] = useState([
    { make: 'Tesla', model: 'Model Y', price: 64950, electric: true },
    { make: 'Ford', model: 'F-Series', price: 33850, electric: false },
    { make: 'Toyota', model: 'Corolla', price: 29600, electric: false },
    { make: 'Audi', model: 'A4', price: 49600, electric: false },
    { make: 'BMW', model: '320', price: 32000, electric: false },
    { make: 'Mercedes', model: 'C-Class', price: 45600, electric: false },
    { make: 'Volkswagen', model: 'Golf', price: 29600, electric: false },


  ]);

  // Explicitly define column types
  const [colDefs] = useState<ColDef[]>([
    { field: 'make' },
    { field: 'model' },
    { field: 'price', filter: 'agNumberColumnFilter' },
    { field: 'electric', filter: 'agBooleanColumnFilter' },
  ]);

  return (
    <div className='h-full'>
      <AgGridReact
        rowData={rowData}
        columnDefs={colDefs}
        gridOptions={gridOptions}
      />
    </div>
  );
}

export default AGGrid;
