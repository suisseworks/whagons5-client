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
  Home,
  LayoutDashboard,
  Settings,
  User,
  Users,
  Plus,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { AppDispatch, RootState } from '@/store';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const pathname = location.pathname;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');

  const dispatch = useDispatch<AppDispatch>();
  const { value: workspaces } = useSelector(
    (state: RootState) => state.workspaces
  );
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

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 p-3">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-white">
            W
          </div>
          {state === 'expanded' && (
            <span className="font-semibold">Whagons</span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {/* Workspaces Group */}
          <SidebarGroupLabel className="text-sm font-normal flex justify-between items-center pr-4">
            <span>Workspaces</span>
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Plus size={16} />
                  <span className="sr-only">Add Workspace</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add New Workspace</DialogTitle>
                  <DialogDescription>
                    Enter the details for your new workspace. Click save when
                    you're done.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name
                    </Label>
                    <Input
                      id="name"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      className="col-span-3"
                      placeholder="e.g., Project Phoenix"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">
                      Description
                    </Label>
                    <Input
                      id="description"
                      value={workspaceDescription}
                      onChange={(e) => setWorkspaceDescription(e.target.value)}
                      className="col-span-3"
                      placeholder="e.g., For managing project tasks"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" onClick={handleAddWorkspace}>
                    Save Workspace
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="font-sm text-gray-700">
              {workspaces.map((workspace: Workspace) => (
                <SidebarMenuItem key={workspace.id} className="pt-1 pb-1">
                  <SidebarMenuButton
                    asChild
                    tooltip={workspace.name}
                    isActive={pathname === workspace.path}
                    className="h-10"
                  >
                    <Link to={workspace.path}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="icon icon-tabler icons-tabler-outline icon-tabler-brand-pnpm"
                      >
                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                        <path d="M3 17h4v4h-4z" />
                        <path d="M10 17h4v4h-4z" />
                        <path d="M17 17h4v4h-4z" />
                        <path d="M17 10h4v4h-4z" />
                        <path d="M17 3h4v4h-4z" />
                        <path d="M10 10h4v4h-4z" />
                        <path d="M10 3h4v4h-4z" />
                        <path d="M3 3h4v4h-4z" />
                      </svg>
                      <span>{workspace.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-normal">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="text-gray-700">
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
                  tooltip="Profile"
                  isActive={pathname === '/profile'}
                  className="h-10"
                >
                  <Link to="/profile">
                    <User size={20} className="w-5! h-5!" />
                    <span>Profile</span>
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
