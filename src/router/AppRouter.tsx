import { Navigate, Route, Routes } from "react-router"
import { LoginPage } from "../features/auth";
import { DashBoardTicket } from "../features/tasks";
import { PrivateRoute } from "./PrivateRoute";

export const AppRouter = () => {

    const authStatus = 'not-authenticated';

    return (
        <Routes>
            <Route path="/auth/*" element={<LoginPage/>}></Route>

            <Route path="/tasks" element={
                <PrivateRoute>
                    <DashBoardTicket />
                </PrivateRoute>
            } />
            
            <Route path="/*" element={<Navigate to='/auth/login' />} />
        </Routes>
    )
}
