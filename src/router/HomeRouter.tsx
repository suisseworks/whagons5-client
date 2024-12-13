import { Navigate, Route, Routes } from 'react-router'

import { DashBoardTicket } from '../features/tasks'

export const HomeRoutes = () => {
    return (
        <>
            <Routes>
                <Route path="/tasks" element={<DashBoardTicket />} />

                <Route path="/" element={<Navigate to='tasks' />} />
            </Routes>
        </>
    )
}
