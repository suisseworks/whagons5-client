import { Navigate, Route, Routes } from 'react-router'

import { DashBoardTicket } from '../features/tasks'
import { DashboardWorkplan } from '../features/workplan';
import MainLayout from '../layouts/MainLayout'
import SignIn from '../pages/Authentication/SignIn';

export const HomeRoutes = () => {
    return (
        <>
            <MainLayout>
                <Routes>
                    <Route path="/tasks" element={<DashBoardTicket />} />
                    <Route path="/workplan" element={<DashboardWorkplan />} />
                    <Route path="/SignIn" element={<SignIn />} />

                    <Route path="/" element={<Navigate to='tasks' />} />
                </Routes>
            </MainLayout>
        </>
    )
}
