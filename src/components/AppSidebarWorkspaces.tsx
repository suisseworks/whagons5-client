import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  Plus,
  ChevronDown,
  Briefcase,
  Search,
  MoreHorizontal,
  Layers,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/animate-ui/primitives/radix/collapsible';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuButton,
  useSidebar
} from '@/components/ui/sidebar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ColorPicker, ColorPickerAlpha, ColorPickerFormat, ColorPickerHue, ColorPickerSelection, ColorPickerEyeDropper } from '@/components/ui/shadcn-io/color-picker';
import Color, { ColorLike } from 'color';
import { Workspace } from '@/store/types';
import { genericActions } from '@/store/genericSlices';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const WS_ORDER_STORAGE = 'wh-workspace-order';

const loadWorkspaceOrder = (): string[] => {
  try {
    const raw = localStorage.getItem(WS_ORDER_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((id) => String(id)) : [];
  } catch {
    return [];
  }
};

const saveWorkspaceOrder = (ids: string[]) => {
  try {
    localStorage.setItem(WS_ORDER_STORAGE, JSON.stringify(ids));
  } catch {
    /* ignore quota errors */
  }
};

const mergeOrder = (saved: string[], current: string[]) => {
  const savedFiltered = saved.filter((id) => current.includes(id));
  const missing = current.filter((id) => !savedFiltered.includes(id));
  return [...savedFiltered, ...missing];
};

const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export interface AppSidebarWorkspacesProps {
  workspaces: Workspace[];
  pathname: string;
  getWorkspaceIcon: (iconName?: string) => any;
  showEverythingButton?: boolean;
}

interface SortableWorkspaceItemProps {
  workspace: Workspace;
  pathname: string;
  collapsed: boolean;
  getWorkspaceIcon: (iconName?: string) => any;
}

const WorkspaceIconBadge = ({
  color,
  size = 20,
  children,
}: {
  color?: string;
  size?: number;
  children: ReactNode;
}) => (
  <div
    className="flex items-center justify-center rounded-[6px] flex-shrink-0"
    style={{
      backgroundColor: color || '#3b82f6',
      width: `${size}px`,
      height: `${size}px`,
    }}
  >
    {children}
  </div>
);

function SortableWorkspaceItem({ workspace, pathname, collapsed, getWorkspaceIcon }: SortableWorkspaceItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(workspace.id) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isActive = pathname === `/workspace/${workspace.id}`;
  const buttonClass = collapsed
    ? `flex justify-center items-center ${isActive
        ? 'bg-[var(--sidebar-selected-bg)] text-[var(--sidebar-primary)] border border-[var(--sidebar-ring)]'
        : 'text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
      }`
    : `${isActive
        ? 'bg-[var(--sidebar-selected-bg)] text-[var(--sidebar-primary)]'
        : 'text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
      }`;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, marginBottom: collapsed ? '4px' : '2px' }}
      {...listeners}
      {...attributes}
      className="flex items-center rounded-[8px] relative cursor-grab active:cursor-grabbing w-full"
    >
      <SidebarMenuButton
        asChild
        tooltip={collapsed ? workspace.name : undefined}
        className={`rounded-[8px] relative transition-colors ${buttonClass} ${collapsed ? '!p-[6px]' : ''}`}
        style={{
          height: '32px',
          padding: collapsed ? '6px' : '6px 10px',
          gap: '8px',
          fontWeight: isActive ? 600 : 500,
          fontSize: '13px',
          width: '100%',
        }}
      >
        <Link
          to={`/workspace/${workspace.id}`}
          data-workspace-id={String(workspace.id)}
          onClick={(e) => {
            if (isDragging) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          className={`${collapsed
            ? 'flex justify-center items-center w-full'
            : 'flex items-center'
          } group relative`}
          style={{
            pointerEvents: isDragging ? 'none' : 'auto',
          }}
        >
          <WorkspaceIconBadge color={workspace.color || '#3b82f6'}>
            <FontAwesomeIcon
              icon={getWorkspaceIcon(workspace.icon)}
              style={{
                color: '#ffffff',
                fontSize: '14px',
                width: '14px',
                height: '14px',
                display: 'block'
              }}
            />
          </WorkspaceIconBadge>
          {collapsed ? (
            <span className="sr-only">{workspace.name}</span>
          ) : (
            <span className="truncate ml-1.5">{workspace.name}</span>
          )}
        </Link>
      </SidebarMenuButton>
    </div>
  );
}

