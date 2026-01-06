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
import { Provider } from 'react-redux';
import {store } from './store';
import { registerSW } from 'virtual:pwa-register';
// import { DB } from './store/indexedDB/DB';
// import * as CryptoAPI from './crypto/crypto';
// import { genericActions } from './store/genericSlices';
import { applyEncryptionConfig } from './config/encryptionConfig';

// Initialize encryption configuration
applyEncryptionConfig();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  // <React.StrictMode>
    <Provider store={store}>
        <ThemeProvider defaultTheme="light" storageKey="whagons-ui-theme">
          <LanguageProvider>
            <BrandingProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </BrandingProvider>
          </LanguageProvider>
        </ThemeProvider>
    </Provider>
  // {/* </React.StrictMode>, */}
);



// Register PWA in production only
if (import.meta.env.VITE_DEVELOPMENT !== 'true') {
  registerSW({ immediate: true });
}

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
