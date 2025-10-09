import React, {useCallback, useEffect, useRef, useState} from "react";
import {AgGridReact} from "ag-grid-react";
import {ColDef, GridReadyEvent, IDatasource, IGetRowsParams} from 'ag-grid-community';
import {
    AllCommunityModule,
    ModuleRegistry,
    InfiniteRowModelModule,
    ValidationModule,
    ClientSideRowModelModule
} from 'ag-grid-community';
import {useSnackbar} from "notistack";
import {Button, Card, IconButton, Stack, Tooltip, Typography} from "@mui/material";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Snackbar from '@mui/material/Snackbar';

import config from "../../config";

import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import DeleteIcon from '@mui/icons-material/Delete';

type TableColumn = {
    name: string;
    type: string;
    keyColumn: boolean;
};

type TableSchema = {
    columns: TableColumn[];
};

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
    const [keyColumns, setKeyColumns] = useState<string[]>([]);

    const {enqueueSnackbar} = useSnackbar();

    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [rowToDelete, setRowToDelete] = useState<any>(null);

    const timerRef = React.useRef<NodeJS.Timeout | null>(null);

    const loadColumns = (table: string) => {
        fetch(`${config.API_URL}/tables/${table}/schema`)
            .then(response => response.json())
            .then((data: TableSchema) => {
                let columns: ColDef[] = data.columns.map((col) => ({
                    headerName: col.keyColumn ? `🔑 ${col.name}` : col.name,
                    field: col.name,
                    sortable: true,
                    filter: true,
                    resizable: true,
                    cellDataType: col.type,
                    editable: (params: any) => params.data.__isNew === true || !col.keyColumn,
                }));

                const actionCol: ColDef = {
                    headerName: '',
                    field: '__actions',
                    editable: false,
                    width: 50,
                    cellRenderer: (params: any) =>
                        params.data && params.data.__isNew
                            ? (
                                <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%'}}>
                                    <CheckIcon color="success" style={{cursor: 'pointer'}}
                                               onClick={() => saveNewRow(params.data)}/>
                                </Box>
                            ) : (
                                <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%'}}>
                                    <DeleteIcon color="info" style={{cursor: 'pointer'}}
                                                onClick={() => handleDeleteClick(params.data)}/>
                                </Box>
                            )
                };

                columns = [actionCol, ...columns];

                const keys = data.columns.filter(col => col.keyColumn).map(col => col.name);
                setKeyColumns(keys);
                setColDefs(columns);
            })
            .catch(() => {
                setColDefs([])
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

    const updateRow = (params: any) => {
        if (!table) return;
        if (params.data.__isNew) return;

        fetch(`${config.API_URL}/tables/${table}/data`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(params.data)
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(() => {
                enqueueSnackbar("Data updated successfully", {variant: 'success'});
            })
            .catch(
                (error) => {
                    enqueueSnackbar("Error updating data: " + error.message, {variant: 'error'});
                }
            )

    }

    const deleteRow = (data: any) => {
        if (!table) return;

        fetch(`${config.API_URL}/tables/${table}/data`, {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(() => {
                enqueueSnackbar("Row deleted successfully", {variant: 'success'});
                refresh()
            })
            .catch((error) => {
                    enqueueSnackbar("Error deleting row: " + error.message, {variant: 'error'});
                }
            )
    }

    const handleDeleteClick = (data: any) => {
        setRowToDelete(data);
        setSnackbarOpen(true);

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setSnackbarOpen(false);
            setRowToDelete(null);
        }, 10000);
    };

    const handleConfirmDelete = () => {
        deleteRow(rowToDelete);
        setSnackbarOpen(false);
        setRowToDelete(null);
    };

    const handleCancelDelete = () => {
        setSnackbarOpen(false);
        setRowToDelete(null);
    };

    const onFilterChanged = useCallback(() => {
        const model = gridRef.current?.api.getFilterModel();
        console.log('Filter model changed:', model);
        setFilterModel(model);
        refresh(); // Refresh grid to fetch filtered data
    }, []);

    const getRows = (params: IGetRowsParams) => {
        if (!table) {
            return;
        }

        const {startRow, endRow} = params;
        let limit = endRow - startRow;

        fetch(`${config.API_URL}/tables/${table}/data?offset=${startRow}&end=${limit}`)
            .then(response => response.json())
            .then((data: any[]) => {
                const combined = [...newRows, ...data];
                params.successCallback(combined, data.length < limit ? startRow + data.length : undefined);
            })

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
        gridRef.current?.api.refreshInfiniteCache();
    }

    const debug = () => {
        console.log(newRows)
        console.log(newRows.length)
    }

    const resetNewRows = () => {
        setNewRows([]);
    }

    return (
        <>
            <Card sx={{height: '100%', width: '100%', padding: 2}}>
                <Stack direction="column" spacing={2} sx={{height: '100%'}}>
                    <Grid container spacing={2}>
                        <Grid size={1} sx={{ }}   >
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
                        onCellValueChanged={updateRow}
                        onFilterChanged={onFilterChanged}
                        ref={gridRef}
                    />


                </Stack>
            </Card>
            <Snackbar
                open={snackbarOpen}
                anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
                message="Are you sure you want to delete?"
                sx={{
                    '& .MuiSnackbarContent-root': {
                        backgroundColor: '#fff',
                    },
                    '& .MuiSnackbarContent-message': {
                        color: '#333333',
                    }
                }}
                action={<>
                    <IconButton color="error" size="small" onClick={handleConfirmDelete}>
                        <DeleteIcon/>
                    </IconButton>
                    <IconButton size="small" onClick={handleCancelDelete}>
                        <CloseIcon/>
                    </IconButton>
                </>}/>
        </>

    );
}