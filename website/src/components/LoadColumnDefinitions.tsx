import {ColDef} from 'ag-grid-community';
import config from "../config";
import {Box} from "@mui/material";
import KeyIcon from "@mui/icons-material/Key";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import CheckIcon from "@mui/icons-material/Check";
import DeleteIcon from "@mui/icons-material/Delete";
import React from "react";
import {enqueueSnackbar} from "notistack";

type ListOptions = {
    id: string;
    name: string;
}

type TableColumn = {
    name: string;
    type: string;
    key: boolean;
    filterable: boolean;
    foreignKeyName: string
};

type TableSchema = {
    columns: TableColumn[];
};

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

export const LoadColumnDefinitions = async (
    table: string,
    saveRow: (data: any) => void,
    deleteRow: (data: any) => void): Promise<[ColDef[], string[]]> => {
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
                filter: !col.foreignKeyName,
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
                                       onClick={() => saveRow(params.data)}/>
                        </Box>
                    ) : (
                        <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%'}}>
                            <DeleteIcon color="info" style={{cursor: 'pointer'}}
                                        onClick={() => deleteRow(params.data)}/>
                        </Box>
                    )
        };

        columns = [actionCol, ...columns];

        const keys = data.columns.filter(col => col.key).map(col => col.name);
        return [columns, keys];
    } catch {
        enqueueSnackbar(`Error fetching schema for table ${table}`, {variant: 'error'});
        return [[], []];
    }
}