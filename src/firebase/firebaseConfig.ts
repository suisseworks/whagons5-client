// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";



const firebaseConfig = {
  apiKey: "AIzaSyAYFaubF7EcvI2x9Mm5ypedw3JlzA8kH9A",
  authDomain: "whagons5.firebaseapp.com",
  projectId: "whagons5",
  storageBucket: "whagons5.firebasestorage.app",
  messagingSenderId: "333755572903",
  appId: "1:333755572903:web:abc24649ac86d892d53182",

  measurementId: "G-PSVYP02YGW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
//useAuth
