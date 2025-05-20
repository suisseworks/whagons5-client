import axios from "axios";      
import { getEnvVariables } from "../helpers";
import { auth } from "../firebase/firebaseConfig";

const { VITE_API_URL } = getEnvVariables();

const token = await auth.currentUser?.getIdToken();


console.log(token);


axios.defaults.headers.post['Access-Control-Allow-Origin'] = '*';

const api = axios.create({
    baseURL: `http://${VITE_API_URL}/api`,
    headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
    },
    withXSRFToken: true,
});


const web = axios.create({
    baseURL: `http://${VITE_API_URL}/`,
    headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
    },
    withXSRFToken: true,
    withCredentials: true,
})





export default api;

export {api, web};