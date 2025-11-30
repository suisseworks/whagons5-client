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
import { DB } from '@/store/database/DB';
import { getEnvVariables } from '@/lib/getEnvVariables';


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
    const env = getEnvVariables();
    const allowUnverifiedLogin = ['true', '1', 'yes'].includes(
      String((env as any).VITE_ALLOW_UNVERIFIED_LOGIN ?? 'false').toLowerCase()
    );
    const emailLower = (user.email || email || '').toLowerCase();
    let enforceVerification = true; // default: require verification

    if (allowUnverifiedLogin) {
      const regexSource = (env as any).VITE_ALLOW_UNVERIFIED_EMAIL_REGEX as string | undefined;
      if (!regexSource) {
        enforceVerification = false; // allow everyone unverified
      } else {
        try {
          const regex = new RegExp(regexSource);
          enforceVerification = !regex.test(emailLower); // allow only if matches
        } catch {
          enforceVerification = false; // invalid regex → allow (dev convenience)
        }
      }
    }

    if (enforceVerification && !user.emailVerified) {
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

