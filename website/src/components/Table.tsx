import React, {useEffect, useState} from "react";

import {AgGridReact} from "ag-grid-react";
import {ColDef} from 'ag-grid-community';
import {useSnackbar} from "notistack";
import {Button, Card, Stack} from "@mui/material";
import Box from "@mui/material/Box";
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

export const TableComponent: React.FC<TableProps> = ({table}) => {
    const [rowData, setRowData] = useState([{}]);
    const [colDefs, setColDefs] = useState<ColDef[]>([]);
    const {enqueueSnackbar} = useSnackbar();

    const loadColumns = (table: string) => {
        fetch(`http://${window.location.hostname}:8080/api/tables/${table}/schema`)
            .then(response => response.json())
            .then((data: TableSchema) => {
                const columns = data.columns.map((col) => ({
                    headerName: col.keyColumn ? `🔑 ${col.name}` : col.name,
                    field: col.name,
                    sortable: true,
                    filter: true,
                    resizable: true,
                    cellDataType: col.type,
                    editable: (params: any) => params.data.__isNew === true || !col.keyColumn,


                }));
                setColDefs(columns);
            })
            .catch(() => {
                setColDefs([])
            });
    }

    const loadRows = (table: string) => {
        fetch(`http://${window.location.hostname}:8080/api/tables/${table}/data`)
            .then(response => response.json())
            .then((data: any[]) => {
                const rowsWithIsNew = data.map(row => ({...row, __isNew: false}));
                setRowData(rowsWithIsNew);
            })
            .catch(() => {
                setRowData([]);
            });
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



        fetch(`http://${window.location.hostname}:8080/api/tables/${table}/data`, {
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
                loadRows(table);
            })
            .catch((error) => {
                enqueueSnackbar("Error saving new row: " + error.message, {variant: 'error'});
                loadRows(table);
            });
    }

    const updateRow = (params: any) => {
        if (!table) return;
        if (params.data.__isNew) return;

        fetch(`http://${window.location.hostname}:8080/api/tables/${table}/data`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(params.data)
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .catch(
                (error) => {
                    enqueueSnackbar("Error updating data: " + error.message, {variant: 'error'});
                    loadRows(table)
                }
            )
            .then(() => {
                enqueueSnackbar("Data updated successfully", {variant: 'success'});
                loadRows(table);
            })
    }

    const deleteRow = (data: any) => {
        if (!table) return;

        fetch(`http://${window.location.hostname}:8080/api/tables/${table}/data`, {
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
            .catch((error) => {
                    enqueueSnackbar("Error deleting row: " + error.message, {variant: 'error'});
                    loadRows(table);
                }
            )
            .then(() => {
                enqueueSnackbar("Row deleted successfully", {variant: 'success'});
                loadRows(table);
            })
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
                            <DeleteIcon color="info" style={{cursor: 'pointer'}} onClick={() => deleteRow(params.data)}/>
                        </Box>
                    )
        };

        setColDefs(prev => {
            const exists = prev.some(col => col.field === actionCol.field);
            return exists ? prev : [actionCol, ...prev];
        });
    }, [colDefs, setColDefs]);

    const debug = () => {
        console.log(colDefs);
    }

    return (
        <Card sx={{height: '100%', width: '100%', padding: 2}}>
            <Stack direction="column" spacing={1} sx={{height: '100%'}}>
                <Stack direction="row" spacing={2}>

                    <Button variant="outlined" disabled={!table} onClick={addNewRow}>
                        Add Row
                    </Button>
                    <Button variant="outlined" disabled={!table} onClick={debug}>
                        Debug
                    </Button>

                </Stack>
                <AgGridReact
                    rowData={rowData}
                    columnDefs={colDefs}
                    className="full-size-grid"
                    onCellValueChanged={updateRow}/>
            </Stack>
        </Card>
    );
}