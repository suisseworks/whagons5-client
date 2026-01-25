import { Navigate, Route, Routes, useLocation, matchPath } from 'react-router';

import { Workspace } from '@/pages/spaces/Workspace';
import MainLayout from '@/layouts/MainLayout';
import Stripe from '@/pages/stripe/Stripe';
// import ChatWindow from '@/pages/aichat/ChatWindow';
import Profile from '@/pages/profile/Profile';
import { useMemo } from 'react';
import Settings from '@/pages/settings/Settings';
import Stuff from '@/pages/stuff/Stuff';
import Categories from '@/pages/settings/sub_pages/categories/Categories';
import CustomFieldsTab from '@/pages/settings/sub_pages/custom-fields/CustomFieldsTab';
import Templates from '@/pages/settings/sub_pages/templates/Templates';
import Forms from '@/pages/settings/sub_pages/forms';
import Teams from '@/pages/settings/sub_pages/teams/Teams';
import Workspaces from '@/pages/settings/sub_pages/workspaces/Workspaces';
import Spots from '@/pages/settings/sub_pages/spots/Spots';
import SpotTypes from '@/pages/settings/sub_pages/spot-types/SpotTypes';
import Users from '@/pages/settings/sub_pages/users/Users';
import JobPositions from '@/pages/settings/sub_pages/job-positions/JobPositions';
import RolesAndPermissions from '@/pages/settings/sub_pages/roles-and-permissions/RolesAndPermissions';
import Statuses from '@/pages/settings/sub_pages/statuses/Statuses';
import Priorities from '@/pages/settings/sub_pages/priorities/Priorities';
import Tags from '@/pages/settings/sub_pages/tags/Tags';
import Slas from '@/pages/settings/sub_pages/slas/Slas';
import Workflows from '@/pages/settings/sub_pages/workflows/Workflows';
import Approvals from '@/pages/settings/sub_pages/approvals/Approvals';
import Global from '@/pages/settings/sub_pages/global/Global';
import BoardsSettings from '@/pages/settings/sub_pages/boards/Boards';
import KpiCardsSettings from '@/pages/settings/sub_pages/kpi-cards-settings/KpiCardsSettings';
import KpiCardsManage from '@/pages/settings/sub_pages/kpi-cards-manage/KpiCardsManage';
import GamificationSettings from '@/pages/settings/sub_pages/gamification/GamificationSettings';
import GamificationComingSoon from '@/pages/gamification/GamificationComingSoon';
import AnalyticsSettings from '@/pages/settings/sub_pages/analytics/AnalyticsSettings';
import AnalyticsComingSoon from '@/pages/analytics/AnalyticsComingSoon';
import MotivationSettings from '@/pages/settings/sub_pages/motivation/MotivationSettings';
import MotivationComingSoon from '@/pages/motivation/MotivationComingSoon';
import Boards from '@/pages/boards/Boards';
import Home from '@/pages/home/Home';
// Messages removed
// Boards list page
import BoardDetail from '@/pages/boards/BoardDetail';
import TestPage from '@/pages/Testpage';
import Plugins from '@/pages/Plugins';
import PluginSettings from '@/pages/PluginSettings';
import PluginManagement from '@/pages/admin/PluginManagement';
import Integrations from '@/pages/Integrations';
import { ComplianceStandards } from '@/pages/compliance/ComplianceStandards';
import { ComplianceStandardDetail } from '@/pages/compliance/ComplianceStandardDetail';
import SharedWithMe from '@/pages/shared/SharedWithMe';
import BroadcastsPage from '@/pages/broadcasts/BroadcastsPage';
import ActivityMonitor from '@/pages/activity/ActivityMonitor';


const pages = [
  { path: '/workspace/:id', component: <Workspace /> },
];

function AllPages() {
  const location = useLocation();

  const renderedPages = useMemo(() => pages.map(({ path, component }) => {
    const isVisible = !!matchPath({ path, end: false }, location.pathname);
    // Only render the component when visible to avoid hook violations
    if (!isVisible) return null;
    return (
      <div key={path} style={{ height: '100%' }}>
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
          <Route path="/" element={<Navigate to="/welcome" replace />} />
          <Route path="/welcome" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/tasks" element={<Workspace />} />
          <Route path="/shared-with-me" element={<SharedWithMe />} />
          {/* <Route path="/workspace/:id" element={<Workspace />} />
          <Route path="/workspace/all" element={<Workspace />} /> */}
          <Route path="/profile" element={<Profile />} />
          <Route path="/stripe" element={<Stripe />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/stuff" element={<Stuff />} />
          <Route path="/plugins" element={<Plugins />} />
          <Route path="/plugins/:pluginId/settings" element={<PluginSettings />} />
          <Route path="/admin/plugins" element={<PluginManagement />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/boards" element={<Boards />} />
          <Route path="/boards/:boardId" element={<BoardDetail />} />
          <Route path="/broadcasts" element={<BroadcastsPage />} />
          <Route path="/activity" element={<ActivityMonitor />} />
          <Route path="/gamification" element={<GamificationComingSoon />} />
          <Route path="/analytics" element={<AnalyticsComingSoon />} />
          <Route path="/motivation" element={<MotivationComingSoon />} />
          <Route path="/settings/categories" element={<Categories />} />
          <Route path="/settings/categories/custom-fields" element={<CustomFieldsTab />} />
          <Route path="/settings/templates" element={<Templates />} />
          <Route path="/settings/forms" element={<Forms />} />
          <Route path="/settings/workspaces" element={<Workspaces />} />
          <Route path="/settings/teams" element={<Teams />} />
          <Route path="/settings/spots" element={<Spots />} />
          <Route path="/settings/spots/types" element={<SpotTypes />} />
          <Route path="/settings/job-positions" element={<JobPositions />} />
          <Route path="/settings/users" element={<Users />} /> 
          <Route path="/settings/roles-and-permissions" element={<RolesAndPermissions />} />
          <Route path="/settings/statuses" element={<Statuses />} />
          <Route path="/settings/priorities" element={<Priorities />} />
          <Route path="/settings/tags" element={<Tags />} />
          <Route path="/settings/slas" element={<Slas />} />
          <Route path="/settings/workflows" element={<Workflows />} />
          <Route path="/settings/approvals" element={<Approvals />} />
          <Route path="/settings/global" element={<Global />} />
          <Route path="/settings/boards" element={<BoardsSettings />} />
          <Route path="/settings/kpi-cards" element={<KpiCardsSettings />} />
          <Route path="/settings/kpi-cards/manage" element={<KpiCardsManage />} />
          <Route path="/settings/gamification" element={<GamificationSettings />} />
          <Route path="/settings/analytics" element={<AnalyticsSettings />} />
          <Route path="/settings/motivation" element={<MotivationSettings />} />
          <Route path="/settings/test" element={<TestPage />} />
          
          {/* Compliance Routes */}
          <Route path="/compliance/standards" element={<ComplianceStandards />} />
          <Route path="/compliance/standards/:id" element={<ComplianceStandardDetail />} />
        </Routes>
      </MainLayout>
    </>
  );
};
