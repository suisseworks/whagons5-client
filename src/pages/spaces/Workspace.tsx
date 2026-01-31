import { useRef, useMemo, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { UrlTabs } from '@/components/ui/url-tabs';
import { MessageSquare, FolderPlus, X, CheckCircle2, UserRound, CalendarDays, Flag, Trash2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { TabsTrigger } from '@/animated/Tabs';
import { WorkspaceTableHandle } from '@/pages/spaces/components/WorkspaceTable';
import ChatTab from '@/pages/spaces/components/ChatTab';
import ResourcesTab from '@/pages/spaces/components/ResourcesTab';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '@/store';
import {
  setFilterModel,
  setSearchText,
  setGroupBy,
  setCollapseGroups,
  selectSearchText,
  selectGroupBy,
  selectCollapseGroups,
} from '@/store/reducers/uiStateSlice';
import { Button } from '@/components/ui/button';
import TaskDialog from '@/pages/spaces/components/TaskDialog';
import { TAB_ANIMATION, getTabInitialX, type TabAnimationConfig } from '@/config/tabAnimation';
import FilterBuilderDialog from '@/pages/spaces/components/FilterBuilderDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import TaskNotesModal from '@/pages/spaces/components/TaskNotesModal';
import { useLanguage } from '@/providers/LanguageProvider';
import { DeleteTaskDialog } from '@/components/tasks/DeleteTaskDialog';
import { WorkspaceKpiCard } from '@/pages/spaces/components/WorkspaceKpiCard';
import { useWorkspaceRouting } from './workspace/hooks/useWorkspaceRouting';
import { useWorkspaceTabOrder } from './workspace/hooks/useWorkspaceTabOrder';
import { useWorkspaceDisplayOptions } from './workspace/hooks/useWorkspaceDisplayOptions';
import { useWorkspaceTabState } from './workspace/hooks/useWorkspaceTabState';
import { useWorkspaceStats } from './workspace/hooks/useWorkspaceStats';
import { useWorkspaceKpiCards } from './workspace/hooks/useWorkspaceKpiCards';
import { useWorkspaceTaskActions } from './workspace/hooks/useWorkspaceTaskActions';
import { useWorkspaceRightPanel } from './workspace/hooks/useWorkspaceRightPanel';
import { useWorkspaceFilters } from './workspace/hooks/useWorkspaceFilters';
import { useWorkspaceDragDrop } from './workspace/hooks/useWorkspaceDragDrop';
import { useWorkspaceTaskDialog } from './workspace/hooks/useWorkspaceTaskDialog';
import { useWorkspaceRowDensity } from './workspace/hooks/useWorkspaceRowDensity';
import { createWorkspaceTabs } from './workspace/utils/workspaceTabs';
import { SortableTab } from './workspace/components/SortableTab';
import { SortableKpiCard } from './workspace/components/SortableKpiCard';
import { WORKSPACE_TAB_PATHS, ALWAYS_VISIBLE_TABS, FIXED_TABS, type WorkspaceTabKey } from './workspace/constants';

export const Workspace = () => {
  const { t } = useLanguage();
  const dispatch = useDispatch();
  const location = useLocation();

  // Routing
  const routing = useWorkspaceRouting(location);
  const { id, workspaceBasePath, isAllWorkspaces, workspaceIdNum, invalidWorkspaceRoute, invalidWorkspaceId } = routing;
  const workspaceKey = id || 'all';

  // Tab order and state
  const { customTabOrder, setCustomTabOrder, resolvedOrder, primaryTabValue } = useWorkspaceTabOrder(workspaceKey);
  const { activeTab, setActiveTab, prevActiveTab, setPrevActiveTab } = useWorkspaceTabState({
    location,
    workspaceBasePath,
    invalidWorkspaceRoute,
    invalidWorkspaceId,
    resolvedOrder,
  });

  // Display options
  const { showHeaderKpis, tagDisplayMode, visibleTabs } = useWorkspaceDisplayOptions(workspaceKey);
  const { computedRowHeight } = useWorkspaceRowDensity();

  // Refs
  const rowCache = useRef(new Map<string, { rows: any[]; rowCount: number }>());
  const tableRef = useRef<WorkspaceTableHandle | null>(null);

  // Redux UI state
  const searchText = useSelector(selectSearchText);
  const groupBy = useSelector(selectGroupBy);
  const collapseGroups = useSelector(selectCollapseGroups);
  const currentUser = useSelector((s: RootState) => (s as any).auth?.user);
  const currentUserId = Number((currentUser as any)?.id);

  // Metadata for filters
  const priorities = useSelector((s: RootState) => (s as any).priorities.value as any[]);
  const statuses = useSelector((s: RootState) => (s as any).statuses.value as any[]);
  const spots = useSelector((s: RootState) => (s as any).spots.value as any[]);
  const users = useSelector((s: RootState) => (s as any).users.value as any[]);
  const tags = useSelector((s: RootState) => (s as any).tags.value as any[]);

  // Derived status groupings for stats
  const doneStatusId = (statuses || []).find((s: any) => String((s as any).action || '').toUpperCase() === 'FINISHED')?.id
    ?? (statuses || []).find((s: any) => String((s as any).action || '').toUpperCase() === 'DONE')?.id
    ?? (statuses || []).find((s: any) => String((s as any).name || '').toLowerCase().includes('done'))?.id;
  const workingStatusIds: number[] = (statuses || [])
    .filter((s: any) => String((s as any).action || '').toUpperCase() === 'WORKING')
    .map((s: any) => Number((s as any).id))
    .filter((n: number) => Number.isFinite(n));

  // Stats
  const stats = useWorkspaceStats({
    workspaceId: id,
    isAllWorkspaces,
    doneStatusId,
    workingStatusIds,
  });

  // KPI Cards
  const {
    headerKpiCards,
    setHeaderKpiCards,
    headerCards,
    canReorderHeaderKpis
  } = useWorkspaceKpiCards({
    workspaceIdNum,
    currentUserId,
    doneStatusId,
    workingStatusIds,
    stats,
  });

  // Track selected KPI card for filtering
  const [selectedKpiCardId, setSelectedKpiCardId] = useState<number | null>(null);

  // Task actions
  const {
    selectedIds,
    setSelectedIds,
    deleteDialogOpen,
    setDeleteDialogOpen,
    handleDeleteSelected
  } = useWorkspaceTaskActions();

  // Right panel
  const { rightPanel, setRightPanel, rightPanelWidth, isResizing, toggleRightPanel, startResize } = useWorkspaceRightPanel();

  // Filters
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { handleTableReady } = useWorkspaceFilters({
    workspaceKey,
    currentUser,
    filtersOpen,
    tableRef,
  });

  // Task dialog
  const { openCreateTask, setOpenCreateTask, openEditTask, setOpenEditTask, selectedTask, handleOpenTaskDialog } = useWorkspaceTaskDialog();

  // Drag and drop
  const { activeKpiId, handleDragStart, handleDragEnd, handleKpiDragStart, handleKpiDragEnd } = useWorkspaceDragDrop({
    customTabOrder,
    setCustomTabOrder,
    headerKpiCards,
    setHeaderKpiCards,
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );
  const kpiSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Load groupBy and collapseGroups from localStorage when workspace changes
  useEffect(() => {
    if (!id && !isAllWorkspaces) return;
    const workspaceId = id || 'all';
    try {
      const groupKey = `wh_workspace_group_by_${workspaceId}`;
      const collapseKey = `wh_workspace_group_collapse_${workspaceId}`;
      const savedGroup = localStorage.getItem(groupKey) as any;
      const savedCollapse = localStorage.getItem(collapseKey);
      if (savedGroup) {
        dispatch(setGroupBy(savedGroup));
      }
      if (savedCollapse !== null) {
        dispatch(setCollapseGroups(savedCollapse === 'true'));
      }
    } catch {}
  }, [id, isAllWorkspaces, dispatch]);

  // Listen for filter dialog open events
  useEffect(() => {
    const handleFilterDialogOpen = () => {
      setFiltersOpen(true);
    };
    window.addEventListener('workspace-filter-dialog-open', handleFilterDialogOpen as EventListener);
    return () => {
      window.removeEventListener('workspace-filter-dialog-open', handleFilterDialogOpen as EventListener);
    };
  }, []);

  // Clear cache when workspace ID changes
  useEffect(() => {
    if (id) {
      rowCache.current.clear();
    }
  }, [id, location.pathname]);

  // Save search text to localStorage when it changes
  useEffect(() => {
    const key = `wh_workspace_search_global`;
    try {
      if (searchText) {
        localStorage.setItem(key, searchText);
      } else {
        localStorage.removeItem(key);
      }
    } catch {}
  }, [searchText]);

  // Filter tabs based on visibility preferences
  const visibleTabSet = useMemo(() => new Set(visibleTabs), [visibleTabs]);
  const filteredOrder = useMemo(() => resolvedOrder.filter(key => 
    ALWAYS_VISIBLE_TABS.includes(key) || visibleTabSet.has(key)
  ), [resolvedOrder, visibleTabSet]);
  
  // Create dynamic animation config
  const dynamicTabAnimation = useMemo<TabAnimationConfig<WorkspaceTabKey>>(() => ({
    order: filteredOrder,
    distance: TAB_ANIMATION.distance,
    transition: TAB_ANIMATION.transition,
  }), [filteredOrder]);
  
  const getDynamicTabInitialX = useMemo(() => {
    return (prev: WorkspaceTabKey | string | null | undefined, next: WorkspaceTabKey | string): string | number => {
      const prevStr = prev ? String(prev) : null;
      const nextStr = String(next);
      return getTabInitialX(prevStr, nextStr, dynamicTabAnimation);
    };
  }, [dynamicTabAnimation]);

  // Create tabs
  const workspaceTabs = createWorkspaceTabs({
    workspaceId: id,
    isAllWorkspaces,
    rowCache,
    tableRef,
    searchText,
    groupBy,
    collapseGroups,
    tagDisplayMode,
    computedRowHeight,
    activeTab,
    prevActiveTab,
    dynamicTabAnimation,
    getDynamicTabInitialX,
    onFiltersChanged: (active) => {
      setShowClearFilters(active);
      const model = tableRef.current?.getFilterModel?.();
      dispatch(setFilterModel(model || null));
    },
    onSelectionChanged: setSelectedIds,
    onOpenTaskDialog: handleOpenTaskDialog,
    onReady: handleTableReady,
    onFilterModelChange: (model) => dispatch(setFilterModel(model)),
  });

  const workspaceTabMap = workspaceTabs.reduce<Record<string, typeof workspaceTabs[number]>>((acc, tab) => {
    acc[tab.value] = tab;
    return acc;
  }, {});
  
  const orderedVisibleTabs = filteredOrder
    .map((key) => workspaceTabMap[key])
    .filter((tab): tab is typeof workspaceTabs[number] => Boolean(tab));
  const tabsForRender = orderedVisibleTabs.length > 0 ? orderedVisibleTabs : workspaceTabs.filter(tab => {
    const tabValue = tab.value as WorkspaceTabKey;
    return ALWAYS_VISIBLE_TABS.includes(tabValue) || visibleTabSet.has(tabValue);
  });

  const [showClearFilters, setShowClearFilters] = useState(false);

  // Handle KPI card click to apply filters
  const handleKpiCardClick = (cardId: number) => {
    const card = headerCards.find((c: any) => c.id === cardId);
    if (!card || !card.filterModel) {
      // If no filter model, clear selection and filters
      setSelectedKpiCardId(null);
      tableRef.current?.setFilterModel?.(null);
      dispatch(setFilterModel(null));
      try {
        localStorage.removeItem(`wh_workspace_filters_${id || 'all'}`);
      } catch {}
      return;
    }

    // Toggle: if already selected, deselect and clear filters
    if (selectedKpiCardId === cardId) {
      setSelectedKpiCardId(null);
      tableRef.current?.setFilterModel?.(null);
      dispatch(setFilterModel(null));
      try {
        localStorage.removeItem(`wh_workspace_filters_${id || 'all'}`);
      } catch {}
    } else {
      // Apply filter from card
      setSelectedKpiCardId(cardId);
      tableRef.current?.setFilterModel?.(card.filterModel);
      dispatch(setFilterModel(card.filterModel));
      try {
        localStorage.setItem(`wh_workspace_filters_${id || 'all'}`, JSON.stringify(card.filterModel));
      } catch {}
      dispatch(setSearchText(''));
    }
  };

  // Clear KPI selection when filters are cleared externally
  useEffect(() => {
    const handleClearFilters = () => {
      setSelectedKpiCardId(null);
    };
    window.addEventListener('workspace-filter-clear', handleClearFilters as EventListener);
    return () => {
      window.removeEventListener('workspace-filter-clear', handleClearFilters as EventListener);
    };
  }, []);

  // Sync selected KPI card when filters are loaded from localStorage
  useEffect(() => {
    if (!id && !isAllWorkspaces) return;
    const workspaceId = id || 'all';
    try {
      const key = `wh_workspace_filters_${workspaceId}`;
      const saved = localStorage.getItem(key);
      if (saved && headerCards.length > 0) {
        const filterModel = JSON.parse(saved);
        // Try to find a matching card
        const matchingCard = headerCards.find((card: any) => {
          if (!card.filterModel) return false;
          return JSON.stringify(card.filterModel) === JSON.stringify(filterModel);
        });
        if (matchingCard) {
          setSelectedKpiCardId(matchingCard.id);
        }
      }
    } catch {}
  }, [id, isAllWorkspaces, headerCards]);

  if (invalidWorkspaceRoute) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600">Invalid Workspace ID</h2>
          <p className="text-gray-600 mt-2">Please check the URL and try again.</p>
        </div>
      </div>
    );
  }

  if (invalidWorkspaceId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600">Invalid Workspace ID</h2>
          <p className="text-gray-600 mt-2">ID: "{id}" must be a number or "all" - Please check the URL and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-shrink-0 flex items-start gap-3 -mt-1 mb-3">
        {showHeaderKpis && (
          <div className="flex-1 min-w-0">
            <DndContext
              sensors={kpiSensors}
              collisionDetection={closestCenter}
              onDragStart={handleKpiDragStart}
              onDragEnd={handleKpiDragEnd}
              onDragCancel={() => {
                // Handled in hook
              }}
            >
              {canReorderHeaderKpis ? (
                <>
                  <SortableContext items={headerCards.map((c: any) => c.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-stretch">
                      {headerCards.map((card: any) => (
                        <SortableKpiCard
                          key={card.id}
                          id={card.id}
                          card={card}
                          isSelected={selectedKpiCardId === card.id}
                          onClick={() => handleKpiCardClick(card.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay zIndex={10000}>
                    {activeKpiId != null ? (() => {
                      const card = headerCards.find((c: any) => c.id === activeKpiId);
                      if (!card) return null;
                      return (
                        <div className="opacity-90 scale-105">
                          <WorkspaceKpiCard
                            label={card.label}
                            value={card.value}
                            icon={card.icon}
                            accent={card.accent}
                            helperText={card.helperText}
                            right={card.sparkline}
                          />
                        </div>
                      );
                    })() : null}
                  </DragOverlay>
                </>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-stretch">
                  {headerCards.map((card: any) => (
                    <WorkspaceKpiCard
                      key={card.id}
                      label={card.label}
                      value={card.value}
                      icon={card.icon}
                      accent={card.accent}
                      helperText={card.helperText}
                      right={card.sparkline}
                      isSelected={selectedKpiCardId === card.id}
                      onClick={() => handleKpiCardClick(card.id)}
                    />
                  ))}
                </div>
              )}
            </DndContext>
          </div>
        )}

        <div className={`flex-shrink-0 flex items-center gap-3 ${showHeaderKpis ? '' : 'ml-auto'}`}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={rightPanel ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-2"
                aria-label="Collaboration menu"
              >
                <MessageSquare className="w-4 h-4" strokeWidth={2.2} />
                <span className="hidden sm:inline">{t('workspace.collab.collab', 'Collab')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>{t('workspace.collab.collaboration', 'Collaboration')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={rightPanel === 'chat'}
                onCheckedChange={() => toggleRightPanel('chat')}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  <span>{t('workspace.collab.chat', 'Chat')}</span>
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={rightPanel === 'resources'}
                onCheckedChange={() => toggleRightPanel('resources')}
              >
                <div className="flex items-center gap-2">
                  <FolderPlus className="w-4 h-4" />
                  <span>{t('workspace.collab.resources', 'Resources')}</span>
                </div>
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bulk actions toolbar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 mb-2 border rounded px-2 py-1 bg-background/60">
          <span className="text-sm text-muted-foreground">Selected: {selectedIds.length}</span>
          <Button variant="ghost" size="sm" title="Mark complete" aria-label="Mark complete" disabled>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Complete
          </Button>
          <Button variant="ghost" size="sm" title="Reassign" aria-label="Reassign" disabled>
            <UserRound className="h-4 w-4 mr-1" /> Reassign
          </Button>
          <Button variant="ghost" size="sm" title="Change priority" aria-label="Change priority" disabled>
            <Flag className="h-4 w-4 mr-1" /> Priority
          </Button>
          <Button variant="ghost" size="sm" title="Reschedule" aria-label="Reschedule" disabled>
            <CalendarDays className="h-4 w-4 mr-1" /> Reschedule
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            title="Delete selected tasks" 
            aria-label="Delete selected tasks"
            onClick={() => setDeleteDialogOpen(true)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
          <div className="ml-auto" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              tableRef.current?.clearSelection?.();
              setSelectedIds([]);
            }}
          >
            Clear selection
          </Button>
        </div>
      )}

      <div className={`flex flex-1 min-h-0 ${isResizing ? 'select-none' : ''}`}>
        <div className='flex-1 min-w-0 h-full'>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={filteredOrder} strategy={rectSortingStrategy}>
              <UrlTabs
                tabs={tabsForRender}
                defaultValue={primaryTabValue}
                basePath={`/workspace/${id}`}
                pathMap={WORKSPACE_TAB_PATHS}
                className="w-full h-full flex flex-col [&_[data-slot=tabs]]:gap-0 [&_[data-slot=tabs-content]]:mt-0 [&>div]:pt-0 [&_[data-slot=tabs-list]]:mb-0"
                onValueChange={(v) => { 
                  if (Object.keys(WORKSPACE_TAB_PATHS).includes(v)) {
                    const tabValue = v as WorkspaceTabKey;
                    setPrevActiveTab(activeTab); 
                    setActiveTab(tabValue);
                  }
                }}
                showClearFilters={showClearFilters}
                onClearFilters={() => {
                  tableRef.current?.clearFilters();
                  setSelectedKpiCardId(null);
                  window.dispatchEvent(new CustomEvent('workspace-filter-clear'));
                }}
                sortable={true}
                sortableItems={filteredOrder.filter(key => !FIXED_TABS.includes(key))}
                renderSortableTab={(tab, isFixed) => (
                  <SortableTab
                    key={tab.value}
                    id={tab.value}
                    disabled={isFixed}
                  >
                    <TabsTrigger
                      value={tab.value}
                      disabled={tab.disabled}
                    >
                      {tab.label}
                    </TabsTrigger>
                  </SortableTab>
                )}
              />
            </SortableContext>
          </DndContext>
        </div>
        {rightPanel && (
          <>
            <div
              className="w-1.5 cursor-col-resize bg-border hover:bg-primary/40"
              onMouseDown={startResize}
              title="Drag to resize"
            />
            <div className="border-l bg-background flex flex-col" style={{ width: rightPanelWidth, flex: '0 0 auto' }}>
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <div className="text-sm font-medium">{rightPanel === 'chat' ? t('workspace.collab.chat', 'Chat') : t('workspace.collab.resources', 'Resources')}</div>
                <Button variant="ghost" size="icon" aria-label="Close panel" onClick={() => setRightPanel(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1 min-h-0 overflow-auto p-2">
                {rightPanel === 'chat' ? (
                  <ChatTab workspaceId={id} />
                ) : (
                  <ResourcesTab workspaceId={id} />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <FilterBuilderDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        workspaceId={isAllWorkspaces ? 'all' : (id || 'all')}
        statuses={(statuses || []).map((s: any) => ({ id: Number(s.id), name: s.name }))}
        priorities={(priorities || []).map((p: any) => ({ id: Number(p.id), name: p.name }))}
        spots={(spots || []).map((sp: any) => ({ id: Number(sp.id), name: sp.name }))}
        owners={(users || [])
          .map((u: any) => {
            const idNum = Number(u.id);
            if (!Number.isFinite(idNum)) return null;
            return { id: idNum, name: u.name || u.email || `User #${idNum}` };
          })
          .filter((o): o is { id: number; name: string } => Boolean(o))}
        tags={(tags || [])
          .filter((t: any) => {
            const idNum = Number(t.id);
            return Number.isFinite(idNum);
          })
          .map((t: any) => ({
            id: Number(t.id),
            name: t.name,
            color: t.color
          }))}
        currentModel={tableRef.current?.getFilterModel?.()}
        currentSearchText={searchText}
        onApply={(model) => {
          const filterModel = model || null;
          tableRef.current?.setFilterModel(filterModel);
          dispatch(setFilterModel(filterModel));
          try { localStorage.setItem(`wh_workspace_filters_${id || 'all'}`, JSON.stringify(filterModel)); } catch {}
          dispatch(setSearchText(''));
          
          // Check if the applied filter matches any KPI card
          if (!filterModel) {
            setSelectedKpiCardId(null);
          } else {
            // Try to find a matching card
            const matchingCard = headerCards.find((card: any) => {
              if (!card.filterModel) return false;
              // Simple comparison - check if filter models match
              return JSON.stringify(card.filterModel) === JSON.stringify(filterModel);
            });
            if (matchingCard) {
              setSelectedKpiCardId(matchingCard.id);
            } else {
              setSelectedKpiCardId(null);
            }
          }
        }}
      />

      {/* Task Dialog - Unified component for create/edit */}
      {!isAllWorkspaces && !isNaN(Number(id)) && (
        <TaskDialog 
          open={openCreateTask} 
          onOpenChange={setOpenCreateTask} 
          mode="create" 
          workspaceId={parseInt(id!, 10)} 
        />
      )}
      {isAllWorkspaces && (
        <TaskDialog 
          open={openCreateTask} 
          onOpenChange={setOpenCreateTask} 
          mode="create-all" 
        />
      )}
      <TaskDialog 
        open={openEditTask} 
        onOpenChange={setOpenEditTask} 
        mode="edit" 
        task={selectedTask} 
      />
      <TaskNotesModal />
      <DeleteTaskDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteSelected}
        taskName={selectedIds.length === 1 ? undefined : `${selectedIds.length} tasks`}
      />
    </div>
  );
};
