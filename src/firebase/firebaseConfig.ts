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
    // Detailed diagnostics
    console.log('🔍 [FCM Config] Environment check:', {
      protocol: window.location.protocol,
      isSecure: window.isSecureContext,
      hasServiceWorker: 'serviceWorker' in navigator,
      hasNotification: 'Notification' in window,
      hasPushManager: 'PushManager' in window,
    });

    const supported = await isSupported();
    console.log('🔍 [FCM Config] isSupported() result:', supported);
    
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
      console.log('🔧 [FCM Config] Registering service worker...');
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      console.log('🔧 [FCM Config] Service worker registered, waiting for activation...');
    }

    // Ensure service worker is ready
    await navigator.serviceWorker.ready;
    console.log('✅ [FCM Config] Service worker ready');
    
    // Check if service worker is controlling the page
    if (!navigator.serviceWorker.controller) {
      console.log('⚠️  [FCM Config] Service worker not controlling page yet');
      
      const refreshKey = 'fcm-sw-refresh-count';
      const refreshCount = parseInt(sessionStorage.getItem(refreshKey) || '0');
      
      if (refreshCount < 2) {
        // Try up to 2 reloads
        sessionStorage.setItem(refreshKey, String(refreshCount + 1));
        console.log(`🔄 [FCM Config] Reloading page to activate service worker (attempt ${refreshCount + 1}/2)...`);
        
        // Use hard reload to force SW activation
        window.location.reload();
        return null;
      } else {
        console.error('❌ [FCM Config] Service worker failed to take control after 2 reloads');
        sessionStorage.removeItem(refreshKey);
        messagingInitialized = true;
        return null;
      }
    } else {
      console.log('✅ [FCM Config] Service worker is controlling the page');
      sessionStorage.removeItem('fcm-sw-refresh-count');
    }
    
    console.log('🚀 [FCM Config] Initializing Firebase Messaging...');
    
    // Diagnostic: Check if messaging is registered in the app's component container
    const container = (app as any).container;
    if (container) {
      const providers = Array.from(container.providers.keys());
      console.log('🔍 [FCM Config] Registered components:', providers);
      if (!providers.includes('messaging')) {
        console.warn('⚠️  [FCM Config] "messaging" component is NOT registered in Firebase App!');
      }
    }

    try {
      // Use the standard getMessaging() call
      // We try with the app instance explicitly
      try {
        console.log('🔧 [FCM Config] Calling getMessaging(app)...');
        messagingInstance = getMessaging(app);
      } catch (e: any) {
        console.warn('⚠️  [FCM Config] getMessaging(app) failed, trying getMessaging()...', e.message);
        // Fallback to default app
        messagingInstance = getMessaging();
      }
      
      console.log('✅ [FCM Config] Firebase Cloud Messaging initialized');
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
