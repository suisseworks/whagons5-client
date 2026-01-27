'use client';

import { useMemo, useState, useRef, useEffect, lazy, Suspense, forwardRef, useCallback } from 'react';
import { DeleteTaskDialog } from '@/components/tasks/DeleteTaskDialog';
import { FormFillDialog } from './formFillDialog';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { WorkspaceTableHandle } from './workspaceTable/types';

// Organized imports
import { EmptyOverlay } from './workspaceTable/components/EmptyOverlay';
import {
  useStatusIcons,
  useApprovalRefresh,
  useColumnManagement,
  useFilterPersistence,
  useTaskDeletion,
  useWorkspaceTableLookups,
  useGridReady,
  useWorkspaceChange,
  useContextMenu,
  useGridGrouping,
  useImperativeHandleMethods,
  useGridRefresh,
  useMetadataSync,
  useStatusChange,
  useDoneStatusId,
  useLatestRef,
  useNewTaskAnimation,
} from './workspaceTable/hooks';
import {
  loadAgGridModules,
  createDefaultColDef,
  createGridOptions,
} from './workspaceTable/grid';
import {
  getUserDisplayName,
  getUsersFromIds,
  formatDueDate,
} from './workspaceTable/utils';
import {
  GRID_CONSTANTS,
  createLoadingSpinner,
  createGridContainer,
} from './workspaceTable/grid/gridConfig';
import { setupTaskEventHandlers } from './workspaceTable/handlers';
import { buildWorkspaceColumns } from './workspaceTable/columns/index';
import {
  useGridReduxState,
  useDerivedGridState,
  useMetadataLoadedFlags,
  useWorkspaceTableMode,
} from './workspaceTable/grid/gridState';
import { getAllowedNextStatusesFactory } from './workspaceTable/utils/mappers';
import { normalizeFilterModelForQuery } from './workspaceTable/utils/filterUtils';
import { buildGetRows } from './workspaceTable/grid/dataSource';
import { TasksCache } from '@/store/indexedDB/TasksCache';

// Lazy load AgGridReact component
const AgGridReact = lazy(() => import('ag-grid-react').then(module => ({ default: module.AgGridReact }))) as any;

export type { WorkspaceTableHandle } from './workspaceTable/types';


