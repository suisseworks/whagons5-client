import { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuthStore } from "../../features/auth/hooks/useAuthStore";

interface PrivateRouteProps {
  children: ReactNode;
}

export const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const { status } = useAuthStore();

  //forsando login por ahora 
  return <>{children}</>
  
  // return status === "authenticated" ? <>{children}</> : <Navigate to="/login" replace />;
  
};
