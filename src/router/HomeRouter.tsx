import { Navigate, Route, Routes, useLocation } from 'react-router';

import { Workspace } from '@/pages/spaces/Workspace';
import MainLayout from '@/layouts/MainLayout';
import Stripe from '@/pages/stripe/Stripe';
// import ChatWindow from '@/pages/aichat/ChatWindow';
import Profile from '@/pages/profile/Profile';
import { useMemo } from 'react';
import Settings from '@/pages/settings/Settings';

const pages = [
  // { path: '/tasks', component: <Workspace /> },
  { path: '/stripe', component: <Stripe /> },
  // { path: '/ai-chat', component: <ChatWindow /> },
  { path: '/profile', component: <Profile /> },
  // { path: '/settings', component: <Settings /> },
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
          {/* <Route path="/" element={<Navigate to="/tasks" replace />} /> */}
          <Route path="/tasks" element={<Workspace />} />
          <Route path="/workspace/:id" element={<Workspace />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MainLayout>
    </>
  );
};
