// src/authService.ts
import { auth } from '../../firebase/firebaseConfig';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  UserCredential,
  signOut
} from 'firebase/auth';


// Google Sign-In
export const signInWithGoogle = async (): Promise<UserCredential> => {
  const provider = new GoogleAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    return result;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
};

// Email Sign-In
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<UserCredential> => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result;
  } catch (error) {
    console.error('Email Sign-In Error:', error);
    throw error;
  }
};

// Email Sign-Up
export const signUpWithEmail = async (
  email: string,
  password: string
): Promise<UserCredential> => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result;
  } catch (error) {
    console.error('Email Sign-Up Error:', error);
    throw error;
  }
};

// Logout
export const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
      console.log('User logged out');
    } catch (error) {
      console.error('Logout Error:', error);
      throw error;
    }
  };

