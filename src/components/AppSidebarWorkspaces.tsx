import { useEffect, useMemo, useRef, useState } from 'react';
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
import { createSwapy, SlotItemMapArray, Swapy, utils } from 'swapy';

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

export function AppSidebarWorkspaces({ workspaces, pathname, getWorkspaceIcon }: AppSidebarWorkspacesProps) {
  const { isMobile, state } = useSidebar();
  const isCollapsedState = state === 'collapsed';
  const collapsed = isCollapsedState && !isMobile;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');



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
  }, [workspaces]);
  const [workspaceSlotItemMap, setWorkspaceSlotItemMap] = useState<SlotItemMapArray>(utils.initSlotItemMap(localWorkspaces, 'id'));
  const workspaceSlottedItems = useMemo(() => utils.toSlottedItems(localWorkspaces, 'id', workspaceSlotItemMap), [localWorkspaces, workspaceSlotItemMap]);
  const pendingSlotItemMapRef = useRef<SlotItemMapArray | null>(null);

  useEffect(() => {
    const currentIds = localWorkspaces.map((workspace) => String(workspace.id));
    const saved = loadWorkspaceOrder();
    const merged = mergeOrder(saved, currentIds);

    if (!arraysEqual(merged, saved)) {
      saveWorkspaceOrder(merged);
    }

    const mergedMap = merged.map((id) => ({ slot: id, item: id })) as SlotItemMapArray;
    setWorkspaceSlotItemMap((previous) => {
      const previousIds = previous.map(({ item }) => item);
      return arraysEqual(previousIds, merged) ? previous : mergedMap;
    });
  }, [localWorkspaces]);


  const swapyRef = useRef<Swapy | null>(null);
  const workspaceContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { utils.dynamicSwapy(swapyRef.current, localWorkspaces, 'id', workspaceSlotItemMap, setWorkspaceSlotItemMap); }, [localWorkspaces]);






  useEffect(() => {
    const container = workspaceContainerRef.current;
    if (!container) {
      return;
    }

    swapyRef.current?.destroy?.();
    const instance = createSwapy(container, {
      manualSwap: true,
    });

    swapyRef.current = instance;

    instance.onSwap?.((event) => {

      setWorkspaceSlotItemMap(event.newSlotItemMap.asArray);
    });

    instance.onSwapEnd?.((event) => {
      if (!event.hasChanged) return;
      const slotArray = event.slotItemMap?.asArray ?? pendingSlotItemMapRef.current;
      if (!slotArray) return;
      pendingSlotItemMapRef.current = slotArray;
      const orderedIds = slotArray.map(({ item }) => item);
      saveWorkspaceOrder(orderedIds);
      // scheduleApplyPendingSlotMap();
    });

    return () => {

      swapyRef.current?.destroy?.();
    };
  }, [localWorkspaces, workspaceSlottedItems.length, collapsed]);







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
          <SidebarGroupContent className={collapsed ? 'pt-2' : 'pt-2 pl-1'}>
            <div ref={workspaceContainerRef}>
              <div className={collapsed ? 'flex flex-col items-center space-y-1 px-1 py-1 rounded-md bg-sidebar-accent z-300' : 'workspace-items'}>
                {workspaceSlottedItems.map(({ slotId, itemId, item }) => (
                  <div data-swapy-slot={slotId} key={slotId}>
                    {item && (
                      <div
                        className={`rounded-md relative ${collapsed
                            ? 'flex items-center justify-center h-8 w-8 mx-0'
                            : 'flex items-center space-x-2 overflow-hidden h-10 px-4 mx-2'
                          }`}
                        data-swapy-item={itemId}
                        key={itemId}
                      >
                        <Link
                          to={`/workspace/${itemId}`}
                          data-workspace-id={String(itemId)}
                          onDragStart={(event) => event.preventDefault()}
                          className={`group flex items-center  rounded-md ${collapsed
                              ? `justify-center w-full h-full text-xs font-medium ${pathname === `/workspace/${itemId}`
                                ? 'bg-primary/20 text-primary border border-primary/40'
                                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                              }`
                              : `flex-1 space-x-2 h-10 -mx-4 px-4 ${pathname === `/workspace/${itemId}`
                                ? 'bg-primary/15 text-primary border-l-4 border-primary'
                                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground px-5'
                              } after:absolute after:left-0 after:top-0 after:h-full after:w-0 hover:after:w-1 after:bg-primary/60 `
                            }`}
                        >
                          <span className="flex items-center justify-center">
                            <FontAwesomeIcon
                              icon={getWorkspaceIcon(item.icon)}
                              style={{ color: item.color }}
                              className="w-4 h-4"
                            />
                          </span>
                          <span className={collapsed ? 'sr-only' : 'truncate'}>{item.name}</span>
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export default AppSidebarWorkspaces;
