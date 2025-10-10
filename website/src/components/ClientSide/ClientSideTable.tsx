import React, {useEffect, useState} from "react";
import {AgGridReact} from "ag-grid-react";
import {
    AllCommunityModule,
    ClientSideRowModelModule,
    ColDef,
    InfiniteRowModelModule,
    ModuleRegistry,
    ValidationModule
} from 'ag-grid-community';
import {ICellRendererParams, ICellEditorParams, ValueFormatterParams, IHeaderParams} from 'ag-grid-community';

import {useSnackbar} from "notistack";
import {Button, Card, IconButton, Stack, Typography} from "@mui/material";
import Box from "@mui/material/Box";
import CheckIcon from '@mui/icons-material/Check';
import DeleteIcon from '@mui/icons-material/Delete';
import config from "../../config";
import Grid from "@mui/material/Grid";
import RefreshIcon from '@mui/icons-material/Refresh';
import Snackbar from '@mui/material/Snackbar';
import CloseIcon from '@mui/icons-material/Close';
import KeyIcon from '@mui/icons-material/Key';
import VpnKeyIcon from '@mui/icons-material/VpnKey';

type TableColumn = {
    name: string;
    type: string;
    key: boolean;
    foreignKeyName: string
};

type TableSchema = {
    columns: TableColumn[];
};

type TableProps = {
    table?: string;
};

