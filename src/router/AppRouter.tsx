import { Route, Routes } from 'react-router-dom';

import { PrivateRoute, PublicRoute, AuthRoute } from './guard';
import { HomeRoutes } from './HomeRouter';
import SignIn from '@/pages/authentication/SignIn';
import SignUp from '@/pages/authentication/SignUp';
import OnboardingRoute from './OnboardingRoute';
import { useEffect, useRef } from 'react';
import { WorkspaceCache } from '@/store/indexedDB/WorkspaceCache';
import { TeamsCache } from '@/store/indexedDB/TeamsCache';
import { CategoriesCache } from '@/store/indexedDB/CategoriesCache';
import { TasksCache } from '@/store/indexedDB/TasksCache';
import { TemplatesCache } from '@/store/indexedDB/TemplatesCache';

export const AppRouter = () => {

  useEffect(() => {
    // Initialize caches
    WorkspaceCache.init();
    TeamsCache.init();
    CategoriesCache.init();
    TasksCache.init();
    TemplatesCache.init();

    
   
  }, []);

  return (
    <Routes>
      <Route
        path="/auth/signin"
        element={
          <PublicRoute>
            <SignIn />
          </PublicRoute>
        }
      />
      <Route
        path="/auth/signup"
        element={
          <PublicRoute>
            <SignUp />
          </PublicRoute>
        }
      />

      <Route
        path="/onboarding"
        element={
          <AuthRoute>
            <OnboardingRoute />
          </AuthRoute>
        }
      />

      <Route
        path="/*"
        element={
          <PrivateRoute>
            <HomeRoutes />
          </PrivateRoute>
        }
      />
    </Routes>
  );
};
