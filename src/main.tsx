import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './providers/AuthProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { Provider } from 'react-redux';
import {store } from './store';
import { registerSW } from 'virtual:pwa-register';
import { DB } from './store/indexedDB/DB';
import * as CryptoAPI from './crypto/crypto';
import { genericActions } from './store/genericSlices';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  // <React.StrictMode>
    <Provider store={store}>
        <ThemeProvider defaultTheme="light" storageKey="whagons-ui-theme">
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
    </Provider>
  // {/* </React.StrictMode>, */}
);

// Register PWA in production only
if (import.meta.env.VITE_DEVELOPMENT !== 'true') {
  registerSW({ immediate: true });
}

// Expose debug helpers for manual testing in console
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
window.DB = DB;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
window.CryptoAPI = CryptoAPI;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
window.store = store;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
window.genericActions = genericActions;
