import config from "../config";
import {enqueueSnackbar} from "notistack";


export const updateRow = (table:string, params: any) => {
    if (!table) return;

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