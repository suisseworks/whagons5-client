import ReactDOM from 'react-dom/client';
import './index.css';
// Bryntum Scheduler styles deshabilitados temporalmente hasta tener licencia/paquete
/* import '@bryntum/scheduler/scheduler.css';
import '@bryntum/scheduler/stockholm-light.css';
import '@bryntum/scheduler/fontawesome/css/fontawesome.css';
import '@bryntum/scheduler/fontawesome/css/solid.css'; */
import App from './App';
import { AuthProvider } from './providers/AuthProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { BrandingProvider } from './providers/BrandingProvider';
import { LanguageProvider } from './providers/LanguageProvider';
import { Toaster } from 'react-hot-toast';
import { Provider } from 'react-redux';
import {store } from './store';
// PWA temporarily disabled
// import { registerSW } from 'virtual:pwa-register';
// import { DB } from './store/indexedDB/DB';
// import * as CryptoAPI from './crypto/crypto';
// import { genericActions } from './store/genericSlices';
import { initFontStyle } from './utils/fontStyle';

// Initialize font style
initFontStyle();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  // <React.StrictMode>
    <Provider store={store}>
        <ThemeProvider defaultTheme="light" storageKey="whagons-ui-theme">
          <LanguageProvider>
            <BrandingProvider>
              <AuthProvider>
                <App />
                <Toaster 
                  position="bottom-right"
                  containerStyle={{
                    bottom: '20px',
                    right: '100px',
                  }}
                  toastOptions={{
                    duration: 5000,
                    style: {
                      background: '#363636',
                      color: '#fff',
                    },
                    success: {
                      duration: 8000,
                      iconTheme: {
                        primary: '#4ade80',
                        secondary: '#fff',
                      },
                    },
                    error: {
                      duration: 5000,
                      iconTheme: {
                        primary: '#ef4444',
                        secondary: '#fff',
                      },
                    },
                  }}
                />
              </AuthProvider>
            </BrandingProvider>
          </LanguageProvider>
        </ThemeProvider>
    </Provider>
  // {/* </React.StrictMode>, */}
);

// Dev-only: expose the sandbox so you can test from the console quickly.
if (import.meta.env.DEV) {
  import('./sandbox/devExpose')
    .then((m) => m.exposeSandboxToWindow())
    .catch(() => {
      // ignore
    });
}



// PWA registration temporarily disabled for debugging
// Register PWA in production only
// if (import.meta.env.VITE_DEVELOPMENT !== 'true') {
//   const updateSW = registerSW({
//     immediate: true,
//     onRegistered(r) {
//       console.log('[PWA] Service Worker registered');
//       // Check for updates every 5 minutes
//       setInterval(() => {
//         if (r) {
//           r.update();
//         }
//       }, 5 * 60 * 1000);
//       
//       // Also check immediately on page visibility change (user returns to tab)
//       document.addEventListener('visibilitychange', () => {
//         if (!document.hidden && r) {
//           r.update();
//         }
//       });
//     },
//     onRegisterError(error) {
//       console.error('[PWA] Service Worker registration error', error);
//     },
//     onNeedRefresh() {
//       console.log('[PWA] Update available, reloading page...');
//       // Automatically reload when update is ready (skipWaiting + reload)
//       updateSW(true);
//     },
//     onOfflineReady() {
//       console.log('[PWA] App ready to work offline');
//     },
//   });
// }

// // Expose debug helpers for manual testing in console
// // eslint-disable-next-line @typescript-eslint/ban-ts-comment
// // @ts-ignore
// window.DB = DB;
// // eslint-disable-next-line @typescript-eslint/ban-ts-comment
// // @ts-ignore
// window.CryptoAPI = CryptoAPI;
// // eslint-disable-next-line @typescript-eslint/ban-ts-comment
// // @ts-ignore
// window.store = store;
// // eslint-disable-next-line @typescript-eslint/ban-ts-comment
// // @ts-ignore
// window.genericActions = genericActions;
