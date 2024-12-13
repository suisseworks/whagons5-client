import { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuthStore } from "../../features/auth/hooks/useAuthStore";

interface PublicRouteProps {
  children: ReactNode;
}

export const PublicRoute = ({ children }: PublicRouteProps) => {
  const { status } = useAuthStore();

  return status === "authenticated" ? <Navigate to="/" replace /> : <>{children}</>;
};
