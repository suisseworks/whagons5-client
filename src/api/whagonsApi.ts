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
    baseURL: `http://${VITE_API_URL}/api`,
    headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
    },
    withCredentials: false,
});



export default api;

export {api};