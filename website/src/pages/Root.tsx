import React, {useEffect, useState} from "react";
import Box from '@mui/material/Box';

import Grid from '@mui/material/Grid';
import './Root.css';
import {FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack} from "@mui/material";
import {InfiniteTable} from "../components/InfiniteTable/InfiniteTable";
import { useNavigate, useParams } from "react-router-dom";
import config from '../config';
import {enqueueSnackbar} from "notistack";
import {ClientSideTable} from "../components/ClientSide/ClientSideTable";


const Root: React.FC = () => {
    const navigate = useNavigate();
    const { table } = useParams<{ table: string }>();

    const [tables, setTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | undefined>(table);

    const [tableCount, setTableCount] = useState<number | null>(null);

    const getTableCount = () => {
        fetch(`${config.API_URL}/tables/${table}/count`, {
            method: 'GET',
            headers: {'Content-Type': 'application/json'},
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then((data) => {
                setTableCount(data.count);

            })
            .catch((error) => {
                enqueueSnackbar(`Error fetching table count: ${error.message}`, {variant: 'error'});
            });
    }

    useEffect(() => {
        fetch(`${config.API_URL}/tables`)
            .then(response => response.json())
            .then(data => setTables(data))
            .catch(() => setTables([]));
    }, []);

    useEffect(() => {
        if (table && tables.includes(table)) {
            getTableCount()
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
                <Box sx={{width: '98%', height: '88vh'}}>
                    <Stack direction="column" spacing={2} sx={{height: '100%'}}>
                        {tableCount !== null && table && (
                            tableCount < 1000 ? (
                                <ClientSideTable table={table} />
                            ) : (
                                <InfiniteTable table={table} />
                            )
                        )}


                    </Stack>
                </Box>
            </Grid>
        </Grid>
    );
};

export default Root;
