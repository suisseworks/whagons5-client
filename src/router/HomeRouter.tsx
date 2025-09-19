import { Navigate, Route, Routes, useLocation, matchPath } from 'react-router';

import { Workspace } from '@/pages/spaces/Workspace';
import MainLayout from '@/layouts/MainLayout';
import Stripe from '@/pages/stripe/Stripe';
// import ChatWindow from '@/pages/aichat/ChatWindow';
import Profile from '@/pages/profile/Profile';
import { useMemo } from 'react';
import Settings from '@/pages/settings/Settings';
import Stuff from '@/pages/stuff/Stuff';
import Categories from '@/pages/settings/sub_pages/Categories';
import CustomFieldsTab from '@/pages/settings/sub_pages/CustomFieldsTab';
import Templates from '@/pages/settings/sub_pages/Templates';
import Teams from '@/pages/settings/sub_pages/Teams';
import Spots from '@/pages/settings/sub_pages/Spots';
import SpotTypes from '@/pages/settings/sub_pages/SpotTypes';
import Users from '@/pages/settings/sub_pages/Users';
import Statuses from '@/pages/settings/sub_pages/Statuses';
import Priorities from '@/pages/settings/sub_pages/Priorities';
import Slas from '@/pages/settings/sub_pages/Slas';
import Analytics from '@/pages/analytics/Analytics';
import Home from '@/pages/home/Home';
import Messages from '@/pages/messages/Messages';

const pages = [
  { path: '/workspace/:id', component: <Workspace /> },
];

function AllPages() {
  const location = useLocation();

  const renderedPages = useMemo(() => pages.map(({ path, component }) => {
    const isVisible = !!matchPath({ path, end: false }, location.pathname);
    return (
      <div key={path} style={{ display: isVisible ? 'block' : 'none', height: '100%' }}>
        {component}
      </div>
    );
  }), [location.pathname]);

  return <>{renderedPages}</>;
}

export const HomeRoutes = () => {

  return (
    <>
      <MainLayout>
        <AllPages />
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/tasks" element={<Workspace />} />
          {/* <Route path="/workspace/:id" element={<Workspace />} />
          <Route path="/workspace/all" element={<Workspace />} /> */}
          <Route path="/profile" element={<Profile />} />
          <Route path="/stripe" element={<Stripe />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/stuff" element={<Stuff />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/settings/categories" element={<Categories />} />
          <Route path="/settings/categories/custom-fields" element={<CustomFieldsTab />} />
          <Route path="/settings/templates" element={<Templates />} />
          <Route path="/settings/teams" element={<Teams />} />
          <Route path="/settings/spots" element={<Spots />} />
          <Route path="/settings/spots/types" element={<SpotTypes />} />
          <Route path="/settings/users" element={<Users />} /> 
          <Route path="/settings/statuses" element={<Statuses />} />
          <Route path="/settings/priorities" element={<Priorities />} />
          <Route path="/settings/slas" element={<Slas />} />
        </Routes>
      </MainLayout>
    </>
  );
};
