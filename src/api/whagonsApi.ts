import axios from "axios";      
import { getEnvVariables } from "../helpers";
import { auth } from "../firebase/firebaseConfig";

const { VITE_API_URL } = getEnvVariables();

const token = await auth.currentUser?.getIdToken();

let stuff = {
    "token": token
}


console.log(stuff);

const api = axios.create({
    baseURL: VITE_API_URL,
    withCredentials: true,
    withXSRFToken : true,
    headers: {
        "Content-type": "application/json",
    },
});

const web = axios.create({
    baseURL: VITE_API_URL.replace('/api', '/'),
    withCredentials: true,
    withXSRFToken : true,
    headers: {},
});



export default api;

export { web, api};