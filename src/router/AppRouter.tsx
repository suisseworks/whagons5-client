import { Route, Routes } from "react-router"

import { PrivateRoute, PublicRoute } from './guard';
import { LoginPage } from "../features/auth";
import { HomeRoutes } from "./HomeRouter";

export const AppRouter = () => {


    return (
        <Routes>
            <Route path="login/*" element={
                <PublicRoute> 
                    <Routes>
                        <Route path="/*" element={<LoginPage />} />
                    </Routes>
                </PublicRoute>
            } />

            <Route path="/*" element={
                <PrivateRoute>
                    <HomeRoutes />
                </PrivateRoute>
            } />
        </Routes>
    )
}
