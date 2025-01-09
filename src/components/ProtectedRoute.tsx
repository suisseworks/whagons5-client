// src/components/ProtectedRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  // Show a loading indicator while checking auth state
  if (loading) {
    return <div>Loading...</div>;
  }

  // If user is not logged in, redirect to login page
  if (!user) {
    return <Navigate to="/auth/signin" />;
  }

  // If logged in, show the dashboard (or whatever content is wrapped)
  return <>{children}</>;
};

export default ProtectedRoute;
