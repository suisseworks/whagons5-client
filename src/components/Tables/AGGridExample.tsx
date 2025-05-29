"use client";

import { useCallback, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, InfiniteRowModelModule } from 'ag-grid-community';
import { api } from "@/api";

ModuleRegistry.registerModules([InfiniteRowModelModule]);

const GridExample = () => {
    const containerStyle = useMemo(() => ({ width: "100%", height: "100%" }), []);
    const gridStyle = useMemo(() => ({ height: "100%", width: "100%" }), []);

    const [columnDefs, setColumnDefs] = useState([
        // this row shows the row index, doesn't use any data from the row
        {
            field: "id",
            //add loader
            // cellRenderer: (params: any) => {
            //     if (params.value !== undefined) {
            //         return params.value;
            //     } else {
            //         return <img src="https://www.ag-grid.com/example-assets/loading.gif" />;
            //     }
            // },
            maxWidth: 100,
            sortable: true,
        },
        { field: "name", minWidth: 150, sortable: true, filter: true },
        {
            field: "workspace_id", sortable: true,
        },
        { field: "template_id", minWidth: 150, sortable: true, filter: true },
        { field: "spot_id", sortable: true, filter: true },
        { field: "team_id", minWidth: 150, sortable: true, filter: true },
        { field: "status_id", minWidth: 150, sortable: true, filter: true },
        { field: "response_date", sortable: true, filter: true },
        { field: "resolution_date", sortable: true, filter: true },
        { field: "work_duration", sortable: true, filter: true },
        { field: "pause_duration", sortable: true, filter: true },
    ]);
    const defaultColDef = useMemo(() => {
        return {
            flex: 1,
            minWidth: 100,
            sortable: false,
        };
    }, []);

    const onGridReady = useCallback((params: any) => {
        const dataSource = {
            rowCount: undefined,
            getRows: async (params: any) => {
                console.log(params)
                console.log(
                    "asking for " + params.startRow + " to " + params.endRow,
                );
                try {
                    const res = await api.get("/tasks",
                        {
                            params: params
                        }
                    )

                    if (res.data.rowCount === 0 || res.data.rows.length === 0) {

                        // params.successCallback([], -1);
                    } else {
                        params.successCallback(res.data.rows, -1);
                    }
                } catch (error) {
                    console.log(error)
                }



            },
        };
        params.api.setGridOption("datasource", dataSource);
    }, []);

    return (
        <div style={containerStyle} className="ag-theme-quartz h-full w-full">
            <div style={gridStyle}>
                <AgGridReact
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    rowBuffer={0}
                    rowModelType={"infinite"}
                    cacheBlockSize={100}
                    cacheOverflowSize={2}
                    maxConcurrentDatasourceRequests={1}
                    infiniteInitialRowCount={100}
                    maxBlocksInCache={10}
                    onGridReady={onGridReady}
                    animateRows={true}
                    getRowId={(params: any) => String(params.data.id)}
                />
            </div>
        </div>
    );
};


export default GridExample;
