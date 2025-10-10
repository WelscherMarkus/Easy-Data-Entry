import React, {useCallback, useEffect, useRef, useState} from "react";
import {useSnackbar} from "notistack";
import config from "../../config";
// AG Grid Components
import {AgGridReact} from "ag-grid-react";
import {ColDef, GridReadyEvent, IDatasource, IGetRowsParams} from 'ag-grid-community';
import {
    AllCommunityModule,
    ModuleRegistry,
    InfiniteRowModelModule,
    ValidationModule,
    ClientSideRowModelModule
} from 'ag-grid-community';
// MUI Components
import {
    Box,
    Button,
    Card,
    Grid,
    IconButton,
    Snackbar,
    Stack,
    Tooltip,
} from "@mui/material";
// MUI Icons
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import {LoadColumnDefinitions} from "../LoadColumnDefinitions";
import {updateRow} from "../UpdateRow";
import {DeleteRowComponent} from "../DeleteRow";



type TableProps = {
    table?: string;
};

export const InfiniteTable: React.FC<TableProps> = ({table}) => {
    ModuleRegistry.registerModules([AllCommunityModule, InfiniteRowModelModule, ClientSideRowModelModule]);

    if (process.env.NODE_ENV !== 'production') {
        ModuleRegistry.registerModules([ValidationModule]);
    }

    const [filterModel, setFilterModel] = useState<any>({});

    const gridRef = useRef<AgGridReact<any>>(null);
    const [newRows, setNewRows] = useState<any[]>([]);
    const [colDefs, setColDefs] = useState<ColDef[]>([]);
    const {enqueueSnackbar} = useSnackbar();


    const defaultColDef = {
        sortable: true,
        resizable: true,

    }

    const [rowToDelete, setRowToDelete] = useState<any>(null);


    const loadColumns = (table: string) => {
        LoadColumnDefinitions(table, saveNewRow, setRowToDelete)
            .then(([columns, _]) => {
                setColDefs(columns);
            })
            .catch(() => {
                setColDefs([]);
            });
    }

    const addNewRow = () => {
        const emptyRow: Record<string, any> = {__isNew: true};
        console.log('Creating empty row based on columns:', colDefs);
        colDefs.forEach(col => {
            console.log(col);
            emptyRow[col.field as string] = null;
        });
        console.log('Adding empty row: ', emptyRow);
        setNewRows(prev => [emptyRow, ...prev]);
    };

    useEffect(() => {
        if (newRows.length === 0) return;
        console.log('New rows changed, refreshing grid', newRows);
        refresh()
    }, [newRows]);


    const saveNewRow = (data: any) => {
        if (!table) return;

        const rowToSave = {...data};
        delete rowToSave.__isNew;
        delete rowToSave.__checkmark;


        fetch(`${config.API_URL}/tables/${table}/data`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(rowToSave)
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(() => {
                enqueueSnackbar("New row saved successfully", {variant: 'success'});
                setNewRows(prev => prev.filter(row => row !== data));
                refresh()
            })
            .catch((error) => {
                enqueueSnackbar("Error saving new row: " + error.message, {variant: 'error'});
            });
    }

    const onFilterChanged = useCallback(() => {
        const model = gridRef.current?.api.getFilterModel();
        console.log('Filter model changed:', model);
        setFilterModel(model);
        refresh(); 
    }, []);


    const getRows = (params: IGetRowsParams) => {
        if (!table) {
            return;
        }

        const {startRow, endRow} = params;
        let limit = endRow - startRow;

        const filterModel = gridRef.current?.api.getFilterModel() || {};

        const filters = Object.entries(filterModel).map(([field, filter]) => ({
            field,
            ...filter
        }));

        type Result = {
            data : any[];
            count: number;
        }

        if (Object.keys(filterModel).length > 0) {
            fetch(`${config.API_URL}/tables/${table}/query`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    limit,
                    offset: startRow,
                    filters
                })
            })
                .then(response => response.json())
                .then((data: Result) => {
                    const combined = [...newRows, ...data.data];
                    const lastRow = startRow + data.data.length >= data.count ? data.count : undefined;
                    params.successCallback(combined, lastRow);
                })
                .catch(() => {
                    params.failCallback();
                } );


        } else {
            fetch(`${config.API_URL}/tables/${table}/data?offset=${startRow}&limit=${limit}`,)
                .then(response => response.json())
                .then((data: any[]) => {
                    const combined = [...newRows, ...data];
                    params.successCallback(combined, data.length < limit ? startRow + data.length : undefined);
                })
                .catch(() => {
                    params.failCallback();
                } );
        }
    }

    const onGridReady = useCallback((params: GridReadyEvent) => {
        if (!table) return;
        loadColumns(table)
        const dataSource: IDatasource = {
            rowCount: undefined,
            getRows: (params) => {
                getRows(params);
            },
        };
        params.api.setGridOption("datasource", dataSource);

    }, []);

    useEffect(() => {
        // Reregister the datasource again when newRows or table changes
        if (!table || !gridRef.current || !gridRef.current.api) return;
        const dataSource: IDatasource = {
            rowCount: undefined,
            getRows: (params) => getRows(params),
        };
        gridRef.current.api.setGridOption("datasource", dataSource);
    }, [newRows, table]);

    const refresh = () => {
        console.log("Refreshing grid");
        gridRef.current?.api.refreshInfiniteCache();
    }

    const debug = () => {
        console.log(newRows)
        console.log(newRows.length)
    }

    const resetNewRows = () => {
        setNewRows([]);
    }

    const onCellValueChanged = (params: any) => {
        if (params.data.__isNew) return;
        updateRow(table as string, params);
    }


    return (
        <>
            <Card sx={{height: '100%', width: '100%', padding: 2}}>
                <Stack direction="column" spacing={2} sx={{height: '100%'}}>
                    <Grid container spacing={2}>
                        <Grid size={1}>
                            <Stack direction="row" spacing={0}>
                                <Tooltip title="Clear New Rows">
                                <IconButton disabled={!table || newRows.length === 0} onClick={resetNewRows}>
                                    <DeleteIcon/>
                                </IconButton>
                                </Tooltip>
                                <Button sx={{width: '100%'}} variant="outlined" disabled={!table} onClick={addNewRow}>
                                    Add Row
                                </Button>

                            </Stack>
                        </Grid>

                        <Grid size={1}>
                            <Button sx={{width: '100%'}} variant="outlined" disabled={!table} onClick={debug}>
                                Debug
                            </Button>
                        </Grid>
                        <Grid size="grow"/>

                        <Grid size={0.5}>
                            <IconButton sx={{width: '100%'}} disabled={!table} onClick={refresh}>
                                <RefreshIcon/>
                            </IconButton>
                        </Grid>
                    </Grid>
                    <AgGridReact
                        rowModelType="infinite"
                        columnDefs={colDefs}
                        className="full-size-grid"
                        onGridReady={onGridReady}
                        onCellValueChanged={onCellValueChanged}
                        onFilterChanged={onFilterChanged}
                        ref={gridRef}
                        defaultColDef={defaultColDef}
                    />
                </Stack>
            </Card>

            {rowToDelete && (
                <DeleteRowComponent
                    table={table as string}
                    rowToDelete={rowToDelete}
                    setRowToDelete={setRowToDelete}
                    refresh={refresh}
                />
              )}
        </>

    );
}