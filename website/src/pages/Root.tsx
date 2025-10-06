import React, {useEffect, useState} from "react";
import {AllCommunityModule, ModuleRegistry} from 'ag-grid-community';
import Box from '@mui/material/Box';

import Grid from '@mui/material/Grid';
import './Root.css';
import {FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack} from "@mui/material";
import '../components/Table'
import {TableComponent} from "../components/Table";


const Root: React.FC = () => {
    ModuleRegistry.registerModules([AllCommunityModule]);

    const [table, setTable] = React.useState('');
    const [tables, setTables] = useState<string[]>([]);

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
                    <InputLabel id="table-select-label">Table</InputLabel>
                    <Select
                        labelId="table-select-label"
                        id="table-select"
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
                        <TableComponent table={table}/>
                    </Stack>
                </Box>
            </Grid>
        </Grid>
    );
};

export default Root;
