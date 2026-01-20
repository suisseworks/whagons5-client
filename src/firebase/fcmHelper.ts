import { getToken, onMessage, Unsubscribe } from "firebase/messaging";
import { getMessagingInstance } from "./firebaseConfig";
import { api } from "@/api/whagonsApi";
import { showNotificationToast, getNotificationIcon } from "@/components/ui/NotificationToast";

// VAPID key from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

if (!VAPID_KEY) {
  console.warn('⚠️  [FCM] VITE_FIREBASE_VAPID_KEY is not set. Push notifications will not work.');
  console.warn('Get your VAPID key from: Firebase Console > Project Settings > Cloud Messaging > Web Push certificates');
}

// Module-level flags to track FCM state
let fcmInitialized = false; // Tracks permission/token registration state
let handlerInitialized = false; // Tracks foreground message handler setup state
let messageHandlerUnsubscribe: Unsubscribe | null = null;

/**
 * Request notification permission and register FCM token (idempotent - only requests once per session)
 */
export async function requestNotificationPermission(): Promise<string | null> {
  // Return early if already initialized (permission already requested)
  if (fcmInitialized) {
    // Return existing token if available
    const existingToken = localStorage.getItem('wh-fcm-token');
    if (existingToken) {
      return existingToken;
    }
    // If initialized but no token, still return null (permission might have been denied)
    return null;
  }

  // Get messaging instance (initializes if needed)
  const messaging = await getMessagingInstance();
  
  if (!messaging) {
    console.warn('⚠️  [FCM] Messaging not supported in this browser');
    return null;
  }

  // Check current permission status
  const currentPermission = Notification.permission;
  
  if (currentPermission === 'denied') {
    return null;
  }

  try {
    let permission: NotificationPermission = currentPermission;
    
    // Only ask if not already granted
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    
    if (permission !== 'granted') {
      return null;
    }

    // Service worker should already be registered by getMessagingInstance()
    const registration = await navigator.serviceWorker.ready;

    // Get FCM token from Firebase
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });
    
    if (!token) {
      console.error('Failed to get FCM token');
      return null;
    }

    // Register with backend
    await registerTokenWithBackend(token, 'web');
    
    // Mark as initialized after successful token registration
    fcmInitialized = true;
    
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
    
    await api.post('/fcm-tokens', {
      fcm_token: fcmToken,
      platform: platform,
      device_id: deviceId,
      app_version: import.meta.env.VITE_APP_VERSION || '1.0.0'
    });
    
    // Store locally for comparison (detect token changes)
    localStorage.setItem('wh-fcm-token', fcmToken);
    localStorage.setItem('wh-fcm-registered', 'true');
  } catch (error: any) {
    // Handle duplicate token error gracefully
    if (error.response?.status === 409 || error.response?.data?.message?.includes('duplicate')) {
      localStorage.setItem('wh-fcm-token', fcmToken);
      localStorage.setItem('wh-fcm-registered', 'true');
    } else {
      console.error('❌ Failed to register FCM token:', error);
      throw error;
    }
  }
}

/**
 * Unregister FCM token and cleanup handlers (call on logout)
 */
export async function unregisterToken() {
  // Unsubscribe message handler if it exists
  if (messageHandlerUnsubscribe) {
    try {
      messageHandlerUnsubscribe();
    } catch (error) {
      console.warn('Failed to unsubscribe FCM message handler:', error);
    }
    messageHandlerUnsubscribe = null;
  }

  // Reset initialization flags
  fcmInitialized = false;
  handlerInitialized = false;

  const token = localStorage.getItem('wh-fcm-token');
  if (!token) return;

  try {
    await api.delete('/fcm-tokens', {
      data: { fcm_token: token }
    });
    localStorage.removeItem('wh-fcm-token');
    localStorage.removeItem('wh-fcm-registered');
  } catch (error) {
    console.error('❌ Failed to unregister FCM token:', error);
  }
}

/**
 * Store notification in IndexedDB
 */
async function storeNotification(payload: any) {
  try {
    const { DB } = await import('@/store/indexedDB/DB');
    const { store } = await import('@/store/store');
    const { genericActions } = await import('@/store/genericSlices');
    
    if (!DB.inited || !DB.db) {
      console.warn('⚠️ DB not initialized, skipping notification storage');
      return;
    }

    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: payload.notification?.title || 'New Notification',
      body: payload.notification?.body || '',
      data: payload.data || {},
      type: payload.data?.type || 'default',
      url: getNotificationUrl(payload.data),
      received_at: new Date().toISOString(),
      viewed_at: null, // Set when user opens dropdown
    };

    const tx = DB.db.transaction(['notifications'], 'readwrite');
    const objectStore = tx.objectStore('notifications');
    await objectStore.add(notification);

    // Update Redux state
    store.dispatch(genericActions.notifications.addAsync(notification) as any);
  } catch (error) {
    console.error('❌ Error storing notification:', error);
  }
}

/**
 * Get notification URL based on data
 */
function getNotificationUrl(data: any): string {
  if (!data) return '/';
  
  switch (data.type) {
    case 'broadcast':
      return data.broadcast_id ? `/broadcasts?id=${data.broadcast_id}` : '/broadcasts';
    case 'task_assigned':
    case 'task_created_assigned':
      return data.workspace_id && data.task_id
        ? `/workspace/${data.workspace_id}?taskId=${data.task_id}`
        : (data.task_id ? `/tasks?taskId=${data.task_id}` : '/tasks');
    case 'task_updated':
      return data.workspace_id && data.task_id
        ? `/workspace/${data.workspace_id}?taskId=${data.task_id}`
        : (data.task_id ? `/tasks?taskId=${data.task_id}` : '/tasks');
    case 'approval_requested':
      return data.workspace_id && data.task_id
        ? `/workspace/${data.workspace_id}?taskId=${data.task_id}`
        : (data.task_id ? `/tasks?taskId=${data.task_id}` : '/tasks');
    case 'approval_approved':
      return data.workspace_id && data.task_id
        ? `/workspace/${data.workspace_id}?taskId=${data.task_id}`
        : (data.task_id ? `/tasks?taskId=${data.task_id}` : '/tasks');
    case 'message':
      return data.message_id ? `/messages?id=${data.message_id}` : '/messages';
    default:
      return '/';
  }
}

function spaNavigate(url: string) {
  // Let React Router handle navigation (no hard reload).
  // App.tsx listens for this event and calls navigate().
  window.dispatchEvent(new CustomEvent('wh:navigate', { detail: { url } }));
}

/**
 * Setup foreground message handler (idempotent - only sets up once per session)
 */
export async function setupForegroundMessageHandler() {
  // Return early if handler is already set up
  if (handlerInitialized || messageHandlerUnsubscribe) {
    return;
  }

  const messaging = await getMessagingInstance();
  
  if (!messaging) return;
  
  messageHandlerUnsubscribe = onMessage(messaging, async (payload) => {
    const title = payload.notification?.title || 'New Notification';
    const body = payload.notification?.body || '';
    const data = payload.data || {};

    // Store notification in IndexedDB
    await storeNotification(payload);

    // Show beautiful toast notification
    showNotificationToast({
      title,
      body,
      icon: getNotificationIcon(data.type),
      onClick: () => handleNotificationClick(data),
      duration: 6000,
    });

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

  // Mark handler as initialized after handler is set up
  handlerInitialized = true;
}

/**
 * Handle notification click - navigate to relevant page
 */
function handleNotificationClick(data: any) {
  spaNavigate(getNotificationUrl(data));
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
