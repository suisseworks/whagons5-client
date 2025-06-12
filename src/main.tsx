import ReactDOM from 'react-dom/client';
import './index.css';
import '@fortawesome/fontawesome-free/css/all.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './hooks/theme-provider';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  // <React.StrictMode>
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  // {/* </React.StrictMode>, */}
);
