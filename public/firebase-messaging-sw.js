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

// Generic push listener for DevTools testing
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Generic Push event received:', event);
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : 'Default DevTools Push Message' };
  }

  // If this was a Firebase message, messaging.onBackgroundMessage will handle it.
  // But if it's a generic message from DevTools, we handle it here to show something.
  if (!data.notification && !data.data) {
    const title = 'DevTools Test Push';
    const options = {
      body: data.body || 'This is a test notification from browser DevTools',
      icon: '/whagons.svg',
      badge: '/whagons.svg',
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// Handle background messages (when app is not in focus)
messaging.onBackgroundMessage((payload) => {
  console.log('[Service Worker] Background message received:', payload);
  
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/whagons.svg',
    badge: '/whagons.svg',
    data: payload.data || {},
    tag: payload.data?.type || 'default', // Group similar notifications
    requireInteraction: payload.data?.priority === 'urgent' || payload.data?.priority === 'high',
    vibrate: [200, 100, 200], // Vibration pattern
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
      if (data.task_id) {
        urlToOpen = `/tasks/${data.task_id}`;
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
