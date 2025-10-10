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
import {useSnackbar} from "notistack";
import {Button, Card, IconButton, Stack, Typography} from "@mui/material";
import config from "../../config";
import Grid from "@mui/material/Grid";
import RefreshIcon from '@mui/icons-material/Refresh';
import {LoadColumnDefinitions} from "../LoadColumnDefinitions";
import {updateRow} from "../UpdateRow";
import {DeleteRowComponent} from "../DeleteRow";



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

    const [rowToDelete, setRowToDelete] = useState<any>(null);


    const loadColumns = (table: string) => {
        LoadColumnDefinitions(table, saveNewRow, setRowToDelete)
            .then(([columns, keys]) => {
                setColDefs(columns);
                setKeyColumns(keys);
            })
            .catch(() => {
                setColDefs([]);
                setKeyColumns([]);
            });
    }

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
                        onCellValueChanged={onCellValueChanged}/>
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