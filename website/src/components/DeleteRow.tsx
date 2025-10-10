import config from "../config";
import React, {useEffect, useState} from "react";
import {enqueueSnackbar} from "notistack";
import {IconButton, Snackbar} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";










type DeleteRowComponentProps = {
    setRowToDelete: React.Dispatch<React.SetStateAction<any>>;
    rowToDelete: any;
    table: string;
    refresh?: () => void;
}

export const DeleteRowComponent: React.FC<DeleteRowComponentProps> = ({ table, rowToDelete, setRowToDelete, refresh }) => {
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const timerRef = React.useRef<NodeJS.Timeout | null>(null);


    const handleConfirmDelete = () => {
        if (!table || !rowToDelete) return;

        fetch(`${config.API_URL}/tables/${table}/data`, {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(rowToDelete)
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(() => {
                if (refresh) refresh();
                enqueueSnackbar("Row deleted successfully", {variant: 'success'});
            })
            .catch((error) => {
                    enqueueSnackbar("Error deleting row: " + error.message, {variant: 'error'});
                }
            )
            .finally( () => {
                setSnackbarOpen(false);
                setRowToDelete(null);
            })
    };

    const  handleCancelDelete = () => {
        setSnackbarOpen(false);
        setRowToDelete(null);
    };

    useEffect(() => {
        if (!rowToDelete) return;

        setRowToDelete(rowToDelete);
        setSnackbarOpen(true);

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setSnackbarOpen(false);
            setRowToDelete(null);
        }, 10000);


    }, []);

    return (
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
    )
}
