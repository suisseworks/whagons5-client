// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getMessaging, isSupported, Messaging } from "firebase/messaging";
import 'firebase/messaging'; // Ensure side effects for registration are loaded

const firebaseConfig = {
  apiKey: "AIzaSyAD1bLLRlRUoS2rEg3ZKqGQ3bE1chfySSY",
  authDomain: "whagons-5.firebaseapp.com",
  projectId: "whagons-5",
  storageBucket: "whagons-5.firebasestorage.app",
  messagingSenderId: "578623964983",
  appId: "1:578623964983:web:6d30a61ae7997530dbfcb2",
  measurementId: "G-8CJ3W1FCG3"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Initialize messaging only if supported (not in all browsers)
let messagingInstance: Messaging | null = null;
let messagingInitialized = false;

/**
 * Get messaging instance, initializing it first if needed
 * This ensures messaging is available when requested
 */
export async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInitialized) {
    return messagingInstance;
  }

  try {
    const supported = await isSupported();
    
    if (!supported) {
      console.warn('⚠️  Firebase Cloud Messaging is not supported:', {
        protocol: window.location.protocol,
        isSecure: window.isSecureContext,
      });
      messagingInitialized = true;
      return null;
    }

    // Check if service worker is already registered
    let registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    
    if (!registration) {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
    }

    // Ensure service worker is ready
    await navigator.serviceWorker.ready;
    
    // Check if service worker is controlling the page
    if (!navigator.serviceWorker.controller) {
      const refreshKey = 'fcm-sw-refresh-count';
      const refreshCount = parseInt(sessionStorage.getItem(refreshKey) || '0');
      
      if (refreshCount < 2) {
        // Try up to 2 reloads
        sessionStorage.setItem(refreshKey, String(refreshCount + 1));
        
        // Use hard reload to force SW activation
        window.location.reload();
        return null;
      } else {
        sessionStorage.removeItem(refreshKey);
        messagingInitialized = true;
        return null;
      }
    } else {
      sessionStorage.removeItem('fcm-sw-refresh-count');
    }

    try {
      // Use the standard getMessaging() call
      // We try with the app instance explicitly
      try {
        messagingInstance = getMessaging(app);
      } catch (e: any) {
        // Fallback to default app
        messagingInstance = getMessaging();
      }
    } catch (error: any) {
      console.error('❌ [FCM Config] getMessaging() failed:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3)
      });
      throw error;
    }
    
  } catch (error) {
    console.error('❌ [FCM Config] Error initializing Firebase Cloud Messaging:', error);
  }
  
  messagingInitialized = true;
  return messagingInstance;
}

// Legacy export for backwards compatibility
export const messaging = messagingInstance;
