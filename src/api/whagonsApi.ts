import axios from "axios";      
import { getEnvVariables } from "../helpers";

const { VITE_API_URL } = getEnvVariables();


const whagonsApi = axios.create({
    baseURL: VITE_API_URL,
    headers: {
        "Content-type": "application/json"
    },
});

export default whagonsApi;