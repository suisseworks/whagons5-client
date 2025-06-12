import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Workspace, workspacesSlice } from '@/store/reducers/workspacesSlice';
import {
  Settings,
  User,
  Users,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { AppDispatch, RootState } from '@/store';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import WhagonsTitle from '@/assets/WhagonsTitle';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import WhagonsCheck from '@/assets/WhagonsCheck';

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const pathname = location.pathname;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');

  const dispatch = useDispatch<AppDispatch>();
  const { value: workspaces } = useSelector((state: RootState) => state.workspaces);
  const { addWorkspace } = workspacesSlice.actions;

  const handleAddWorkspace = () => {
    if (!workspaceName.trim() || !workspaceDescription.trim()) {
      // Basic validation: Ensure fields are not empty
      // You might want to add more robust validation/feedback
      alert('Please enter both name and description.');
      return;
    }

    const newId = crypto.randomUUID();
    const newWorkspace: Workspace = {
      id: newId,
      name: workspaceName,
      // Use a path structure like /workspace/:id for routing
      path: `/workspace/${newId}`,
      description: workspaceDescription,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    dispatch(addWorkspace(newWorkspace));

    // Reset form and close modal
    setWorkspaceName('');
    setWorkspaceDescription('');
    setIsModalOpen(false);
  };

  useEffect(() => {
    console.log(workspaces);
  }, [workspaces]);

  return (
    <Sidebar>
      <SidebarHeader>
        <div
          className='flex justify-center items-center pt-3 pr-3'
        >
          <WhagonsCheck width={45} height={21} color="#27C1A7" />
          <div className='text-xl pl-2 font-semibold text-[#27C1A7]' style={{ fontFamily: 'Montserrat' }}>
            Whagons
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild className='text-sm font-normal'>
                <div className="flex items-center justify-between w-full pr-4 cursor-pointer select-none">
                  <button
                    type="button"
                    className="flex items-center justify-between flex-1  bg-transparent border-0 outline-none focus:ring-0 cursor-pointer p-0 pr-1"
                    onClick={e => {
                      // Only trigger CollapsibleTrigger if not clicking the plus
                      const plus = e.currentTarget.parentElement?.querySelector('.plus-btn');
                      if (plus && plus.contains(e.target as Node)) return;
                      // Find and click the CollapsibleTrigger
                      const trigger = e.currentTarget.parentElement?.querySelector('.collapsible-trigger');
                      if (trigger) (trigger as HTMLElement).click();
                    }}
                  >
                    Workspaces
                    <CollapsibleTrigger asChild>
                      <span className="collapsible-trigger flex items-center ml-1 p-0 bg-transparent border-0 outline-none focus:ring-0">
                        <ChevronDown className="transition-transform duration-200 ease-out group-data-[state=open]/collapsible:rotate-180 w-4 h-4" />
                      </span>
                    </CollapsibleTrigger>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 p-0 plus-btn"
                    onClick={() => setIsModalOpen(true)}
                  >
                    <Plus size={16} />
                    <span className="sr-only">Add Workspace</span>
                  </Button>
                </div>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  {workspaces.map((workspace) => (
                    <Link
                      key={workspace.id}
                      to={workspace.path}
                      className="block px-4 py-2 rounded hover:bg-sidebar-accent"
                    >
                      {workspace.name}
                    </Link>
                  ))}
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
          <SidebarGroupContent>
            {/* Other content can go here if needed */}
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-normal">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem className="pt-1 pb-1">
                <SidebarMenuButton
                  asChild
                  tooltip="Users"
                  isActive={pathname === '/users'}
                  className="h-10"
                >
                  <Link to="/users">
                    <Users size={20} className="w-5! h-5!" />
                    <span>Users</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem className="pt-1 pb-1">
                <SidebarMenuButton
                  asChild
                  tooltip="Settings"
                  isActive={pathname === '/settings'}
                  className="h-10"
                >
                  <Link to="/settings">
                    <Settings size={20} className="w-5! h-5!" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-1 text-xs text-sidebar-foreground/70">
          Version 5.0.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