export const ClientSideTable: React.FC<TableProps> = ({table}) => {
    ModuleRegistry.registerModules([AllCommunityModule, InfiniteRowModelModule, ClientSideRowModelModule]);

    if (process.env.NODE_ENV !== 'production') {
        ModuleRegistry.registerModules([ValidationModule]);
    }

    const [rowData, setRowData] = useState<Record<string, any>[]>([]);
    const [colDefs, setColDefs] = useState<ColDef[]>([]);
    const [keyColumns, setKeyColumns] = useState<string[]>([]);

    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [timeSinceLastRefresh, setTimeSinceLastRefresh] = useState<string>('');

    const {enqueueSnackbar} = useSnackbar();

    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [rowToDelete, setRowToDelete] = useState<any>(null);

    const timerRef = React.useRef<NodeJS.Timeout | null>(null);

    type ListOptions = {
        id: string;
        name: string;
    }


    const retrieveForeignKeyOptions = async (foreignKeyName: string) => {
        try {
            const response = await fetch(`${config.API_URL}/foreign-keys/${foreignKeyName}/data`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data: ListOptions[] = await response.json();
            return data;
        } catch {
            enqueueSnackbar(`Error fetching foreign key options for ${foreignKeyName}`, {variant: 'error'});
            return [];
        }
    };

    const loadColumns = async (table: string) => {
        try {
            const response = await fetch(`${config.API_URL}/tables/${table}/schema`);
            const data: TableSchema = await response.json();

            const foreignKeyCols = data.columns.filter(col => col.foreignKeyName);

            const optionsMap: { [key: string]: ListOptions[] } = {};
            await Promise.all(foreignKeyCols.map(async col => {
                optionsMap[col.foreignKeyName] = await retrieveForeignKeyOptions(col.foreignKeyName);
            }));

            let columns = data.columns.map((col) => {
                let colDef: ColDef = {
                    headerName: col.name,
                    field: col.name,
                    sortable: true,
                    filter: true,
                    resizable: true,
                    cellDataType: col.type,
                    editable: (params: any) => params.data.__isNew === true || !col.key,
                    headerComponentParams: {
                        innerHeaderComponent: () => (
                            <Box sx={{display: 'flex', alignItems: 'center'}}>
                                {col.key ? <KeyIcon fontSize="small" sx={{color: '#FFD600', mr: 0.5}}/> : null}
                                {!col.key && col.foreignKeyName ?
                                    <VpnKeyIcon color="info" fontSize="small" sx={{mr: 0.5}}/> : null}
                                <span>{col.name}</span>
                            </Box>
                        )
                    },
                    context: {foreignKeyName: col.foreignKeyName},
                };

                if (col.foreignKeyName) {
                    const listOptions = optionsMap[col.foreignKeyName] || [];
                    colDef.cellEditor = 'agSelectCellEditor';
                    colDef.cellEditorParams = {
                        values: listOptions.map(option => option.id)
                    };
                    colDef.valueFormatter = (params) => {
                        const match = listOptions.find(option => option.id === params.value);
                        return match ? match.name : params.value;
                    };
                }

                return colDef;
            });

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

            const keys = data.columns.filter(col => col.key).map(col => col.name);
            setKeyColumns(keys);
            setColDefs(columns);
        } catch {
            setColDefs([]);
        }
    };

    const loadRows = (table: string) => {
        fetch(`${config.API_URL}/tables/${table}/data`)
            .then(response => response.json())
            .then((data: any[]) => {
                const rowsWithIsNew = data.map(row => ({...row, __isNew: false}));
                setRowData(rowsWithIsNew);
            })
            .catch(() => {
                setRowData([]);
            });
        setLastRefresh(new Date());

    }


    const addNewRow = () => {
        if (!table) return;
        const newRow: any = {__isNew: true};

        colDefs.forEach(col => {
            newRow[col.field as string] = null;
        });
        setRowData(prev => [newRow, ...prev]);
    }


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
                setRowData(prev => {
                    const idx = prev.findIndex(row =>
                        keyColumns.every(key => row[key] === data[key])
                    );

                    if (idx === -1) return prev;

                    const updated = [...prev];
                    updated[idx] = {...updated[idx], __isNew: false};
                    return updated;
                });
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
                setRowData(prev => prev.filter(row =>
                    !keyColumns.every(key => row[key] === data[key])
                ));

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

    useEffect(() => {
        setRowData([])

        if (!table) {
            setColDefs([]);
            setRowData([]);
            return;
        }
        loadColumns(table);
        loadRows(table);

    }, [table, setColDefs, setRowData]);

    useEffect(() => {
        const actionCol = {
            headerName: '',
            field: '__actions',
            editable: false,
            width: 50,
            cellRenderer: (params: any) =>
                params.data.__isNew
                    ? (
                        <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%'}}>
                            <CheckIcon color="success" style={{cursor: 'pointer'}} onClick={() => saveNewRow(params.data)}/>
                        </Box>
                    ) : (
                        <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%'}}>
                            <DeleteIcon color="info" style={{cursor: 'pointer'}}
                                        onClick={() => handleDeleteClick(params.data)}/>
                        </Box>
                    )
        };

        setColDefs(prev => {
            const exists = prev.some(col => col.field === actionCol.field);
            return exists ? prev : [actionCol, ...prev];
        });
    }, [colDefs, setColDefs]);

    useEffect(() => {
        if (!lastRefresh) {
            setTimeSinceLastRefresh('');
            return;
        }

        const interval = setInterval(() => {
            const now = new Date();
            const diff = Math.floor((now.getTime() - lastRefresh.getTime()) / 1000);
            if (diff < 60) {
                setTimeSinceLastRefresh(`less than 1 minute ago`);
            } else if (diff < 3600) {
                setTimeSinceLastRefresh(`${Math.floor(diff / 60)} minutes ago`);
            } else {
                setTimeSinceLastRefresh(`${Math.floor(diff / 3600)} hours ago`);
            }
        }, 1000);

        return () => clearInterval(interval);

    }, [lastRefresh]);

    const refresh = () => {
        if (table) {
            loadRows(table);
        }
    }

    const debug = () => {
        console.log(colDefs);
        console.log(rowData);
        console.log(keyColumns);
    }

    return (
        <>
            <Card sx={{height: '100%', width: '100%', padding: 2}}>
                <Stack direction="column" spacing={2} sx={{height: '100%'}}>
                    <Grid container spacing={2}>
                        <Grid size={1}>
                            <Button sx={{width: '100%'}} variant="outlined" disabled={!table} onClick={addNewRow}>
                                Add Row
                            </Button>
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
                        rowData={rowData}
                        columnDefs={colDefs}
                        className="full-size-grid"
                        onCellValueChanged={updateRow}/>
                    <Grid container>
                        <Grid size="grow"/>
                        <Grid size="auto">
                            <Grid size="auto" sx={{display: 'flex', alignItems: 'center'}}>
                                <Typography variant="body2" component="div">
                                    {lastRefresh && (
                                        <>
                                            <strong>Last refresh:</strong> {timeSinceLastRefresh}
                                        </>
                                    )}
                                </Typography>

                            </Grid>
                        </Grid>
                    </Grid>
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