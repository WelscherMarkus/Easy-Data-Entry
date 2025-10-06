import React, {useEffect, useState} from "react";

import {AgGridReact} from "ag-grid-react";
import {ColDef} from 'ag-grid-community';

type TableColumn = {
    name: string;
    dataType: string;
};

type TableSchema = {
    columns: TableColumn[];
};

type TableProps = {
    table: string;
};

export const TableComponent: React.FC<TableProps> = ({ table }) =>{
    const [rowData, setRowData] = useState([{}]);
    const [colDefs, setColDefs] = useState<ColDef[]>([]);

    useEffect(() => {
        if (!table) {
            setColDefs([]);
            setRowData([]);
            return;
        }
        loadColumns(table);
        loadRows(table);

    }, [table]);

    const loadColumns = (table: string) => {

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

    const loadRows = (table: string) => {
        fetch(`http://${window.location.hostname}:8080/api/tables/${table}/data`)
            .then(response => response.json())
            .then((data: any[]) => {
                setRowData(data);
            })
            .catch(() => {
                setRowData([]);
            });
    }

    useEffect(() => {
        if (!table) {
            setColDefs([]);
            setRowData([]);
            return;
        }
        loadColumns(table);
        loadRows(table);

    }, [table]);

    return (
        <AgGridReact
            rowData={rowData}
            columnDefs={colDefs}
            className="full-size-grid"
        />
    );
}