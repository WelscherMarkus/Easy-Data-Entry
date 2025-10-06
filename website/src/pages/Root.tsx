import React, {useEffect, useState} from "react";
import {AgGridReact} from 'ag-grid-react';
import {AllCommunityModule, ModuleRegistry} from 'ag-grid-community';
import {ColDef} from 'ag-grid-community';
import Box from '@mui/material/Box';

import Grid from '@mui/material/Grid';
import './Root.css';
import {Card, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack, Typography} from "@mui/material";

type TableColumn = {
    name: string;
    dataType: string;
};

type TableSchema = {
    columns: TableColumn[];
};

const Root: React.FC = () => {
    ModuleRegistry.registerModules([AllCommunityModule]);

    const [rowData, setRowData] = useState([
        {make: "Tesla", model: "Model Y", price: 64950, electric: true},
        {make: "Ford", model: "F-Series", price: 33850, electric: false},
        {make: "Toyota", model: "Corolla", price: 29600, electric: false},
    ]);

    // Column Definitions: Defines the columns to be displayed.
    const [colDefs, setColDefs] = useState<ColDef[]>([]);

    const [table, setTable] = React.useState('');
    const [tables, setTables] = useState<string[]>([]);

    useEffect(() => {

        if (table) {
            fetch(`http://${window.location.hostname}:8080/api/tables/${table}/schema`)
                .then(response => response.json())
                .then((data: TableSchema) => {
                    const columns = data.columns.map((col) => ({
                        headerName: col.name,
                        field: col.name,
                        sortable: true,
                        filter: true,
                        resizable: true,
                    }));
                    setColDefs(columns);
                })
                .catch(() => setColDefs([]));
        }

        if (table) {
            fetch(`http://${window.location.hostname}:8080/api/tables/${table}/data`)
                .then(response => response.json())
                .then((data: any[]) => {
                    setRowData(data);
                })
                .catch(() => {
                    setRowData([]);
                });
        } else {
            setRowData([]);
        }

    }, [table]);


    useEffect(() => {
        fetch(`http://${window.location.hostname}:8080/api/tables`)
            .then(response => response.json())
            .then(data => setTables(data))
            .catch(() => setTables([]));
    }, []);



    const handleChange = (event: SelectChangeEvent) => {
        setTable(event.target.value as string);
    };

    return (
        <Grid container spacing={2} sx={{padding: 5}}>
            <Grid size={2}>
                <FormControl fullWidth>
                    <InputLabel id="demo-simple-select-label">Age</InputLabel>
                    <Select
                        labelId="demo-simple-select-label"
                        id="demo-simple-select"
                        value={table}
                        label="Table"
                        onChange={handleChange}
                    >
                        {tables.map((table) => (
                            <MenuItem key={table} value={table}>{table}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Grid>
            <Grid size={10}>

            </Grid>

            <Grid size={12} justifyContent={"center"}>
                <Box sx={{width: '90%', height: '80vh'}}>
                    <Stack direction="column" spacing={2} sx={{height: '100%'}}>
                        {/*<Card sx={{padding: 2}}>*/}
                        {/*    <Typography variant="h5" component="div" sx={{flexGrow: 1}}>*/}
                        {/*        Table: {table}*/}
                        {/*    </Typography>*/}
                        {/*</Card>*/}
                        <AgGridReact
                            rowData={rowData}
                            columnDefs={colDefs}
                            className="full-size-grid"
                        />
                    </Stack>
                </Box>
            </Grid>
        </Grid>
    );
};

export default Root;