const WorkspaceTable = forwardRef<WorkspaceTableHandle, {
  rowCache: React.MutableRefObject<Map<string, { rows: any[]; rowCount: number }>>;
  workspaceId: string;
  searchText?: string;
  onFiltersChanged?: (active: boolean) => void;
  onSelectionChanged?: (selectedIds: number[]) => void;
  onOpenTaskDialog?: (task: any) => void;
  rowHeight?: number;
  groupBy?: 'none' | 'spot_id' | 'status_id' | 'priority_id';
  collapseGroups?: boolean;
  onReady?: () => void;
  onModeChange?: (info: { useClientSide: boolean; totalFiltered: number }) => void;
  tagDisplayMode?: 'icon' | 'icon-text';
}>(({
  rowCache,
  workspaceId,
  searchText = '',
  onFiltersChanged,
  onSelectionChanged,
  onOpenTaskDialog,
  rowHeight,
  groupBy = 'none',
  collapseGroups = true,
  onReady,
  onModeChange,
  tagDisplayMode = 'icon-text',
}, ref): React.ReactNode => {
  const { t } = useLanguage();
  const [modulesLoaded, setModulesLoaded] = useState(false);
  const gridRef = useRef<any>(null);
  const [emptyOverlayVisible, setEmptyOverlayVisible] = useState(false);

  const exitEditMode = useCallback((api?: any) => {
    try {
      api?.deselectAll?.();
    } catch {
      // ignore
    }
  }, []);

  const handleSelectionChanged = useCallback(
    (e: any, onSelectionChangedCb?: (selectedIds: number[]) => void) => {
      try {
        const rows = e.api.getSelectedRows?.() || [];
        const ids = rows.map((r: any) => Number(r.id)).filter((n: any) => Number.isFinite(n));
        // Refresh ID column cells to update checkbox states and blue highlight
        e.api?.refreshCells?.({ columns: ['id'], force: true });
        // Refresh header to update select-all checkbox
        e.api?.refreshHeader?.();
        onSelectionChangedCb?.(ids);
      } catch {
        onSelectionChangedCb?.([]);
      }
    },
    []
  );

  const handleRowClick = useCallback((e: any, onOpenTaskDialogCb?: (task: any) => void) => {
    // Don't open dialog when clicking ID column, status cell, notes column, config column, or form column
    if (e?.column?.colId === 'id' || e?.column?.colId === 'status_id' || e?.column?.colId === 'notes' || e?.column?.colId === 'config' || e?.column?.colId === 'form') {
      return;
    }
    
    const target = e?.event?.target as HTMLElement;
    if (target) {
      const statusCell = target.closest('.ag-cell[col-id="status_id"]');
      const idCell = target.closest('.ag-cell[col-id="id"]');
      const notesCell = target.closest('.ag-cell[col-id="notes"]');
      const configCell = target.closest('.ag-cell[col-id="config"]');
      const formCell = target.closest('.ag-cell[col-id="form"]');
      if (statusCell || idCell || notesCell || configCell || formCell) return;
    }

    if (onOpenTaskDialogCb && e?.data) onOpenTaskDialogCb(e.data);
  }, []);
  const {
    externalFilterModelRef,
    debugFilters,
    suppressPersistRef,
    applyFilterModelToGrid,
    handleGridFilterChanged,
    ensureFiltersApplied,
  } = useFilterPersistence(workspaceId);
  const { visibleColumns, applyStoredColumnOrder, handleColumnOrderChanged } = useColumnManagement(workspaceId);
  
  // Refs to avoid stale closures
  const searchRef = useRef<string>(searchText);
  useEffect(() => { searchRef.current = searchText; }, [searchText]);
  const workspaceRef = useRef<string>(workspaceId);
  useEffect(() => { workspaceRef.current = workspaceId; }, [workspaceId]);
  const { user } = useAuth();

  // Load modules on component mount
  useEffect(() => {
    loadAgGridModules()
      .then(() => setModulesLoaded(true))
      .catch(console.error);
  }, []);

  // Redux state management
  const reduxState = useGridReduxState();
  const derivedState = useDerivedGridState(reduxState, { workspaceId, searchText });

  // Extract state from abstracted hooks
  const {
    statuses,
    priorities,
    spots,
    users,
    categories,
    templates,
    forms,
    formVersions,
    taskForms,
    statusTransitions,
    approvals,
    approvalApprovers,
    taskApprovalInstances,
    slas,
    tags,
    taskTags,
    taskUsers,
    customFields,
    categoryCustomFields,
    taskCustomFieldValues,
    taskNotes,
    taskAttachments,
  } = reduxState as any;
  const { defaultCategoryId, workspaceNumericId, isAllWorkspaces } = derivedState as any;
  const metadataLoadedFlags = useMetadataLoadedFlags(reduxState);

  const globalStatuses = useMemo(() => statuses, [statuses]);
  const { getStatusIcon } = useStatusIcons(globalStatuses);

  const {
    slaMap,
    statusMap,
    categoryToGroup,
    transitionsByGroupFrom,
    priorityMap,
    spotMap,
    userMap,
    filteredPriorities,
    tagMap,
    templateMap,
    formMap,
    formVersionMap,
    taskFormsMap,
    taskTagsMap,
    categoryMap,
    workspaceCustomFields,
    taskCustomFieldValueMap,
    approvalMap,
    stableTaskApprovalInstances,
  } = useWorkspaceTableLookups({
    statuses: globalStatuses,
    priorities,
    spots,
    users,
    categories,
    templates,
    forms,
    formVersions,
    taskForms,
    statusTransitions,
    slas,
    tags,
    taskTags,
    customFields,
    categoryCustomFields,
    taskCustomFieldValues,
    approvals,
    taskApprovalInstances,
    defaultCategoryId,
    workspaceNumericId,
    isAllWorkspaces,
  });

  // Refs for data access in callbacks
  const statusMapRef = useLatestRef(statusMap);
  const priorityMapRef = useLatestRef(priorityMap);
  const spotMapRef = useLatestRef(spotMap);
  const userMapRef = useLatestRef(userMap);
  const tagMapRef = useLatestRef(tagMap);
  const taskTagsRef = useLatestRef(taskTags);
  const globalStatusesRef = useLatestRef(globalStatuses);

  const getAllowedNextStatuses = useMemo(
    () => getAllowedNextStatusesFactory(categoryToGroup, transitionsByGroupFrom),
    [categoryToGroup, transitionsByGroupFrom]
  );

  const getDoneStatusId = useDoneStatusId(globalStatusesRef);

  
  // Track newly created tasks for animation
  const { isNewTask, newTaskIds } = useNewTaskAnimation();
  const handleChangeStatus = useStatusChange(statusMap, getDoneStatusId, categories, stableTaskApprovalInstances, approvalMap);

  const { useClientSide, clientRows, setClientRows } = useWorkspaceTableMode({
    gridApi: gridRef.current?.api,
    workspaceId,
    searchText,
    groupBy,
    onModeChange,
    workspaceRef,
    statusMapRef,
    priorityMapRef,
    spotMapRef,
    userMapRef,
    tagMapRef,
    taskTagsRef,
  });

  // Sync metadata and refresh grid cells
  useMetadataSync({
    gridRef,
    reduxState,
    metadataLoadedFlags,
    taskTags,
    tagMap,
    taskNotes,
    taskAttachments,
    approvalApprovers,
    stableTaskApprovalInstances,
    approvalMap,
    priorityMap,
    spotMap,
    taskCustomFieldValues,
  });

  // Determine current density
  const [rowDensity, setRowDensity] = useState<'compact' | 'comfortable' | 'spacious'>(() => {
    try { return (localStorage.getItem('wh_workspace_density') as any) || 'comfortable'; } catch { return 'comfortable'; }
  });
  useEffect(() => {
    const handler = (e: any) => {
      const v = e?.detail as any;
      if (v === 'compact' || v === 'comfortable' || v === 'spacious') setRowDensity(v);
    };
    window.addEventListener('wh:rowDensityChanged', handler);
    return () => window.removeEventListener('wh:rowDensityChanged', handler);
  }, []);

  const getRowStyle = useMemo(() => (_params: any) => undefined, []);
  
  // Apply animation class to newly created task rows
  // Include newTaskIds in dependencies to ensure it updates when new tasks are added
  const getRowClass = useMemo(() => (params: any) => {
    if (!params?.data) return '';
    // Try multiple ID field names to handle different data structures
    const taskId = params.data.id || params.data.ID || params.data.Id || params.data.task_id;
    if (!taskId) return '';
    
    // Check for new tasks
    if (isNewTask(taskId)) {
      return 'wh-new-task-row';
    }
    
    return '';
  }, [isNewTask, newTaskIds]);
  
  // Force AG Grid to refresh row classes when new tasks are detected
  useEffect(() => {
    if (newTaskIds.size > 0 && gridRef.current?.api && modulesLoaded) {
      // Wait for grid refresh to complete, then apply animation classes
      // The grid refresh happens with 100ms debounce, so we wait a bit longer
      const timeout = setTimeout(() => {
        try {
          const api = gridRef.current?.api;
          if (!api) return;
          
          // Get all new task row nodes and apply the class directly to DOM elements
          const newRowIds = Array.from(newTaskIds);
          newRowIds.forEach(id => {
            try {
              const rowNode = api.getRowNode?.(String(id));
              if (rowNode) {
                // Get the row element from AG Grid
                const rowElement = (rowNode as any).rowElement;
                if (rowElement && rowElement.classList && !rowElement.classList.contains('wh-new-task-row')) {
                  rowElement.classList.add('wh-new-task-row');
                }
                // Also refresh the row to trigger getRowClass
                api.refreshCells?.({ 
                  rowNodes: [rowNode],
                  force: true 
                });
              }
            } catch (e) {
              // Ignore errors for individual rows
            }
          });
        } catch (e) {
          // Ignore errors, grid might not be ready
          console.debug('Failed to refresh row classes for animation:', e);
        }
      }, 250); // Wait 250ms to ensure grid refresh has completed and rows are rendered
      
      return () => clearTimeout(timeout);
    }
  }, [newTaskIds, modulesLoaded]);

  const getRows = useMemo(
    () => buildGetRows(TasksCache, {
      rowCache,
      workspaceRef,
      searchRef,
      statusMapRef,
      priorityMapRef,
      spotMapRef,
      userMapRef,
      tagMapRef,
      taskTagsRef,
      externalFilterModelRef,
      normalizeFilterModelForQuery,
      setEmptyOverlayVisible,
    }),
    [rowCache, workspaceRef, searchRef, statusMapRef, priorityMapRef, spotMapRef, userMapRef, tagMapRef, taskTagsRef, externalFilterModelRef, setEmptyOverlayVisible]
  );

  useEffect(() => {
    setEmptyOverlayVisible(false);
  }, [workspaceId, searchText]);

  // Grid refresh hook
  const refreshGrid = useGridRefresh({
    modulesLoaded,
    gridRef,
    useClientSide,
    rowCache,
    searchRef,
    workspaceRef,
    statusMapRef,
    priorityMapRef,
    spotMapRef,
    userMapRef,
    tagMapRef,
    taskTagsRef,
    suppressPersistRef,
    debugFilters,
    setClientRows,
  });

  // Refresh approvals when a decision is recorded
  useApprovalRefresh(gridRef, refreshGrid);

  // Use task deletion hook
  const { deleteDialogOpen, setDeleteDialogOpen, taskToDelete, handleDeleteTask, confirmDelete } = useTaskDeletion(gridRef, refreshGrid);

  // Form fill dialog state
  const [formDialogState, setFormDialogState] = useState<{
    open: boolean;
    taskId: number;
    taskName?: string;
    formId: number;
    formVersionId: number;
    existingTaskFormId?: number;
    existingData?: Record<string, any>;
  }>({
    open: false,
    taskId: 0,
    formId: 0,
    formVersionId: 0,
  });

  const handleOpenFormDialog = useCallback((params: {
    taskId: number;
    taskName?: string;
    formId: number;
    formVersionId: number;
    existingTaskFormId?: number;
    existingData?: Record<string, any>;
  }) => {
    setFormDialogState({
      open: true,
      ...params,
    });
  }, []);

  const columnDefs = useMemo(() => buildWorkspaceColumns({
    getUserDisplayName,
    getStatusIcon,
    getAllowedNextStatuses,
    handleChangeStatus,
    statusesLoaded: metadataLoadedFlags.statusesLoaded,
    priorityMap,
    prioritiesLoaded: metadataLoadedFlags.prioritiesLoaded,
    filteredPriorities,
    statusMap,
    usersLoaded: metadataLoadedFlags.usersLoaded,
    getUsersFromIds,
    formatDueDate,
    spotMap,
    spotsLoaded: metadataLoadedFlags.spotsLoaded,
    userMap,
    getDoneStatusId,
    groupField: (useClientSide && groupBy !== 'none') ? groupBy : undefined,
    categoryMap,
    showDescriptions: rowDensity !== 'compact',
    density: rowDensity,
    t,
    approvalMap,
    taskApprovalInstances: stableTaskApprovalInstances,
    tagMap,
    templateMap,
    formMap,
    taskTags,
    taskTagsMap,
    taskUsers,
    tagDisplayMode,
    visibleColumns,
    workspaceCustomFields,
    taskCustomFieldValueMap,
    customFields,
    taskNotes,
    taskAttachments,
    approvalApprovers,
    currentUserId: user?.id,
    onDeleteTask: handleDeleteTask,
    onLogTask: (id: number) => console.info('Log action selected (placeholder) for task', id),
    slaMap,
    taskFormsMap,
    formVersionMap,
    onOpenFormDialog: handleOpenFormDialog,
  } as any), [
    statusMap, priorityMap, spotMap, userMap, tagMap, templateMap, formMap, formVersionMap, taskFormsMap, taskTags, taskUsers,
    getStatusIcon, formatDueDate, getAllowedNextStatuses, handleChangeStatus,
    metadataLoadedFlags.statusesLoaded, metadataLoadedFlags.prioritiesLoaded,
    metadataLoadedFlags.spotsLoaded, metadataLoadedFlags.usersLoaded,
    filteredPriorities, getUsersFromIds, useClientSide, groupBy, categoryMap, rowDensity, tagDisplayMode,
    approvalMap, approvalApprovers, stableTaskApprovalInstances, user?.id, slas, slaMap,
    visibleColumns, workspaceCustomFields, taskCustomFieldValueMap, customFields, taskNotes, taskAttachments, handleDeleteTask,
    getDoneStatusId, handleOpenFormDialog,
  ]);

  const defaultColDef = useMemo(() => createDefaultColDef(), []);

  useEffect(() => {
    applyStoredColumnOrder();
  }, [columnDefs, applyStoredColumnOrder]);

  // Grid grouping hook
  const { autoGroupColumnDef } = useGridGrouping({
    gridRef,
    useClientSide,
    groupBy,
    collapseGroups,
    columnDefs,
    externalFilterModelRef,
    ensureFiltersApplied,
  });

  // Context menu hook
  const getContextMenuItems = useContextMenu({ handleDeleteTask });

  // Workspace change hook
  useWorkspaceChange({
    workspaceId,
    modulesLoaded,
    gridRef,
    refreshGrid,
    exitEditMode,
  });

  // Refresh when global search text changes
  useEffect(() => {
    if (gridRef.current?.api && modulesLoaded) {
      refreshGrid();
    }
  }, [searchText, modulesLoaded, refreshGrid]);

  // Set up task event handlers
  useEffect(() => {
    const cleanup = setupTaskEventHandlers({ refreshGrid, workspaceId });
    return cleanup;
  }, [refreshGrid, workspaceId]);
  
  // Handle row data updates to apply animation classes
  const onRowDataUpdated = useCallback(() => {
    if (newTaskIds.size > 0 && gridRef.current?.api) {
      // Small delay to ensure rows are fully rendered
      setTimeout(() => {
        try {
          const api = gridRef.current?.api;
          if (!api) return;
          
          // Apply animation class to all new task rows
          const newRowIds = Array.from(newTaskIds);
          newRowIds.forEach(id => {
            try {
              // Try both string and number ID formats
              const rowNode = api.getRowNode?.(String(id)) || api.getRowNode?.(id);
              if (rowNode) {
                const rowElement = (rowNode as any).rowElement;
                if (rowElement && rowElement.classList && !rowElement.classList.contains('wh-new-task-row')) {
                  rowElement.classList.add('wh-new-task-row');
                }
              }
            } catch (e) {
              // Ignore errors for individual rows
            }
          });
        } catch (e) {
          // Ignore errors
        }
      }, 100); // Increased delay to ensure rows are rendered
    }
  }, [newTaskIds]);

  // Grid ready hook
  const onGridReady = useGridReady({
    useClientSide,
    getRows,
    refreshGrid,
    applyStoredColumnOrder,
    suppressPersistRef,
    onFiltersChanged,
    onReady,
  });

  // Imperative handle methods
  useImperativeHandleMethods(ref, {
    gridRef,
    applyFilterModelToGrid,
    refreshGrid,
    onFiltersChanged,
  });

  if (!modulesLoaded) {
    return createLoadingSpinner();
  }

  const gridOptions = createGridOptions(useClientSide, clientRows, collapseGroups);

  return createGridContainer(
    <Suspense fallback={createLoadingSpinner()}>
      <div className="relative h-full w-full">
        {emptyOverlayVisible && <EmptyOverlay />}

        <AgGridReact
          key={`rm-${useClientSide ? 'client' : 'infinite'}-${workspaceId}-${groupBy}-${collapseGroups ? 1 : 0}-${rowHeight ?? GRID_CONSTANTS.ROW_HEIGHT}`}
          ref={gridRef}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowHeight={rowHeight ?? GRID_CONSTANTS.ROW_HEIGHT}
          headerHeight={GRID_CONSTANTS.HEADER_HEIGHT}
          rowBuffer={GRID_CONSTANTS.ROW_BUFFER}
          {...gridOptions}
          suppressContextMenu={false}
          getContextMenuItems={getContextMenuItems}
          autoGroupColumnDef={(useClientSide && groupBy !== 'none') ? autoGroupColumnDef : undefined}
          rowSelection={{ 
            mode: 'multiRow', 
            enableClickSelection: false,
            checkboxes: false, // Disabled - using custom checkbox in ID column
            headerCheckbox: false,
          }}
          getRowStyle={getRowStyle}
          getRowClass={getRowClass}
          onGridReady={onGridReady}
          onFirstDataRendered={() => {
            if (!gridRef.current?.api) return;
            onFiltersChanged?.(!!gridRef.current.api.isAnyFilterPresent?.());
            onRowDataUpdated();
          }}
          onRowDataUpdated={onRowDataUpdated}
          onFilterChanged={(e: any) => {
            handleGridFilterChanged({ api: e.api, onFiltersChanged });
            if (!useClientSide) {
              refreshGrid();
            }
          }}
          onSelectionChanged={(e: any) => handleSelectionChanged(e, onSelectionChanged)}
          onRowClicked={(e: any) => handleRowClick(e, onOpenTaskDialog)}
          onColumnMoved={(e: any) => {
            if (e?.finished === false) return;
            handleColumnOrderChanged(e?.columnApi);
          }}
          onColumnPinned={(e: any) => {
            handleColumnOrderChanged(e?.columnApi);
          }}
          onColumnVisible={(e: any) => {
            handleColumnOrderChanged(e?.columnApi);
          }}
          animateRows={false}
          suppressColumnVirtualisation={false}
          suppressNoRowsOverlay={false}
          loading={false}
          suppressScrollOnNewData={true}
          suppressAnimationFrame={false}
        />
      </div>
      
      <DeleteTaskDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        taskName={taskToDelete?.name}
      />

      <FormFillDialog
        open={formDialogState.open}
        onOpenChange={(open) => setFormDialogState(prev => ({ ...prev, open }))}
        taskId={formDialogState.taskId}
        taskName={formDialogState.taskName}
        formId={formDialogState.formId}
        formVersionId={formDialogState.formVersionId}
        existingTaskFormId={formDialogState.existingTaskFormId}
        existingData={formDialogState.existingData}
      />
    </Suspense>
  );
});

export default WorkspaceTable;
