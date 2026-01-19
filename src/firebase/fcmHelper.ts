import { getToken, onMessage } from "firebase/messaging";
import { getMessagingInstance } from "./firebaseConfig";
import { api } from "@/api/whagonsApi";
import toast from "react-hot-toast";

// VAPID key from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

if (!VAPID_KEY) {
  console.warn('⚠️  [FCM] VITE_FIREBASE_VAPID_KEY is not set. Push notifications will not work.');
  console.warn('Get your VAPID key from: Firebase Console > Project Settings > Cloud Messaging > Web Push certificates');
}

/**
 * Request notification permission and register FCM token
 */
export async function requestNotificationPermission(): Promise<string | null> {
  console.log('🔔 [FCM] Starting notification permission request...');
  
  // Get messaging instance (initializes if needed)
  const messaging = await getMessagingInstance();
  
  if (!messaging) {
    console.warn('⚠️  [FCM] Messaging not supported in this browser');
    return null;
  }
  
  console.log('✅ [FCM] Messaging instance ready');

  // Check current permission status
  const currentPermission = Notification.permission;
  console.log('🔍 [FCM] Current notification permission:', currentPermission);
  
  if (currentPermission === 'denied') {
    console.log('🚫 [FCM] User previously denied notifications');
    return null;
  }

  try {
    let permission: NotificationPermission = currentPermission;
    
    // Only ask if not already granted
    if (permission === 'default') {
      console.log('📢 [FCM] Requesting notification permission from user...');
      permission = await Notification.requestPermission();
      console.log('📋 [FCM] Permission result:', permission);
    } else {
      console.log('ℹ️  [FCM] Permission already', permission);
    }
    
    if (permission !== 'granted') {
      console.log('❌ [FCM] Notification permission not granted');
      return null;
    }

    // Service worker should already be registered by getMessagingInstance()
    console.log('🔍 [FCM] Getting service worker registration...');
    const registration = await navigator.serviceWorker.ready;
    console.log('✅ [FCM] Service worker registration ready');

    // Get FCM token from Firebase
    console.log('🔑 [FCM] Requesting token from Firebase...');
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });
    
    if (!token) {
      console.error('Failed to get FCM token');
      return null;
    }

    console.log('✅ FCM Token obtained:', token.substring(0, 20) + '...');

    // Register with backend
    await registerTokenWithBackend(token, 'web');
    
    return token;
  } catch (error) {
    console.error('Error in FCM registration:', error);
    return null;
  }
}

/**
 * Register FCM token with backend
 */
async function registerTokenWithBackend(
  fcmToken: string, 
  platform: 'web' | 'android' | 'ios'
) {
  try {
    const deviceId = getOrCreateDeviceId();
    
    const response = await api.post('/fcm-tokens', {
      fcm_token: fcmToken,
      platform: platform,
      device_id: deviceId,
      app_version: import.meta.env.VITE_APP_VERSION || '1.0.0'
    });
    
    console.log('✅ FCM token registered with backend');
    
    // Store locally for comparison (detect token changes)
    localStorage.setItem('wh-fcm-token', fcmToken);
    localStorage.setItem('wh-fcm-registered', 'true');
  } catch (error: any) {
    // Handle duplicate token error gracefully
    if (error.response?.status === 409 || error.response?.data?.message?.includes('duplicate')) {
      console.log('ℹ️  FCM token already registered');
      localStorage.setItem('wh-fcm-token', fcmToken);
      localStorage.setItem('wh-fcm-registered', 'true');
    } else {
      console.error('❌ Failed to register FCM token:', error);
      throw error;
    }
  }
}

/**
 * Unregister FCM token (call on logout)
 */
export async function unregisterToken() {
  const token = localStorage.getItem('wh-fcm-token');
  if (!token) return;

  try {
    await api.delete('/fcm-tokens', {
      data: { fcm_token: token }
    });
    localStorage.removeItem('wh-fcm-token');
    localStorage.removeItem('wh-fcm-registered');
    console.log('✅ FCM token unregistered');
  } catch (error) {
    console.error('❌ Failed to unregister FCM token:', error);
  }
}

/**
 * Setup foreground message handler
 */
export async function setupForegroundMessageHandler() {
  const messaging = await getMessagingInstance();
  
  if (!messaging) return;
  
  onMessage(messaging, (payload) => {
    console.log('📨 Foreground notification received:', payload);
    
    const title = payload.notification?.title || 'New Notification';
    const body = payload.notification?.body || '';
    const data = payload.data || {};

    // Show toast notification (text only - no JSX in .ts file)
    const toastId = toast(
      `${title}\n${body}`,
      {
        duration: 6000,
        position: 'top-right',
        icon: '🔔',
        style: {
          cursor: 'pointer'
        }
      }
    );
    
    // Handle click on toast
    const toastElement = document.querySelector(`[data-toast-id="${toastId}"]`);
    if (toastElement) {
      toastElement.addEventListener('click', () => handleNotificationClick(data));
    }

    // Also show browser notification if permission granted
    if (Notification.permission === 'granted' && document.hidden) {
      new Notification(title, {
        body: body,
        icon: '/whagons.svg',
        badge: '/whagons.svg',
        data: data
      });
    }
  });
}

/**
 * Handle notification click - navigate to relevant page
 */
function handleNotificationClick(data: any) {
  const type = data.type;
  
  switch (type) {
    case 'broadcast':
      if (data.broadcast_id) {
        window.location.href = `/broadcasts?id=${data.broadcast_id}`;
      }
      break;
    case 'task_assigned':
      if (data.task_id) {
        window.location.href = `/tasks/${data.task_id}`;
      }
      break;
    case 'message':
      if (data.message_id) {
        window.location.href = `/messages?id=${data.message_id}`;
      }
      break;
    default:
      // Generic notification - go to notifications page
      window.location.href = '/notifications';
  }
}

/**
 * Get or create unique device ID
 */
function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem('wh-device-id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('wh-device-id', deviceId);
  }
  return deviceId;
}

/**
 * Check if FCM is initialized and ready
 */
export async function isFCMReady(): Promise<boolean> {
  const messaging = await getMessagingInstance();
  return messaging !== null && Notification.permission === 'granted';
}

/**
 * Check if user has already registered FCM token
 */
export function isTokenRegistered(): boolean {
  return localStorage.getItem('wh-fcm-registered') === 'true';
}