export function AppSidebarWorkspaces({ workspaces, pathname, getWorkspaceIcon, showEverythingButton = true }: AppSidebarWorkspacesProps) {
  const dispatch = useDispatch();
  const { isMobile, state } = useSidebar();
  const isCollapsedState = state === 'collapsed';
  const collapsed = isCollapsedState && !isMobile;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [workspaceColor, setWorkspaceColor] = useState('#3b82f6');
  const [workspaceType, setWorkspaceType] = useState('standard');

  const [orderKey, setOrderKey] = useState(0);

  const localWorkspaces = useMemo(() => {
    const normalized = workspaces.map((w) => ({ ...w, id: String(w.id) }));
    const savedOrder = loadWorkspaceOrder();
    const currentIds = normalized.map((w) => w.id as string);
    const mergedIds = mergeOrder(savedOrder, currentIds);

    const byId = new Map(normalized.map((w) => [w.id as string, w]));
    const ordered: Workspace[] = [];
    mergedIds.forEach((id) => {
      const workspace = byId.get(id);
      if (workspace) ordered.push(workspace as unknown as Workspace);
    });
    return ordered;
  }, [workspaces, orderKey]);

  const workspaceIds = useMemo(() => localWorkspaces.map((w) => String(w.id)), [localWorkspaces]);

  useEffect(() => {
    // Avoid wiping saved order before data loads
    if (localWorkspaces.length === 0) return;
    const currentIds = localWorkspaces.map((workspace) => String(workspace.id));
    const saved = loadWorkspaceOrder();
    const merged = mergeOrder(saved, currentIds);

    if (!arraysEqual(merged, saved)) {
      saveWorkspaceOrder(merged);
    }
  }, [localWorkspaces]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = workspaceIds.indexOf(String(active.id));
    const newIndex = workspaceIds.indexOf(String(over.id));

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedWorkspaces = arrayMove(localWorkspaces, oldIndex, newIndex);
      const orderedIds = reorderedWorkspaces.map((w) => String(w.id));
      saveWorkspaceOrder(orderedIds);
      setOrderKey((prev) => prev + 1); // Force re-render to update order
    }
  };







  const handleAddWorkspace = async () => {
    if (!workspaceName.trim()) {
      alert('Please enter a workspace name.');
      return;
    }

    try {
      await dispatch((genericActions.workspaces.addAsync as any)({
        name: workspaceName.trim(),
        description: workspaceDescription.trim() || null,
        color: workspaceColor,
        icon: 'fas fa-folder',
        type: workspaceType
      })).unwrap();

      setWorkspaceName('');
      setWorkspaceDescription('');
      setWorkspaceColor('#3b82f6');
      setWorkspaceType('standard');
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error creating workspace:', error);
      alert('Failed to create workspace. Please try again.');
    }
  };

  // When sidebar is collapsed, always keep workspace section open so icons are visible
  const [collapsibleOpen, setCollapsibleOpen] = useState(true);

  const handleCollapsibleChange = (open: boolean) => {
    // Don't allow closing when sidebar is collapsed - icons need to remain visible
    if (!collapsed) {
      setCollapsibleOpen(open);
    }
  };

  return (
    <Collapsible open={collapsed ? true : collapsibleOpen} onOpenChange={handleCollapsibleChange} className="group/collapsible">
      {/* Everything workspace - aligned above Spaces section */}
      {showEverythingButton && !collapsed && (
        <div style={{ marginBottom: '8px' }}>
          <Link
            to={`/workspace/all`}
            className={`group flex items-center relative overflow-hidden transition-colors rounded-[8px] ${pathname === `/workspace/all`
                ? 'bg-[var(--sidebar-selected-bg)] text-[var(--sidebar-primary)] border border-[var(--sidebar-ring)]'
                : 'text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
            }`}
            style={{
              height: '36px',
              padding: '8px 12px',
              gap: '10px',
              boxShadow: pathname === `/workspace/all` ? '0 1px 3px rgba(0, 191, 165, 0.1)' : 'none',
              fontWeight: pathname === `/workspace/all` ? 600 : 500,
              fontSize: '15px'
            }}
          >
            <span className="flex items-center justify-center flex-shrink-0">
              <WorkspaceIconBadge color="var(--sidebar-primary)">
                <Layers className="w-[14px] h-[14px]" style={{ color: '#ffffff' }} />
              </WorkspaceIconBadge>
            </span>
            <span>Everything</span>
          </Link>
        </div>
      )}

      {showEverythingButton && collapsed && !isMobile && (
        <div className="px-2 flex justify-center" style={{ marginBottom: '8px' }}>
          <Link
            to={`/workspace/all`}
            className={`flex items-center justify-center rounded-[8px] transition-colors ${pathname === `/workspace/all`
                ? 'bg-[var(--sidebar-selected-bg)] text-[var(--sidebar-primary)] border border-[var(--sidebar-ring)]'
                : 'text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
            }`}
            style={{
              width: '32px',
              height: '32px',
              opacity: pathname === `/workspace/all` ? 1 : 0.7
            }}
            title={'Everything'}
          >
            <WorkspaceIconBadge color="var(--sidebar-primary)">
              <Layers className="w-[14px] h-[14px]" style={{ color: '#ffffff' }} />
            </WorkspaceIconBadge>
            <span className="sr-only">Everything</span>
          </Link>
        </div>
      )}

      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <div
            className={`flex items-center w-full ${collapsed ? 'justify-center px-0' : 'justify-between'
              }`}
            style={{ 
              borderTop: collapsed ? 'none' : `1px solid var(--sidebar-border)`,
              paddingTop: collapsed ? '0' : '8px',
              marginTop: collapsed ? '0' : '0px',
              marginBottom: '8px'
            }}
          >
            <>
              {collapsed ? (
                <CollapsibleTrigger
                  className="flex flex-col justify-center px-2 cursor-pointer hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] rounded-sm"
                  style={{ padding: '8px', color: 'var(--sidebar-text-primary)' }}
                >
                  <Briefcase className="w-5 h-5 mb-1" style={{ color: 'var(--sidebar-text-primary)', opacity: 1 }} />
                </CollapsibleTrigger>
              ) : (
                <>
                  <CollapsibleTrigger
                    className="flex items-center cursor-pointer hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] rounded-sm justify-start flex-1"
                    style={{
                      padding: '4px 8px 4px 0',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--sidebar-text-primary)'
                    }}
                  >
                    <ChevronDown className="ease-out group-data-[state=open]/collapsible:rotate-180 w-4 h-4" style={{ color: 'var(--sidebar-text-primary)', opacity: 1 }} />
                    <span className="pl-2" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sidebar-text-primary)' }}>
                      Spaces
                    </span>
                  </CollapsibleTrigger>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-transparent"
                      title="More options"
                      type="button"
                      style={{ width: '20px', height: '20px', padding: 0 }}
                    >
                      <MoreHorizontal size={16} style={{ color: 'var(--sidebar-text-primary)' }} />
                      <span className="sr-only">More options</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-transparent"
                      title="Search"
                      type="button"
                      style={{ width: '20px', height: '20px', padding: 0 }}
                    >
                      <Search size={16} style={{ color: 'var(--sidebar-text-primary)' }} />
                      <span className="sr-only">Search</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-transparent"
                      title="Add Workspace"
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      style={{ width: '20px', height: '20px', padding: 0 }}
                    >
                      <Plus size={16} style={{ color: 'var(--sidebar-text-primary)' }} />
                      <span className="sr-only">Add Workspace</span>
                    </Button>
                  </div>
                </>
              )}
              
              {(!isCollapsedState || isMobile) && (
                <Dialog open={isModalOpen} onOpenChange={(open) => {
                  setIsModalOpen(open);
                  if (!open) {
                    setWorkspaceName('');
                    setWorkspaceDescription('');
                    setWorkspaceColor('#3b82f6');
                    setWorkspaceType('standard');
                  }
                }}>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Add New Workspace</DialogTitle>
                      <DialogDescription>
                        Enter the details for your new workspace. Click save when you're done.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="workspace-name" className="text-right">
                          Name
                        </Label>
                        <Input
                          id="workspace-name"
                          value={workspaceName}
                          onChange={(e) => setWorkspaceName(e.target.value)}
                          className="col-span-3"
                          placeholder="e.g., Project Phoenix"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="workspace-description" className="text-right">
                          Description
                        </Label>
                        <Input
                          id="workspace-description"
                          value={workspaceDescription}
                          onChange={(e) => setWorkspaceDescription(e.target.value)}
                          className="col-span-3"
                          placeholder="e.g., For managing project tasks"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="workspace-color" className="text-right">
                          Color
                        </Label>
                        <div className="col-span-3">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                id="workspace-color"
                                type="button"
                                className="h-9 w-16 rounded-md border border-input shadow-sm ring-offset-background transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                style={{ backgroundColor: workspaceColor }}
                                aria-label="Open color picker"
                              />
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-72 pointer-events-auto select-text"
                              align="start"
                              side="top"
                              sideOffset={8}
                              avoidCollisions={false}
                              onOpenAutoFocus={(e) => e.preventDefault()}
                            >
                              <ColorPicker
                                className="max-w-xs rounded-md p-2"
                                defaultValue={workspaceColor || "#3b82f6"}
                                onChange={(color: ColorLike) => {
                                  const colorInstance = new Color(color);
                                  const hex = colorInstance.hex();
                                  setWorkspaceColor(hex);
                                }}
                              >
                                <div className="aspect-square w-full rounded-md border">
                                  <ColorPickerSelection className="h-full w-full" />
                                </div>
                                <div className="flex items-center gap-3">
                                  <ColorPickerEyeDropper />
                                  <div className="grid w-full gap-1">
                                    <ColorPickerHue />
                                    <ColorPickerAlpha />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <ColorPickerFormat />
                                </div>
                              </ColorPicker>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="workspace-type" className="text-right">
                          Type
                        </Label>
                        <div className="col-span-3">
                          <Select value={workspaceType} onValueChange={setWorkspaceType}>
                            <SelectTrigger id="workspace-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">Standard</SelectItem>
                              <SelectItem value="project">Project</SelectItem>
                              <SelectItem value="department">Department</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="button" onClick={handleAddWorkspace}>
                        Save Workspace
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </>
          </div>
        </SidebarGroupLabel>

        <CollapsibleContent keepRendered>
          <SidebarGroupContent className={collapsed ? 'pt-1' : 'pt-1'}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={workspaceIds}
                strategy={verticalListSortingStrategy}
              >
        <div className={collapsed ? 'flex flex-col items-center space-y-1 py-0.5' : 'space-y-0.5'}>
                  {localWorkspaces.map((workspace) => (
                    <SortableWorkspaceItem
                      key={workspace.id}
                      workspace={workspace}
                      pathname={pathname}
                      collapsed={collapsed}
                      getWorkspaceIcon={getWorkspaceIcon}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export default AppSidebarWorkspaces;
