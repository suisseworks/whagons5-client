import { Route, Routes } from 'react-router-dom';

import { PrivateRoute, PublicRoute, AuthRoute } from './guard';
// import { LoginPage } from '../features/auth';
import { HomeRoutes } from './HomeRouter';
import SignIn from '../pages/Authentication/SignIn';
import SignUp from '../pages/Authentication/SignUp';
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
