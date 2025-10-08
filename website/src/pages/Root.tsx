import React, {useEffect, useState} from "react";
import {AllCommunityModule, ModuleRegistry} from 'ag-grid-community';
import Box from '@mui/material/Box';

import Grid from '@mui/material/Grid';
import './Root.css';
import {FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack} from "@mui/material";
import '../components/Table'
import {TableComponent} from "../components/Table";
import { useNavigate, useParams } from "react-router-dom";
import config from '../config';


const Root: React.FC = () => {
    ModuleRegistry.registerModules([AllCommunityModule]);

    const navigate = useNavigate();
    const { table } = useParams<{ table: string }>();

    const [tables, setTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | undefined>(table);


    useEffect(() => {
        fetch(`${config.API_URL}/tables`)
            .then(response => response.json())
            .then(data => setTables(data))
            .catch(() => setTables([]));
    }, []);

    useEffect(() => {

        if (table && tables.includes(table)) {
            setSelectedTable(table);

        }
    }, [table, tables]);

    const handleChange = (event: SelectChangeEvent) => {
        const selectedTable = event.target.value as string;
        navigate(`/editor/${selectedTable}`);

    };

    return (
        <Grid container spacing={2} sx={{padding: 5}}>
            <Grid size={2}>
                <FormControl fullWidth>
                    <InputLabel id="table-select-label">Table</InputLabel>
                    <Select
                        labelId="table-select-label"
                        id="table-select"
                        value={selectedTable}
                        label="Table"
                        onChange={handleChange}
                    >
                        {tables.map((table) => (
                            <MenuItem key={table} value={table}>{table}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Grid>
            <Grid size={10}/>

            <Grid size={12} justifyContent={"center"}>
                <Box sx={{width: '97%', height: '85vh'}}>
                    <Stack direction="column" spacing={2} sx={{height: '100%'}}>
                        <TableComponent table={table}/>
                    </Stack>
                </Box>
            </Grid>
        </Grid>
    );
};

export default Root;
