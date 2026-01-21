// Service worker for Firebase Cloud Messaging background notifications
// This file must be in the public directory at the root level

// Import Firebase scripts for service worker
// IMPORTANT: Version must match the firebase package version in package.json (currently 11.10.0)
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

// Initialize Firebase in service worker
firebase.initializeApp({
  apiKey: "AIzaSyAD1bLLRlRUoS2rEg3ZKqGQ3bE1chfySSY",
  authDomain: "whagons-5.firebaseapp.com",
  projectId: "whagons-5",
  storageBucket: "whagons-5.firebasestorage.app",
  messagingSenderId: "578623964983",
  appId: "1:578623964983:web:6d30a61ae7997530dbfcb2",
  measurementId: "G-8CJ3W1FCG3"
});

const messaging = firebase.messaging();

// Handle service worker lifecycle to take control immediately
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(clients.claim());
});

// Generic push listener for DevTools testing and debugging
self.addEventListener('push', (event) => {
  console.log('[Service Worker] 🔔 Push event received');
  
  // Try to parse the data
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    try {
      data = { body: event.data ? event.data.text() : 'Default DevTools Push Message' };
    } catch (e2) {
      console.warn('[Service Worker] Could not parse push data');
    }
  }

  // Check if this is a Firebase message or DevTools test
  const isFirebase = !!(data.notification || data.from || (data.data && Object.keys(data.data).length > 0));
  
  if (!isFirebase) {
    console.log('[Service Worker] 🧪 DevTools test - creating notification');
    
    // Create a fake Firebase-like payload for testing
    const fakePayload = {
      notification: {
        title: 'DevTools Test Notification',
        body: data.body || 'This is a test notification from browser DevTools'
      },
      data: {
        type: 'test'
      }
    };
    
    // Store and show the notification
    event.waitUntil((async () => {
      await storeNotification(fakePayload);
      await self.registration.showNotification(
        fakePayload.notification.title,
        {
          body: fakePayload.notification.body,
          icon: '/whagons.svg',
          badge: '/whagons.svg',
          data: fakePayload.data
        }
      );
      console.log('[Service Worker] ✅ DevTools test notification sent');
    })());
  }
});

// Helper function to store notification in IndexedDB
async function storeNotification(payload) {
  try {
    // Get all database names
    const dbNames = await indexedDB.databases();
    if (!dbNames || dbNames.length === 0) {
      console.warn('[Service Worker] No IndexedDB databases found');
      return;
    }
    
    // Find the user database (should be a firebase UID)
    const userDb = dbNames.find(db => db.name && db.name.length > 20);
    if (!userDb) {
      console.warn('[Service Worker] Could not find user database');
      return;
    }
    
    // Open database - don't specify version to use latest
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(userDb.name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // Check if notifications store exists
    if (!db.objectStoreNames.contains('notifications')) {
      console.warn('[Service Worker] Notifications store not found');
      db.close();
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
    
    const tx = db.transaction(['notifications'], 'readwrite');
    const store = tx.objectStore('notifications');
    
    await new Promise((resolve, reject) => {
      const request = store.add(notification);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    db.close();
    console.log('[Service Worker] ✅ Notification stored:', notification.title);
    
    // Notify all clients to refresh notifications
    const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    allClients.forEach(client => {
      client.postMessage({
        type: 'NEW_NOTIFICATION',
        notification: notification
      });
    });
  } catch (error) {
    console.error('[Service Worker] Error storing notification:', error);
  }
}

// Helper function to determine notification URL
function getNotificationUrl(data) {
  if (!data || !data.type) {
    console.log('[Service Worker] No type in notification data, returning null');
    return null; // Return null instead of '/' so we don't navigate
  }
  
  console.log('[Service Worker] Getting URL for notification type:', data.type);
  
  switch (data.type) {
    case 'broadcast':
      return data.broadcast_id ? `/broadcasts?id=${data.broadcast_id}` : '/broadcasts';
    case 'task_assigned':
    case 'task_created_assigned':
      return data.workspace_id ? `/workspace/${data.workspace_id}?taskId=${data.task_id}` : (data.task_id ? `/tasks?taskId=${data.task_id}` : '/tasks');
    case 'task_updated':
      return data.workspace_id ? `/workspace/${data.workspace_id}?taskId=${data.task_id}` : (data.task_id ? `/tasks?taskId=${data.task_id}` : '/tasks');
    case 'approval_requested':
      return data.workspace_id ? `/workspace/${data.workspace_id}?taskId=${data.task_id}` : (data.task_id ? `/tasks?taskId=${data.task_id}` : '/tasks');
    case 'approval_approved':
      return data.workspace_id ? `/workspace/${data.workspace_id}?taskId=${data.task_id}` : (data.task_id ? `/tasks?taskId=${data.task_id}` : '/tasks');
    case 'message':
      return data.message_id ? `/messages?id=${data.message_id}` : '/messages';
    case 'test':
      console.log('[Service Worker] Test notification - no navigation');
      return null; // Test notifications shouldn't navigate
    default:
      console.log('[Service Worker] Unknown notification type:', data.type);
      return null;
  }
}

// Handle background messages (when app is not in focus)
messaging.onBackgroundMessage(async (payload) => {
  console.log('[Service Worker] 🔥 Firebase notification:', payload.notification?.title);
  
  // Store notification in IndexedDB
  await storeNotification(payload);
  
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/whagons.svg',
    badge: '/whagons.svg',
    data: payload.data || {},
    tag: payload.data?.type || 'default',
    requireInteraction: payload.data?.priority === 'urgent' || payload.data?.priority === 'high',
    vibrate: [200, 100, 200],
  };

  // Show notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.notification);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  let urlToOpen = '/';

  // Determine which page to open based on notification type
  switch (data.type) {
    case 'broadcast':
      if (data.broadcast_id) {
        urlToOpen = `/broadcasts?id=${data.broadcast_id}`;
      }
      break;
    case 'task_assigned':
    case 'task_created_assigned':
    case 'task_updated':
    case 'approval_requested':
    case 'approval_approved':
      // Navigate to workspace if available, otherwise fallback to tasks
      if (data.workspace_id && data.task_id) {
        urlToOpen = `/workspace/${data.workspace_id}?taskId=${data.task_id}`;
      } else if (data.task_id) {
        urlToOpen = `/tasks?taskId=${data.task_id}`;
      } else {
        urlToOpen = '/tasks';
      }
      break;
    case 'message':
      if (data.message_id) {
        urlToOpen = `/messages?id=${data.message_id}`;
      }
      break;
    default:
      urlToOpen = '/notifications';
  }

  // Open the URL or focus existing window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              data: data,
              url: urlToOpen
            });
            return;
          }
        }
        
        // No window open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
