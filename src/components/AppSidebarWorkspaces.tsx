import { useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
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
  Inbox,
} from 'lucide-react';
import { TasksCache } from '@/store/indexedDB/TasksCache';

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
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLanguage } from '@/providers/LanguageProvider';

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
  taskCount?: number;
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
    className="grid place-items-center rounded-[6px] flex-shrink-0"
    style={{
      backgroundColor: color || '#3b82f6',
      width: `${size}px`,
      height: `${size}px`,
      position: 'relative',
    }}
  >
    {children}
  </div>
);

// Reusable workspace link component
const WorkspaceLink = ({ 
  to, 
  icon: Icon, 
  label, 
  pathname, 
  collapsed 
}: { 
  to: string; 
  icon: any; 
  label: string; 
  pathname: string; 
  collapsed: boolean;
}) => {
  const isActive = pathname === to;
  const baseClasses = "flex items-center transition-colors rounded-[8px]";
  const activeClasses = isActive 
    ? "bg-[var(--sidebar-selected-bg)] text-[var(--sidebar-primary)]" 
    : "text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]";
  
  if (collapsed) {
    return (
      <Link
        to={to}
        className={`${baseClasses} ${activeClasses} justify-center`}
        style={{ width: '32px', height: '32px' }}
        title={label}
      >
        <WorkspaceIconBadge color="var(--sidebar-primary)">
          <Icon className="w-[14px] h-[14px]" style={{ color: '#ffffff' }} />
        </WorkspaceIconBadge>
        <span className="sr-only">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      to={to}
      className={`${baseClasses} ${activeClasses} relative overflow-hidden`}
      style={{
        height: '36px',
        padding: '8px 12px',
        gap: '10px',
        fontWeight: isActive ? 600 : 500,
        fontSize: '15px'
      }}
    >
      <WorkspaceIconBadge color="var(--sidebar-primary)">
        <Icon className="w-[14px] h-[14px]" style={{ color: '#ffffff' }} />
      </WorkspaceIconBadge>
      <span>{label}</span>
    </Link>
  );
};

function SortableWorkspaceItem({ workspace, pathname, collapsed, getWorkspaceIcon, taskCount }: SortableWorkspaceItemProps) {
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
    // Hide the original item while dragging; DragOverlay renders the preview
    opacity: isDragging ? 0 : 1,
    zIndex: 'auto',
  };

  const isActive = pathname === `/workspace/${workspace.id}`;
  const buttonClass = collapsed
    ? `flex justify-center items-center ${isActive
        ? 'text-[var(--sidebar-primary)]'
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
            ? 'grid place-items-center w-8 h-8 p-0'
            : 'flex items-center justify-between'
          } group relative`}
          style={{
            pointerEvents: isDragging ? 'none' : 'auto',
          }}
        >
          {isActive && (
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 bg-[var(--sidebar-primary)] rounded-full"
              style={{ width: '2px', height: collapsed ? '80%' : '85%' }}
            />
          )}
          <div className="flex items-center min-w-0 flex-1">
            <WorkspaceIconBadge color={workspace.color || '#3b82f6'}>
              <FontAwesomeIcon
                icon={getWorkspaceIcon(workspace.icon)}
                style={{
                  color: '#ffffff',
                  fontSize: '14px',
                  width: '14px',
                  height: '14px',
                  display: 'block',
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%,-50%)'
                }}
              />
            </WorkspaceIconBadge>
            {collapsed ? (
              <span className="sr-only">{workspace.name}</span>
            ) : (
              <>
                <span className="truncate ml-1.5">{workspace.name}</span>
                {taskCount !== undefined && taskCount > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--sidebar-accent)] text-[var(--sidebar-text-secondary)] min-w-[18px] text-center flex-shrink-0">
                    {taskCount > 99 ? '99+' : taskCount}
                  </span>
                )}
              </>
            )}
          </div>
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
  const { t } = useLanguage();
  
  // Track task counts for each workspace
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  
  // Load task counts for all workspaces
  useEffect(() => {
    let cancelled = false;
    const loadTaskCounts = async () => {
      if (!TasksCache.initialized) {
        try {
          await TasksCache.init();
        } catch {
          return;
        }
      }
      
      // Map workspaces to promises for parallel execution
      const promises = workspaces.map(async (workspace) => {
        try {
          const result = await TasksCache.queryTasks({ 
            workspace_id: Number(workspace.id), 
            startRow: 0, 
            endRow: 0 
          });
          return { id: String(workspace.id), count: result?.rowCount || 0 };
        } catch {
          // Handle per-workspace failures by mapping to 0 counts
          return { id: String(workspace.id), count: 0 };
        }
      });
      
      // Wait for all promises in parallel
      const results = await Promise.all(promises);
      
      // Build counts object from results
      const counts: Record<string, number> = {};
      results.forEach(({ id, count }) => {
        counts[id] = count;
      });
      
      // Only call setTaskCounts if not cancelled
      if (!cancelled) {
        setTaskCounts(counts);
      }
    };
    
    loadTaskCounts();
    return () => { cancelled = true; };
  }, [workspaces]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [workspaceColor, setWorkspaceColor] = useState('#3b82f6');
  const [workspaceType, setWorkspaceType] = useState('standard');

  const [orderKey, setOrderKey] = useState(0);
  // Keep previous workspaces to prevent disappearing during transitions
  const stableWorkspacesRef = useRef<Workspace[]>([]);

  const localWorkspaces = useMemo(() => {
    // If workspaces prop is empty but we have stable workspaces, use stable workspaces
    // This prevents workspaces from disappearing during animation transitions
    const sourceWorkspaces = workspaces.length > 0 ? workspaces : stableWorkspacesRef.current;
    
    const normalized = sourceWorkspaces.map((w) => ({ ...w, id: String(w.id) }));
    const savedOrder = loadWorkspaceOrder();
    const currentIds = normalized.map((w) => w.id as string);
    const mergedIds = mergeOrder(savedOrder, currentIds);

    const byId = new Map(normalized.map((w) => [w.id as string, w]));
    const ordered: Workspace[] = [];
    mergedIds.forEach((id) => {
      const workspace = byId.get(id);
      if (workspace) ordered.push(workspace as unknown as Workspace);
    });
    
    // Update stable workspaces when we have valid data
    if (ordered.length > 0) {
      stableWorkspacesRef.current = ordered;
    }
    
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

  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveId(null);
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
    setActiveId(null);
  };







  const handleAddWorkspace = async () => {
    if (!workspaceName.trim()) {
      alert(t('sidebar.pleaseEnterWorkspaceName', 'Please enter a workspace name.'));
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
      alert(t('sidebar.failedToCreateWorkspace', 'Failed to create workspace. Please try again.'));
    }
  };

  return (
    <Collapsible defaultOpen className="group/collapsible">
      {/* Virtual workspaces */}
      {showEverythingButton && (
        <div className={collapsed ? 'px-2 flex flex-col items-center gap-2 mb-2' : 'space-y-2 mb-2'}>
          <WorkspaceLink 
            to="/workspace/all" 
            icon={Layers} 
            label={t('sidebar.everything', 'Everything')} 
            pathname={pathname} 
            collapsed={collapsed} 
          />
          <WorkspaceLink 
            to="/shared-with-me" 
            icon={Inbox} 
            label={t('sidebar.sharedWithMe', 'Shared')} 
            pathname={pathname} 
            collapsed={collapsed} 
          />
        </div>
      )}

      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <div
            className={`flex items-center w-full ${collapsed ? 'justify-center px-0' : 'justify-between'}`}
            style={{ 
              borderTop: collapsed ? 'none' : `1px solid var(--sidebar-border)`,
              paddingTop: collapsed ? '0' : '8px',
              marginBottom: '8px'
            }}
          >
            {collapsed ? (
              <Briefcase className="w-5 h-5" style={{ color: 'var(--sidebar-text-primary)' }} />
            ) : (
              <>
                <CollapsibleTrigger className="flex items-center cursor-pointer hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] rounded-sm flex-1 p-1 transition-all">
                  <ChevronDown className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180 w-4 h-4 text-[var(--sidebar-text-primary)]" />
                  <span className="pl-2 text-sm font-semibold text-[var(--sidebar-text-primary)]">
                    {t('sidebar.spaces', 'Spaces')}
                  </span>
                </CollapsibleTrigger>
                
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0" title={t('sidebar.moreOptions', 'More options')}>
                    <MoreHorizontal size={16} className="text-[var(--sidebar-text-primary)]" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0" title={t('sidebar.search', 'Search')}>
                    <Search size={16} className="text-[var(--sidebar-text-primary)]" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={() => setIsModalOpen(true)} title={t('sidebar.addWorkspace', 'Add Workspace')}>
                    <Plus size={16} className="text-[var(--sidebar-text-primary)]" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </SidebarGroupLabel>

        <CollapsibleContent 
          keepRendered={true}
          forceVisible={collapsed}
        >
          <SidebarGroupContent className={collapsed ? 'pt-1' : 'pt-1'}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveId(null)}
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
                      taskCount={taskCounts[String(workspace.id)]}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay zIndex={10000}>
                {activeId ? (() => {
                  const w = localWorkspaces.find((x) => String(x.id) === String(activeId));
                  if (!w) return null;
                  const isActive = pathname === `/workspace/${w.id}`;
                  return (
                    <div
                      className="rounded-[8px] shadow-lg"
                      style={{
                        height: '32px',
                        padding: collapsed ? '6px' : '6px 10px',
                        gap: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        background: isActive ? 'var(--sidebar-selected-bg)' : 'var(--sidebar)',
                        color: isActive ? 'var(--sidebar-primary)' : 'var(--sidebar-text-primary)',
                        fontWeight: isActive ? 600 : 500,
                        fontSize: '13px',
                        pointerEvents: 'none',
                      }}
                    >
                      <WorkspaceIconBadge color={w.color || '#3b82f6'}>
                        <FontAwesomeIcon
                          icon={getWorkspaceIcon(w.icon)}
                          style={{ color: '#ffffff', fontSize: '14px', width: '14px', height: '14px', display: 'block' }}
                        />
                      </WorkspaceIconBadge>
                      {!collapsed && <span className="truncate ml-1.5">{w.name}</span>}
                    </div>
                  );
                })() : null}
              </DragOverlay>
            </DndContext>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>

      {/* Add Workspace Dialog */}
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
            <DialogTitle>{t('sidebar.addNewWorkspace', 'Add New Workspace')}</DialogTitle>
            <DialogDescription>
              {t('sidebar.addNewWorkspaceDescription', 'Enter the details for your new workspace. Click save when you\'re done.')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="workspace-name" className="text-right">
                {t('sidebar.workspaceName', 'Name')}
              </Label>
              <Input
                id="workspace-name"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="col-span-3"
                placeholder={t('sidebar.workspaceNamePlaceholder', 'e.g., Project Phoenix')}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="workspace-description" className="text-right">
                {t('sidebar.workspaceDescription', 'Description')}
              </Label>
              <Input
                id="workspace-description"
                value={workspaceDescription}
                onChange={(e) => setWorkspaceDescription(e.target.value)}
                className="col-span-3"
                placeholder={t('sidebar.workspaceDescriptionPlaceholder', 'e.g., For managing project tasks')}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="workspace-color" className="text-right">
                {t('sidebar.workspaceColor', 'Color')}
              </Label>
              <div className="col-span-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      id="workspace-color"
                      type="button"
                      className="h-9 w-16 rounded-md border border-input shadow-sm ring-offset-background transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      style={{ backgroundColor: workspaceColor }}
                      aria-label={t('sidebar.openColorPicker', 'Open color picker')}
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="start" side="top">
                    <ColorPicker
                      className="max-w-xs rounded-md p-2"
                      defaultValue={workspaceColor || "#3b82f6"}
                      onChange={(color: ColorLike) => {
                        const colorInstance = new Color(color);
                        setWorkspaceColor(colorInstance.hex());
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
                      <ColorPickerFormat />
                    </ColorPicker>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="workspace-type" className="text-right">
                {t('sidebar.workspaceType', 'Type')}
              </Label>
              <div className="col-span-3">
                <Select value={workspaceType} onValueChange={setWorkspaceType}>
                  <SelectTrigger id="workspace-type">
                    <SelectValue placeholder={t('sidebar.selectType', 'Select type')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">{t('sidebar.workspaceTypeStandard', 'Standard')}</SelectItem>
                    <SelectItem value="project">{t('sidebar.workspaceTypeProject', 'Project')}</SelectItem>
                    <SelectItem value="department">{t('sidebar.workspaceTypeDepartment', 'Department')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('sidebar.cancel', 'Cancel')}
            </Button>
            <Button type="button" onClick={handleAddWorkspace}>
              {t('sidebar.saveWorkspace', 'Save Workspace')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}

export default AppSidebarWorkspaces;
