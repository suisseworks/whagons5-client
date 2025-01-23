import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { WhagonsAPP } from './WhagonsAPP';
import { AuthProvider } from './context/AuthContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <WhagonsAPP />
    </AuthProvider>
  </React.StrictMode>,
);
