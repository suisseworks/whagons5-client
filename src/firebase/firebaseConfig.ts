// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";



const firebaseConfig = {
  apiKey: "AIzaSyDQ1MTE2dIHtGIzN6CQas-nPwhjJiVZKcs",
  authDomain: "whagons-demo.firebaseapp.com",
  projectId: "whagons-demo",
  storageBucket: "whagons-demo.firebasestorage.app",
  messagingSenderId: "881494607876",
  appId: "1:881494607876:web:fc1bc9094b43f4f9b98d51",
  measurementId: "G-PSVYP02YGW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
//useAuth
