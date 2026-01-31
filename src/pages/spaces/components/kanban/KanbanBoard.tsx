import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { AppDispatch, RootState } from '@/store/store';
import type { KanbanBoardProps, KanbanFilters } from './types/kanban.types';
import type { Task } from '@/store/types';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';
import KanbanControls from './KanbanControls';
import KanbanSwimLane from './KanbanSwimLane';
import TaskDialog from '../TaskDialog';
import { TasksCache } from '@/store/indexedDB/TasksCache';
import { api } from '@/store/api/internalApi';
import { TaskEvents } from '@/store/eventEmiters/taskEvents';
import { getTasksFromIndexedDB } from '@/store/reducers/tasksSlice';
import { useKanbanFilters } from './hooks/useKanbanFilters';
import { useKanbanGrouping } from './hooks/useKanbanGrouping';
import { exportToExcel } from './utils/exportUtils';
import toast from 'react-hot-toast';

export default function KanbanBoard({ workspaceId }: KanbanBoardProps) {
  const dispatch = useDispatch<AppDispatch>();
  
  // Get data from Redux
  const tasks = useSelector((state: RootState) => (state.tasks as any)?.value ?? []);
  const statuses = useSelector((state: RootState) => (state.statuses as any)?.value ?? []);
  const categories = useSelector((state: RootState) => (state.categories as any)?.value ?? []);
  const priorities = useSelector((state: RootState) => (state.priorities as any)?.value ?? []);
  const teams = useSelector((state: RootState) => (state.teams as any)?.value ?? []);
  const users = useSelector((state: RootState) => (state.users as any)?.value ?? []);
  const loading = useSelector((state: RootState) => (state.tasks as any)?.loading ?? false);

  // Preferences key
  const KANBAN_PREFS_KEY = `wh_kanban_prefs_${workspaceId || 'all'}`;

  // Load preferences from localStorage
  const loadPreferences = () => {
    try {
      const saved = localStorage.getItem(KANBAN_PREFS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('[Kanban] Error loading preferences:', error);
    }
    return {
      viewMode: 'compact',
      filters: { categories: [], statuses: [], priorities: [], teams: [], search: '' },
      groupBy: 'none',
    };
  };

  // Local state
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskDialogMode, setTaskDialogMode] = useState<'create' | 'edit'>('edit');
  const [preferences, setPreferences] = useState(loadPreferences);
  const [filters, setFilters] = useState<KanbanFilters>(preferences.filters);
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>(preferences.viewMode);
  const [groupBy, setGroupBy] = useState<'none' | 'priority' | 'team' | 'assignee'>(preferences.groupBy);

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    })
  );

  // Save preferences to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(KANBAN_PREFS_KEY, JSON.stringify({
        viewMode,
        filters,
        groupBy,
      }));
    } catch (error) {
      console.error('[Kanban] Error saving preferences:', error);
    }
  }, [viewMode, filters, groupBy, KANBAN_PREFS_KEY]);

  // Filter tasks by workspace
  const workspaceTasks = useMemo(() => {
    if (!workspaceId) return tasks;
    return tasks.filter((task: Task) => task.workspace_id === parseInt(workspaceId));
  }, [tasks, workspaceId]);

  // Apply filters using the hook
  const filteredTasks = useKanbanFilters(workspaceTasks, filters);

  // Group tasks by selected grouping (for swim lanes)
  const taskGroups = useKanbanGrouping(filteredTasks, groupBy, priorities, teams, users);

  // Group filtered tasks by status (for regular columns)
  const tasksByStatus = useMemo(() => {
    const grouped: Record<number, Task[]> = {};
    
    // Initialize all status groups
    statuses.forEach((status: any) => {
      grouped[status.id] = [];
    });

    // Group filtered tasks
    filteredTasks.forEach((task: Task) => {
      if (grouped[task.status_id]) {
        grouped[task.status_id].push(task);
      }
    });

    return grouped;
  }, [filteredTasks, statuses]);

  // Sort statuses by a logical order (initial -> working -> paused -> finished)
  const sortedStatuses = useMemo(() => {
    return [...statuses].sort((a: any, b: any) => {
      // Initial statuses first
      if (a.initial && !b.initial) return -1;
      if (!a.initial && b.initial) return 1;
      
      // Then by action type
      const actionOrder: Record<string, number> = {
        'NONE': 1,
        'WORKING': 2,
        'PAUSED': 3,
        'FINISHED': 4,
      };
      
      const orderA = actionOrder[a.action] || 0;
      const orderB = actionOrder[b.action] || 0;
      
      return orderA - orderB;
    });
  }, [statuses]);

  // Listen for task changes to refresh the board
  useEffect(() => {
    const handleTaskChange = () => {
      dispatch(getTasksFromIndexedDB());
    };

    const unsubscribers = [
      TaskEvents.on(TaskEvents.EVENTS.TASK_CREATED, handleTaskChange),
      TaskEvents.on(TaskEvents.EVENTS.TASK_UPDATED, handleTaskChange),
      TaskEvents.on(TaskEvents.EVENTS.TASK_DELETED, handleTaskChange),
      TaskEvents.on(TaskEvents.EVENTS.TASKS_BULK_UPDATE, handleTaskChange),
    ];

    return () => {
      unsubscribers.forEach((unsub) => {
        try {
          unsub();
        } catch (error) {
          console.error('[Kanban] Error unsubscribing from task event:', error);
        }
      });
    };
  }, [dispatch]);

  // Drag start handler
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const taskId = Number(event.active.id);
    const task = tasks.find((t: Task) => t.id === taskId);
    setActiveTask(task || null);
  }, [tasks]);

  // Drag end handler with optimistic updates
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveTask(null);

    if (!over || active.id === over.id) return;

    const taskId = Number(active.id);
    const newStatusId = Number(over.id);

    // 1. Get current task for rollback
    const task = await TasksCache.getTask(taskId.toString());
    if (!task) {
      toast.error('Task not found');
      return;
    }

    const previousStatusId = task.status_id;

    // Don't update if status hasn't changed
    if (previousStatusId === newStatusId) return;

    // 2. Optimistic update (immediate UI feedback)
    await TasksCache.updateTask(taskId.toString(), {
      ...task,
      status_id: newStatusId,
    });

    // 3. API call in background
    try {
      await api.patch(`/tasks/${taskId}`, { status_id: newStatusId });
      toast.success('Task moved successfully');
    } catch (error) {
      console.error('Failed to move task:', error);
      
      // 4. Rollback on failure
      await TasksCache.updateTask(taskId.toString(), {
        ...task,
        status_id: previousStatusId,
      });
      
      toast.error('Failed to move task. Changes reverted.');
    }
  }, []);

  // Handle task click
  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task);
    setTaskDialogMode('edit');
    setIsTaskDialogOpen(true);
  }, []);

  // Handle dialog close
  const handleDialogClose = useCallback((open: boolean) => {
    setIsTaskDialogOpen(open);
    if (!open) {
      setSelectedTask(null);
      // Refresh tasks after dialog closes
      setTimeout(() => {
        dispatch(getTasksFromIndexedDB());
      }, 100);
    }
  }, [dispatch]);

  // Handle export
  const handleExport = useCallback(() => {
    try {
      const filename = `kanban-board-${new Date().toISOString().split('T')[0]}.xlsx`;
      exportToExcel(filteredTasks, statuses, filename);
      toast.success('Board exported successfully');
    } catch (error) {
      console.error('Failed to export board:', error);
      toast.error('Failed to export board');
    }
  }, [filteredTasks, statuses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  if (sortedStatuses.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-muted-foreground">
          No statuses configured. Please configure statuses in settings.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-background via-muted/5 to-background">
      {/* Controls - Modern floating style */}
      <div className="px-6 pt-6 pb-4">
        <div className="bg-card/80 backdrop-blur-md rounded-xl border border-border/40 shadow-lg p-4">
          <KanbanControls
            filters={filters}
            onFilterChange={setFilters}
            availableCategories={categories}
            availableStatuses={statuses}
            availablePriorities={priorities}
            availableTeams={teams}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            onExport={handleExport}
          />
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Render swim lanes if grouping is enabled */}
        {groupBy !== 'none' ? (
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-4">
              {taskGroups.map((group) => (
                <KanbanSwimLane
                  key={group.id}
                  group={group}
                  statuses={sortedStatuses}
                  onTaskClick={handleTaskClick}
                />
              ))}
            </div>
          </div>
        ) : (
          /* Regular column view - Modern spacing */
          <div className="flex gap-5 overflow-x-auto flex-1 px-6 pb-6">
            {sortedStatuses.map((status: any) => (
              <KanbanColumn
                key={status.id}
                status={status}
                tasks={tasksByStatus[status.id] || []}
                onTaskClick={handleTaskClick}
              />
            ))}
          </div>
        )}

        {/* Drag overlay with modern shadow effect */}
        <DragOverlay>
          {activeTask && (
            <div className="rotate-2 scale-105 opacity-90">
              <div className="shadow-2xl ring-2 ring-primary/20 rounded-lg">
                <KanbanCard task={activeTask} onClick={() => {}} />
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Task Dialog */}
      <TaskDialog
        open={isTaskDialogOpen}
        onOpenChange={handleDialogClose}
        mode={taskDialogMode}
        workspaceId={workspaceId ? parseInt(workspaceId) : undefined}
        task={selectedTask}
      />
    </div>
  );
}
