// src/authService.ts
import { auth } from '../../firebase/firebaseConfig';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  UserCredential,
  signOut,
  linkWithCredential,
  sendEmailVerification
} from 'firebase/auth';
import { clearAuth } from '../../api/whagonsApi';
import { DB } from '@/store/indexedDB/DB';


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

// Sign in with email and password, check verification status
export const signInWithEmail = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    if (!user.emailVerified) {
      throw new Error('Please verify your email before logging in.');
    }
    return userCredential;
  } catch (error) {
    throw error;
  }
};

// Sign up with email and password, and send verification email
export const signUpWithEmail = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await sendEmailVerification(user);
    return userCredential;
  } catch (error) {
    throw error;
  }
};

// Link Google provider to an existing user
export const linkGoogleProvider = async (credential: any) => {
  try {
    const user = auth.currentUser;
    if (user) {
      await linkWithCredential(user, credential);
      console.log('Google provider linked successfully');
    } else {
      throw new Error('No user is currently signed in');
    }
  } catch (error) {
    throw error;
  }
};

// Logout
export const logout = async (): Promise<void> => {
    try {
      // Clear auth tokens from both memory and storage before signing out
      clearAuth();
      
      // Best-effort: fully delete the current user's IndexedDB before signing out
      const uid = auth.currentUser?.uid;
      if (uid) {
        await DB.deleteDatabase(uid);
      }

      await signOut(auth);
      
      //delete subdomain from local storage
      localStorage.removeItem('whagons-subdomain');
      
      console.log('User logged out');
    } catch (error) {
      console.error('Logout Error:', error);
      throw error;
    }
  };

