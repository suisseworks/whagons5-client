import axios from "axios";      
import { getEnvVariables } from "../helpers";

const { VITE_API_URL } = getEnvVariables();


const whagonsApi = axios.create({
    baseURL: VITE_API_URL,
    withCredentials: true,
    withXSRFToken : true,
    headers: {
        "Content-type": "application/json"
    },
});

const whagonsWeb = axios.create({
    baseURL: VITE_API_URL.replace('/api', '/'),
    withCredentials: true,
    withXSRFToken : true,
    headers: {},
});

export default whagonsApi;

export { whagonsWeb };