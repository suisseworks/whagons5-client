import { Route, Routes } from 'react-router-dom';

import { PrivateRoute, PublicRoute, AuthRoute } from './guard';
import { HomeRoutes } from './HomeRouter';
import SignIn from '@/pages/authentication/SignIn';
import SignUp from '@/pages/authentication/SignUp';
import InvitationSignUp from '@/pages/authentication/InvitationSignUp';
import OnboardingRoute from './OnboardingRoute';

export const AppRouter = () => {


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
        path="/auth/invitation/:token"
        element={
          <PublicRoute>
            <InvitationSignUp />
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
