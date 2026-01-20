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

    // Wait for service worker to be ready (this ensures registration.active exists)
    const readyRegistration = await navigator.serviceWorker.ready;
    
    // Wait for service worker to become active/controlling if not already
    if (!navigator.serviceWorker.controller) {
      console.log('[FCM Config] Service worker not yet controlling, waiting for activation...');
      
      // Wait for service worker to become active and controlling
      const swActivated = await new Promise<boolean>((resolve) => {
        // Double-check if controller appeared (race condition)
        if (navigator.serviceWorker.controller) {
          resolve(true);
          return;
        }

        let resolved = false;
        const cleanup = () => {
          if (resolved) return;
          resolved = true;
          
          if (readyRegistration.active) {
            readyRegistration.active.removeEventListener('statechange', handleStateChange);
          }
          readyRegistration.removeEventListener('updatefound', handleUpdateFound);
          navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        };

        // Listen for service worker state changes
        const handleStateChange = () => {
          if (resolved) return;
          const activeWorker = readyRegistration.active;
          if (activeWorker && activeWorker.state === 'activated') {
            // Give it a moment to become controlling
            setTimeout(() => {
              if (navigator.serviceWorker.controller) {
                cleanup();
                resolve(true);
              }
            }, 100);
          }
        };

        // Listen for new service worker installation
        const handleUpdateFound = () => {
          if (resolved) return;
          const newWorker = readyRegistration.installing || readyRegistration.waiting;
          if (newWorker) {
            newWorker.addEventListener('statechange', handleStateChange);
            // Check current state immediately
            if (newWorker.state === 'activated') {
              handleStateChange();
            }
          }
        };

        // Listen for controller change (most reliable indicator)
        const handleControllerChange = () => {
          if (resolved) return;
          if (navigator.serviceWorker.controller) {
            cleanup();
            resolve(true);
          }
        };

        // Set up listeners
        if (readyRegistration.active) {
          readyRegistration.active.addEventListener('statechange', handleStateChange);
          // Check current state immediately
          if (readyRegistration.active.state === 'activated') {
            handleStateChange();
          }
        }
        
        readyRegistration.addEventListener('updatefound', handleUpdateFound);
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        // Timeout after 5 seconds - don't block forever
        setTimeout(() => {
          if (!resolved) {
            cleanup();
            console.warn('[FCM Config] Service worker activation timeout - may need manual refresh');
            // Show non-blocking prompt to user (only if in browser context)
            if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
              const shouldRefresh = window.confirm(
                'Firebase messaging needs a page refresh to work properly. Refresh now?'
              );
              if (shouldRefresh) {
                window.location.reload();
              }
            }
            resolve(false);
          }
        }, 5000);
      });

      if (!swActivated) {
        console.warn('[FCM Config] Service worker not activated, messaging may not work until refresh');
        messagingInitialized = true;
        return null;
      }
    }

    // Final verification: service worker must be controlling before proceeding
    if (!navigator.serviceWorker.controller) {
      console.warn('[FCM Config] Service worker is not controlling the page - messaging may not work');
      messagingInitialized = true;
      return null;
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

/**
 * Get messaging instance synchronously (returns current instance, may be null if not initialized)
 * For guaranteed initialization, use getMessagingInstance() instead
 */
export function getMessagingSync(): Messaging | null {
  return messagingInstance;
}
