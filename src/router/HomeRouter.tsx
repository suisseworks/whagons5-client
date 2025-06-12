import { Navigate, Route, Routes, useLocation } from 'react-router';

import { DashBoardTask } from '../features/tasks';
import { DashboardWorkplan } from '../features/workplan';
import MainLayout from '../layouts/MainLayout';
import Stripe from '../pages/Stripe';
import ChatWindow from '../features/aichat/pages/ChatWindow';
import Profile from '@/pages/Profile';
import { useMemo } from 'react';

const pages = [
  { path: '/tasks', component: <DashBoardTask /> },
  { path: '/workplan', component: <DashboardWorkplan /> },
  { path: '/stripe', component: <Stripe /> },
  { path: '/ai-chat', component: <ChatWindow /> },
  { path: '/profile', component: <Profile /> },
];

function AllPages() {
  const location = useLocation();

  const renderedPages = useMemo(() => pages.map(({ path, component }) => (
    <div key={path} style={{ display: location.pathname.startsWith(path) ? 'block' : 'none', height: '100%' }}>
      {component}
    </div>
  )), [location.pathname]);

  return <>{renderedPages}</>;
}

export const HomeRoutes = () => {

  return (
    <>
      <MainLayout>
        <AllPages />
        <Routes>
          <Route path="/" element={<Navigate to="/tasks" replace />} />
        </Routes>
      </MainLayout>
    </>
  );
};
