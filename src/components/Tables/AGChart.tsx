import { AgGridReact } from 'ag-grid-react';
import { ClientSideRowModelModule, ColDef } from 'ag-grid-community';
import { useState } from 'react';
// import 'ag-grid-community/styles/ag-grid.css';
// import 'ag-grid-community/styles/ag-theme-alpine.css';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'; 


// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);

function AGGrid() {
  const [rowData, setRowData] = useState([
    { make: 'Tesla', model: 'Model Y', price: 64950, electric: true },
    { make: 'Ford', model: 'F-Series', price: 33850, electric: false },
    { make: 'Toyota', model: 'Corolla', price: 29600, electric: false },
  ]);

   // Explicitly define column types
   const [colDefs] = useState<ColDef[]>([
    { field: 'make' },
    { field: 'model' },
    { field: 'price', filter: 'agNumberColumnFilter' },
    { field: 'electric', filter: 'agBooleanColumnFilter' },
  ]);

  return (
    <div
      // define a height because the Data Grid will fill the size of the parent container
        className='h-full'
    >
      <AgGridReact rowData={rowData} columnDefs={colDefs} />
    </div>
  );
}

export default AGGrid;
