"use client";

import { useCallback, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, ValidationModule } from "ag-grid-community";
import { InfiniteRowModelModule } from "ag-grid-community";
import { api } from "@/api";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store";
ModuleRegistry.registerModules([
    InfiniteRowModelModule,
    AllCommunityModule,
    ...(process.env.NODE_ENV !== "production" ? [ValidationModule] : []),
]);




const GridExample = () => {
    const containerStyle = useMemo(() => ({ width: "100%", height: "100%" }), []);
    const gridStyle = useMemo(() => ({ height: "100%", width: "100%" }), []);


    const [columnDefs, setColumnDefs] = useState([
        // this row shows the row index, doesn't use any data from the row
        {
            field: "id",
            //add loader
            cellRenderer: (params: any) => {
                if (params.value !== undefined) {
                    return params.value;
                } else {
                    return <img src="https://www.ag-grid.com/example-assets/loading.gif" />;
                }
            },
            maxWidth: 100,
            sortable: true,
        },
        { field: "name", minWidth: 150, sortable: true, filter: true },
        { field: "workspace_id", sortable: true, filter: true },
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
                // At this point in your code, you would call the server.
                // To make the demo look real, wait for 500ms before returning
                try {
                    const res = await api.get("/tasks",
                        {
                            params: params
                        }
                    )

                    params.successCallback(res.data.rows, -1);
                } catch (error) {
                    console.log(error)
                }

                console.log("here")


            },
        };
        params.api.setGridOption("datasource", dataSource);
        // });
    }, []);

    return (
        <div style={containerStyle}>
            <div style={gridStyle}>
                <AgGridReact
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    rowBuffer={0}
                    rowModelType={"infinite"}
                    cacheBlockSize={100}
                    cacheOverflowSize={2}
                    maxConcurrentDatasourceRequests={1}
                    infiniteInitialRowCount={1000}
                    maxBlocksInCache={10}
                    onGridReady={onGridReady}
                />
            </div>
        </div>
    );
};


export default GridExample;
