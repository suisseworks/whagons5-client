import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  Plus,
  ChevronDown,
  Briefcase,  
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
import { Workspace } from '@/store/types';
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
}

interface SortableWorkspaceItemProps {
  workspace: Workspace;
  pathname: string;
  collapsed: boolean;
  getWorkspaceIcon: (iconName?: string) => any;
}

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

  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center justify-center h-8 w-8 mx-0 rounded-md"
      >
        <div
          {...listeners}
          {...attributes}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        >
          <Link
            to={`/workspace/${workspace.id}`}
            data-workspace-id={String(workspace.id)}
            onClick={(e) => {
              if (isDragging) {
                e.preventDefault();
              }
            }}
            className={`group flex items-center justify-center w-full h-full text-xs font-medium rounded-md ${
              pathname === `/workspace/${workspace.id}`
                ? 'bg-primary/20 text-primary border border-primary/40'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}
          >
            <FontAwesomeIcon
              icon={getWorkspaceIcon(workspace.icon)}
              style={{ color: workspace.color }}
              className="w-4 h-4"
            />
            <span className="sr-only">{workspace.name}</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="flex items-center h-10 rounded-md relative cursor-grab active:cursor-grabbing"
    >
      <Link
        to={`/workspace/${workspace.id}`}
        data-workspace-id={String(workspace.id)}
        onClick={(e) => {
          // Prevent navigation if dragging
          if (isDragging) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className={`group flex items-center rounded-md flex-1 space-x-3 h-10 px-3 pointer-events-auto ${
          pathname === `/workspace/${workspace.id}`
            ? 'bg-primary/10 text-primary border-l-[3px] border-primary rounded-l-md'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        } after:absolute after:left-0 after:top-0 after:h-full after:w-0 hover:after:w-1 after:bg-primary/60 after:rounded-l-md`}
        style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
      >
        <span className="flex items-center justify-center">
          <FontAwesomeIcon
            icon={getWorkspaceIcon(workspace.icon)}
            style={{ color: workspace.color }}
            className="w-4 h-4"
          />
        </span>
        <span className="truncate font-medium text-[14px]">{workspace.name}</span>
      </Link>
    </div>
  );
}

export function AppSidebarWorkspaces({ workspaces, pathname, getWorkspaceIcon }: AppSidebarWorkspacesProps) {
  const { isMobile, state } = useSidebar();
  const isCollapsedState = state === 'collapsed';
  const collapsed = isCollapsedState && !isMobile;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');

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







  const handleAddWorkspace = () => {
    if (!workspaceName.trim() || !workspaceDescription.trim()) {
      alert('Please enter both name and description.');
      return;
    }

    setWorkspaceName('');
    setWorkspaceDescription('');
    setIsModalOpen(false);
  };

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup>
        <SidebarGroupLabel asChild className="text-sm font-normal">
          <div
            className={`flex items-center w-full pr-3 ${collapsed ? 'justify-center px-0' : 'justify-between'
              }`}
          >
            <CollapsibleTrigger
              className={`flex items-center cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-sm p-1 pr-2 -ml-3 ${collapsed
                ? 'flex-col justify-center ml-0 px-2'
                : 'justify-start flex-1'
                }`}
            >
              {collapsed ? (
                <div className="flex flex-col items-center">
                  <Briefcase className="text-sidebar-foreground w-5 h-5 mb-1" />
                </div>
              ) : (
                <>
                  <ChevronDown className="ease-out group-data-[state=open]/collapsible:rotate-180 w-4 h-4 text-sidebar-foreground" />
                  <span className="text-base font-semibold pl-2 text-sidebar-foreground flex items-center">
                    <Briefcase className="w-4 h-4 mr-2" />
                    Spaces
                  </span>
                </>
              )}
            </CollapsibleTrigger>

            {(!isCollapsedState || isMobile) && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  title="Add Workspace"
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                >
                  <Plus />
                  <span className="sr-only">Add Workspace</span>
                </Button>
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
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
              </>
            )}
          </div>
        </SidebarGroupLabel>

        <CollapsibleContent keepRendered>
          <SidebarGroupContent className={collapsed ? 'pt-2' : 'pt-2'}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={workspaceIds}
                strategy={verticalListSortingStrategy}
              >
                <div className={collapsed ? 'flex flex-col items-center space-y-1 px-1 py-1 rounded-md bg-sidebar-accent z-300' : 'space-y-1'}>
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
