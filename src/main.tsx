import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './providers/AuthProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { Provider } from 'react-redux';
import {store } from './store';

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
