import { Navigate, Route, Routes } from 'react-router';

import { DashBoardTask } from '../features/tasks';
import { DashboardWorkplan } from '../features/workplan';
import MainLayout from '../layouts/MainLayout';
import { useParams } from 'react-router';
import Stripe from '../pages/Stripe';
import ChatWindow from '../features/aichat/pages/ChatWindow';



export const HomeRoutes = () => {

  return (
    <>
      <MainLayout>
        <Routes>
          <Route path="/tasks" element={<DashBoardTask />} />
          <Route path="/workplan" element={<DashboardWorkplan />} />
          <Route path="/stripe" element={<Stripe />} />
          <Route path="/ai-chat" element={<ChatWindow/>} />

          <Route path="/" element={<Navigate to="tasks" />} />
        </Routes>
      </MainLayout>
    </>
  );
};
