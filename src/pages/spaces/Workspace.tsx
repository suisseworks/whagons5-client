import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { UrlTabs } from '@/components/ui/url-tabs';
import { ClipboardList, Settings, Plus } from 'lucide-react';
import WorkspaceTable from '@/pages/spaces/components/WorkspaceTable';
import SettingsComponent from '@/pages/spaces/components/Settings';
import { Input } from '@/components/ui/input';
import CreateTaskDialog from '@/pages/spaces/components/CreateTaskDialog';
import { AnimatePresence, motion, useAnimation } from 'motion/react';

export const Workspace = () => {
  const location = useLocation();

  // Extract workspace ID from the current path
  const getWorkspaceIdFromPath = (pathname: string): string | undefined => {
    const match = pathname.match(/\/workspace\/([^/?]+)/);
    return match ? match[1] : undefined;
  };

  const id = getWorkspaceIdFromPath(location.pathname);
  // State to store the fetched data
  const [activeTab, setActiveTab] = useState('grid');

  const rowCache = useRef(new Map<string, { rows: any[]; rowCount: number }>());
  const [searchText, setSearchText] = useState('');
  const [openCreateTask, setOpenCreateTask] = useState(false);


  const gridControls = useAnimation();


  // Handle grid animation based on current tab
  useEffect(() => {
    if (activeTab === 'grid') {
      gridControls.start({ x: 0 });
    } else {
      gridControls.start({
        x: "-80vw",
        transition: {
          type: "spring",
          stiffness: 100,
          damping: 10
        }
      });
    }
  }, [activeTab, gridControls]);

  //

  // Clear cache when workspace ID changes
  useEffect(() => {
    if (id) {
      console.log(`Switching to workspace ${id}, clearing cache`);
      rowCache.current.clear();
    }
    if (activeTab === 'grid') {
      gridControls.start({
        opacity: 0.3,
        transition: { duration: 0.2, repeat: 1, repeatType: "reverse", ease: "easeInOut" }
      });
    }
  }, [id, location.pathname]);

  // Debug logging
  console.log('Workspace component - id:', id, 'typeof:', typeof id);
  console.log('Current path:', location.pathname);

  // Check if this is the "all" workspace route
  const isAllWorkspaces = location.pathname === '/workspace/all' || id === 'all';

  // Handle invalid workspace ID - simplified validation
  if (!id && !isAllWorkspaces) {
    console.log('No workspace ID provided and not all workspaces route');
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600">Invalid Workspace ID</h2>
          <p className="text-gray-600 mt-2">ID: "{id}" - Please check the URL and try again.</p>
        </div>
      </div>
    );
  }

  // Additional validation for numeric IDs (but allow 'all' or all workspaces route)
  if (!isAllWorkspaces && isNaN(Number(id))) {
    console.log('Invalid workspace ID detected:', id);
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600">Invalid Workspace ID</h2>
          <p className="text-gray-600 mt-2">ID: "{id}" must be a number or "all" - Please check the URL and try again.</p>
        </div>
      </div>
    );
  }


  // Define tabs for URL persistence
  const workspaceTabs = [
    {
      value: 'grid',
      label: (
        <div className="flex items-center gap-2">
          <ClipboardList />
          Tasks
        </div>
      ),
      content: (
        <motion.div
          className='flex-1 h-full'
          animate={gridControls}
        >
          <WorkspaceTable rowCache={rowCache} workspaceId={isAllWorkspaces ? 'all' : (id || '')} searchText={searchText} />
        </motion.div>
      )
    },
    {
      value: 'list',
      label: (
        <div className="flex items-center gap-2">
          <Settings />
          Settings
        </div>
      ),
      content: (
        <motion.div
          exit={{ x: "-80vw" }}
          initial={{ x: "80vw" }}
          animate={{ x: 0 }}
        >
          <SettingsComponent workspaceId={id} />
        </motion.div>
      )
    }
  ];

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center gap-6 mb-4">
        <Input
          placeholder="Search tasks..."
          className="max-w-sm h-12"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      <div className='flex h-full'>
        <UrlTabs
          tabs={workspaceTabs}
          defaultValue="grid"
          basePath={`/workspace/${id}`}
          pathMap={{ grid: '', list: '/settings' }}
          className="w-full h-full flex flex-col"
          onValueChange={setActiveTab}
        />
      </div>

      {/* Floating Action Button for mobile (bottom-right) */}
      {!isAllWorkspaces && !isNaN(Number(id)) && (
        <>
          <button
            className="fixed right-5 bottom-20 sm:hidden inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg"
            onClick={() => setOpenCreateTask(true)}
            aria-label="Create Task"
          >
            <Plus className="h-6 w-6" />
          </button>
          <CreateTaskDialog open={openCreateTask} onOpenChange={setOpenCreateTask} workspaceId={parseInt(id!, 10)} />
        </>
      )}
    </div>


  );
};
