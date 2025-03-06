import { Navigate, Route, Routes } from 'react-router';

import { DashBoardTicket } from '../features/tasks';
import { DashboardWorkplan } from '../features/workplan';
import MainLayout from '../layouts/MainLayout';
import { useParams } from 'react-router';
import Dashboard from '../components/Dashboard';
import Stripe from '../pages/Stripe';
import AIChat from '@/features/aichat/pages/AIChat';
import ChatWindow from '@/features/aichat/pages/ChatWindow';


export const HomeRoutes = () => {
  const { uuid } = useParams<{ uuid: string }>();

  return (
    <>
      <MainLayout>
        <Routes>
          <Route path="/tasks" element={<DashBoardTicket />} />
          <Route path="/workplan" element={<DashboardWorkplan />} />
          <Route path="/stripe" element={<Stripe />} />
          <Route path="/ai-chat" element={<ChatWindow
          />} />

          <Route path="/" element={<Navigate to="tasks" />} />
          <Route path="/dashboard/:uuid" element={<Dashboard />} />
        </Routes>
      </MainLayout>
    </>
  );
};
