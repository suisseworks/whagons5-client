import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTimeScale } from "./scheduler/hooks/useTimeScale";
import { useSchedulerData } from "./scheduler/hooks/useSchedulerData";
import { useResourceGrouping } from "./scheduler/hooks/useResourceGrouping";
import TimeHeader from "./scheduler/components/TimeHeader";
import TimelineCanvas from "./scheduler/components/TimelineCanvas";
import ResourceList from "./scheduler/components/ResourceList";
import TaskDialog from "./TaskDialog";
import SchedulerControls from "./scheduler/components/SchedulerControls";
import UserSelector from "./scheduler/components/UserSelector";
import { SchedulerErrorBoundary } from "./scheduler/components/SchedulerErrorBoundary";
import { TasksCache } from "@/store/indexedDB/TasksCache";
import { api } from "@/store/api/internalApi";
import { exportToPDF, exportToPNG, exportToExcel } from "./scheduler/utils/exportUtils";
import { UndoRedoManager, type HistoryAction } from "./scheduler/utils/undoRedo";
import { formatLocalDateTime, snapDateToInterval } from "./scheduler/utils/dateTime";
import type { ViewPreset, SchedulerEvent } from "./scheduler/types/scheduler";
import type { AppDispatch, RootState } from "@/store/store";
import type { SchedulerResource } from "./scheduler/types/scheduler";
import toast from "react-hot-toast";
import { Maximize2, Minimize2, Calendar, Clock } from "lucide-react";
import { TaskEvents } from "@/store/eventEmiters/taskEvents";
import { getTasksFromIndexedDB, updateTaskLocally } from "@/store/reducers/tasksSlice";

export default function SchedulerViewTab({ workspaceId }: { workspaceId: string | undefined }) {
  const dispatch = useDispatch<AppDispatch>();
  const [viewPreset, setViewPreset] = useState<ViewPreset>(() => {
    // Restore view preset from localStorage
    try {
      const key = `wh_scheduler_view_preset_${workspaceId || 'all'}`;
      const saved = localStorage.getItem(key);
      if (saved && ['hourAndDay', 'dayAndWeek', 'weekAndMonth', 'monthAndYear'].includes(saved)) {
        return saved as ViewPreset;
      }
    } catch {}
    return "hourAndDay";
  });
  const [baseDate, setBaseDate] = useState(() => {
    // Restore base date from localStorage if it's recent (within 7 days)
    try {
      const key = `wh_scheduler_base_date_${workspaceId || 'all'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        // If saved in old ISO format, discard to avoid UTC shifts
        if (saved.includes('T') || saved.includes('Z')) {
          localStorage.removeItem(key);
          return new Date();
        }

        // New format (YYYY-MM-DD) - parse directly as local
        const [year, month, day] = saved.split('-').map(Number);
        const localSavedDate = new Date(year, month - 1, day);

        const now = new Date();
        const daysDiff = Math.abs((now.getTime() - localSavedDate.getTime()) / (1000 * 60 * 60 * 24));
        if (!isNaN(localSavedDate.getTime()) && daysDiff <= 7) {
          return localSavedDate;
        }
      }
    } catch {}
    return new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<number>>(new Set());
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>(() => {
    // Restore selected users from localStorage
    try {
      const key = `wh_scheduler_selected_users_${workspaceId || 'all'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'number')) {
          console.log('[Scheduler] Restored selected users:', parsed);
          return parsed;
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error restoring selected users:', error);
    }
    return [];
  });
  const [groupBy, setGroupBy] = useState<"none" | "team" | "role">(() => {
    // Restore groupBy from localStorage
    try {
      const key = `wh_scheduler_group_by_${workspaceId || 'all'}`;
      const saved = localStorage.getItem(key);
      if (saved && ['none', 'team', 'role'].includes(saved)) {
        return saved as "none" | "team" | "role";
      }
    } catch {}
    return "team";
  });
  const [editingEvent, setEditingEvent] = useState<SchedulerEvent | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskDialogMode, setTaskDialogMode] = useState<"create" | "edit">("create");
  const [createEventData, setCreateEventData] = useState<{ date: Date; resourceIndex: number } | null>(null);
  const [initialTaskData, setInitialTaskData] = useState<any>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [filters, setFilters] = useState(() => {
    // Restore filters from localStorage
    try {
      const key = `wh_scheduler_filters_${workspaceId || 'all'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          categories: Array.isArray(parsed.categories) ? parsed.categories : [],
          statuses: Array.isArray(parsed.statuses) ? parsed.statuses : [],
          priorities: Array.isArray(parsed.priorities) ? parsed.priorities : [],
          teams: Array.isArray(parsed.teams) ? parsed.teams : [],
        };
      }
    } catch {}
    return {
      categories: [] as number[],
      statuses: [] as number[],
      priorities: [] as number[],
      teams: [] as number[],
    };
  });
  const undoRedoManagerRef = useRef(new UndoRedoManager());
  const schedulerContainerRef = useRef<HTMLDivElement>(null);
  const [undoRedoState, setUndoRedoState] = useState({ canUndo: false, canRedo: false });
  
  // Track pending optimistic updates to prevent RTL from overwriting them
  // Maps taskId to timestamp when update started
  const pendingOptimisticUpdatesRef = useRef<Map<number, number>>(new Map());
  const rowHeight = 60;
  const timeHeaderScrollRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);


  // Get all users for the user selector
  const allUsers = useSelector((state: RootState) => (state.users as any)?.value ?? []);

  // Fetch resources and events from Redux
  const { resources, events, loading } = useSchedulerData(workspaceId);

  // Save selected users to localStorage when they change
  useEffect(() => {
    try {
      const key = `wh_scheduler_selected_users_${workspaceId || 'all'}`;
      if (selectedUserIds.length > 0) {
        localStorage.setItem(key, JSON.stringify(selectedUserIds));
        console.log('[Scheduler] Saved selected users:', selectedUserIds);
      } else {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error('[Scheduler] Error saving selected users:', error);
    }
  }, [selectedUserIds, workspaceId]);

  // Restore selected users when workspace changes
  useEffect(() => {
    try {
      const key = `wh_scheduler_selected_users_${workspaceId || 'all'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'number')) {
          console.log('[Scheduler] Workspace changed, restoring users:', parsed);
          setSelectedUserIds(parsed);
        }
      } else {
        // Reset to empty when switching workspaces with no saved selection
        setSelectedUserIds([]);
      }
    } catch (error) {
      console.error('[Scheduler] Error restoring selected users on workspace change:', error);
    }
  }, [workspaceId]);

  // Auto-select users who have tasks assigned when no users are selected
  // This ensures tasks are visible when first loading the scheduler
  useEffect(() => {
    if (selectedUserIds.length === 0 && events.length > 0) {
      // Get unique user IDs from events (tasks with dates and user assignments)
      const usersWithTasks = [...new Set(events.map(event => event.resourceId))];
      if (usersWithTasks.length > 0) {
        console.log('[Scheduler] Auto-selecting users with tasks:', usersWithTasks);
        setSelectedUserIds(usersWithTasks);
      }
    }
  }, [events, selectedUserIds.length]);

  // Save view preset when it changes
  useEffect(() => {
    try {
      const key = `wh_scheduler_view_preset_${workspaceId || 'all'}`;
      localStorage.setItem(key, viewPreset);
    } catch (error) {
      console.error('[Scheduler] Error saving view preset:', error);
    }
  }, [viewPreset, workspaceId]);

  // Save groupBy when it changes
  useEffect(() => {
    try {
      const key = `wh_scheduler_group_by_${workspaceId || 'all'}`;
      localStorage.setItem(key, groupBy);
    } catch (error) {
      console.error('[Scheduler] Error saving groupBy:', error);
    }
  }, [groupBy, workspaceId]);

  // Save base date when it changes
  useEffect(() => {
    try {
      const key = `wh_scheduler_base_date_${workspaceId || 'all'}`;
      // Save as simple date string (YYYY-MM-DD) to avoid timezone issues
      const dateStr = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`;
      localStorage.setItem(key, dateStr);
    } catch (error) {
      console.error('[Scheduler] Error saving base date:', error);
    }
  }, [baseDate, workspaceId]);

  // Save filters when they change
  useEffect(() => {
    try {
      const key = `wh_scheduler_filters_${workspaceId || 'all'}`;
      const hasFilters = filters.categories.length > 0 || 
                        filters.statuses.length > 0 || 
                        filters.priorities.length > 0 || 
                        filters.teams.length > 0;
      if (hasFilters) {
        localStorage.setItem(key, JSON.stringify(filters));
      } else {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error('[Scheduler] Error saving filters:', error);
    }
  }, [filters, workspaceId]);

  // Listen for task changes to refresh the scheduler
  useEffect(() => {
    const handleTaskChange = (data?: any) => {
      // Check if this is a task we're currently updating optimistically
      // If so, skip the refresh to prevent RTL from overwriting our optimistic update
      if (data && data.id) {
        const taskId = typeof data.id === 'string' ? parseInt(data.id) : data.id;
        const pendingUpdate = pendingOptimisticUpdatesRef.current.get(taskId);
        
        if (pendingUpdate) {
          // Check if the update is still within the grace period (10 seconds)
          const elapsed = Date.now() - pendingUpdate;
          if (elapsed < 10000) {
            console.log('[Scheduler] Skipping refresh for task', taskId, '- pending optimistic update');
            return; // Skip this refresh, our optimistic update takes precedence
          } else {
            // Cleanup stale entry
            pendingOptimisticUpdatesRef.current.delete(taskId);
          }
        }
      }
      
      dispatch(getTasksFromIndexedDB());
      
      // If a new task was created and has user_ids, ensure those users are selected
      if (data && Array.isArray(data.user_ids) && data.user_ids.length > 0) {
        const taskUserIds = data.user_ids;
        setSelectedUserIds((prev) => {
          const newUserIds = new Set(prev);
          let added = false;
          taskUserIds.forEach((userId: number) => {
            if (!newUserIds.has(userId)) {
              newUserIds.add(userId);
              added = true;
            }
          });
          return added ? Array.from(newUserIds) : prev;
        });
      }
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
          console.error('[Scheduler] Error unsubscribing from task event:', error);
        }
      });
    };
  }, [dispatch, workspaceId]);
  
  // Filter resources to only show selected users
  const displayedResources = useMemo(() => {
    if (selectedUserIds.length === 0) {
      return []; // Show empty scheduler if no users selected
    }
    return resources.filter((resource) => selectedUserIds.includes(resource.id));
  }, [resources, selectedUserIds]);

  const { groupedResources } = useResourceGrouping(displayedResources, groupBy);


  // Calculate dimensions with debouncing to prevent flickering
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width - 260, // Account for resource list (260px - modern width)
          height: rect.height - 120, // Account for header and controls
        });
      }
    };

    const debouncedResize = () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      resizeTimer = setTimeout(updateDimensions, 100); // 100ms debounce
    };

    // Initial calculation (no debounce)
    updateDimensions();
    
    window.addEventListener("resize", debouncedResize);
    return () => {
      window.removeEventListener("resize", debouncedResize);
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
    };
  }, []);

  // Calculate timeline width based on time range and preset for proper scrolling
  const getTimelineWidth = useCallback((preset: ViewPreset, viewportWidth: number) => {
    // Define pixels per unit for each preset to ensure readable scale
    const pixelsPerHour = 100; // 100px per hour
    const pixelsPerDay = 150; // 150px per day
    const pixelsPerWeek = 200; // 200px per week
    const pixelsPerMonth = 150; // 150px per month
    
    switch (preset) {
      case "hourAndDay":
        // 24 hours in a day
        return Math.max(24 * pixelsPerHour, viewportWidth);
      case "dayAndWeek":
        // 7 days in a week
        return Math.max(7 * pixelsPerDay, viewportWidth);
      case "weekAndMonth":
        // ~4 weeks in a month
        return Math.max(5 * pixelsPerWeek, viewportWidth);
      case "monthAndYear":
        // 12 months in a year
        return Math.max(12 * pixelsPerMonth, viewportWidth);
      default:
        return viewportWidth;
    }
  }, []);

  const timelineWidth = useMemo(
    () => getTimelineWidth(viewPreset, dimensions.width),
    [viewPreset, dimensions.width, getTimelineWidth]
  );

  const { scale, startDate, endDate } = useTimeScale(
    viewPreset,
    timelineWidth,
    baseDate
  );

  // Synchronize horizontal scrolling between TimeHeader and TimelineCanvas (bidirectional)
  const isScrollingRef = useRef(false);
  const hasScrolledToCurrentTimeRef = useRef(false);
  
  useEffect(() => {
    const timelineScroll = timelineScrollRef.current;
    const headerScroll = timeHeaderScrollRef.current;
    
    if (!timelineScroll || !headerScroll) {
      return;
    }

    // Handler for timeline scroll → sync to header
    const handleTimelineScroll = () => {
      if (!isScrollingRef.current && headerScroll && timelineScroll) {
        isScrollingRef.current = true;
        headerScroll.scrollLeft = timelineScroll.scrollLeft;
        requestAnimationFrame(() => {
          isScrollingRef.current = false;
        });
      }
    };

    // Handler for header scroll → sync to timeline
    const handleHeaderScroll = () => {
      if (!isScrollingRef.current && headerScroll && timelineScroll) {
        isScrollingRef.current = true;
        timelineScroll.scrollLeft = headerScroll.scrollLeft;
        requestAnimationFrame(() => {
          isScrollingRef.current = false;
        });
      }
    };
    
    timelineScroll.addEventListener('scroll', handleTimelineScroll, { passive: true });
    headerScroll.addEventListener('scroll', handleHeaderScroll, { passive: true });
    
    return () => {
      timelineScroll.removeEventListener('scroll', handleTimelineScroll);
      headerScroll.removeEventListener('scroll', handleHeaderScroll);
    };
  }, [dimensions.width, timelineWidth]);
  
  // Auto-scroll to current time only on initial load or when view preset/date changes
  const lastViewPresetRef = useRef(viewPreset);
  const lastBaseDateRef = useRef(baseDate.getTime());
  
  useEffect(() => {
    if (!scale || !timelineScrollRef.current || !timeHeaderScrollRef.current) return;
    if (dimensions.width <= 0 || timelineWidth <= 0) return;
    
    // Check if this is initial load, preset change, or date change
    const isPresetChange = lastViewPresetRef.current !== viewPreset;
    const isDateChange = lastBaseDateRef.current !== baseDate.getTime();
    const shouldScroll = !hasScrolledToCurrentTimeRef.current || isPresetChange || isDateChange;
    
    if (!shouldScroll) return;
    
    // Update refs
    lastViewPresetRef.current = viewPreset;
    lastBaseDateRef.current = baseDate.getTime();
    
    const now = new Date();
    
    // Only auto-scroll if current time is within the visible range
    if (now >= startDate && now <= endDate) {
      // Calculate the x position of current time
      const currentTimeX = scale(now);
      
      // Center the current time in the viewport (or position it 1/4 from the left)
      const viewportWidth = dimensions.width;
      const scrollPosition = Math.max(0, currentTimeX - viewportWidth / 4);
      
      // Scroll both containers
      requestAnimationFrame(() => {
        if (timelineScrollRef.current) {
          timelineScrollRef.current.scrollLeft = scrollPosition;
        }
        if (timeHeaderScrollRef.current) {
          timeHeaderScrollRef.current.scrollLeft = scrollPosition;
        }
      });
    }
    
    // Mark as scrolled
    hasScrolledToCurrentTimeRef.current = true;
  }, [scale, startDate, endDate, dimensions.width, timelineWidth, viewPreset, baseDate]);

  // Filter events based on filters
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Filter by categories
      if (filters.categories.length > 0 && event.categoryId) {
        if (!filters.categories.includes(event.categoryId)) {
          return false;
        }
      }

      // Filter by statuses
      if (filters.statuses.length > 0 && event.statusId) {
        if (!filters.statuses.includes(event.statusId)) {
          return false;
        }
      }

      // Filter by priorities
      if (filters.priorities.length > 0 && event.priorityId) {
        if (!filters.priorities.includes(event.priorityId)) {
          return false;
        }
      }

      // Filter by teams (via resources)
      if (filters.teams.length > 0) {
        const resource = resources.find((r) => r.id === event.resourceId);
        if (!resource || !resource.teamId || !filters.teams.includes(resource.teamId)) {
          return false;
        }
      }

      return true;
    });
  }, [events, filters, resources]);


  // Export handlers
  const handleExportPDF = useCallback(async () => {
    if (schedulerContainerRef.current) {
      await exportToPDF(schedulerContainerRef.current, `scheduler-${new Date().toISOString().split("T")[0]}.pdf`);
    }
  }, []);

  const handleExportPNG = useCallback(async () => {
    if (schedulerContainerRef.current) {
      await exportToPNG(schedulerContainerRef.current, `scheduler-${new Date().toISOString().split("T")[0]}.png`);
    }
  }, []);

  const handleExportExcel = useCallback(() => {
    exportToExcel(filteredEvents, resources, `scheduler-${new Date().toISOString().split("T")[0]}.xlsx`);
  }, [filteredEvents, resources]);

  // Update undo/redo state
  const updateUndoRedoState = useCallback(() => {
    setUndoRedoState({
      canUndo: undoRedoManagerRef.current.canUndo(),
      canRedo: undoRedoManagerRef.current.canRedo(),
    });
  }, []);

  // Initialize undo/redo state
  useEffect(() => {
    updateUndoRedoState();
  }, [updateUndoRedoState]);

  // Undo/Redo handlers
  const handleUndo = useCallback(async () => {
    const action = undoRedoManagerRef.current.undo();
    if (action) {
      // Update local cache immediately (optimistic)
      const task = await TasksCache.getTask(action.taskId.toString());
      if (task) {
        await TasksCache.updateTask(action.taskId.toString(), {
          ...task,
          start_date: formatAsLocalTime(action.previousState.startDate),
          due_date: formatAsLocalTime(action.previousState.endDate),
        });
      }
      updateUndoRedoState();

      // Try API call in background
      try {
        await api.patch(`/tasks/${action.taskId}`, {
          start_date: formatAsLocalTime(action.previousState.startDate),
          due_date: formatAsLocalTime(action.previousState.endDate),
        });
        toast.success("Undo successful");
      } catch (error) {
        console.error("Failed to undo action:", error);
          // Revert the undo
          if (task) {
            await TasksCache.updateTask(action.taskId.toString(), {
              ...task,
              start_date: formatAsLocalTime(action.newState.startDate),
              due_date: formatAsLocalTime(action.newState.endDate),
            });
          }
        undoRedoManagerRef.current.redo();
        updateUndoRedoState();
        toast.error("Failed to undo action");
      }
    }
  }, [updateUndoRedoState]);

  const handleRedo = useCallback(async () => {
    const action = undoRedoManagerRef.current.redo();
    if (action) {
      // Update local cache immediately (optimistic)
      const task = await TasksCache.getTask(action.taskId.toString());
      if (task) {
        await TasksCache.updateTask(action.taskId.toString(), {
          ...task,
          start_date: formatAsLocalTime(action.newState.startDate),
          due_date: formatAsLocalTime(action.newState.endDate),
        });
      }
      updateUndoRedoState();

      // Try API call in background
      try {
        await api.patch(`/tasks/${action.taskId}`, {
          start_date: formatAsLocalTime(action.newState.startDate),
          due_date: formatAsLocalTime(action.newState.endDate),
        });
        toast.success("Redo successful");
      } catch (error) {
        console.error("Failed to redo action:", error);
          // Revert the redo
          if (task) {
            await TasksCache.updateTask(action.taskId.toString(), {
              ...task,
              start_date: formatAsLocalTime(action.previousState.startDate),
              due_date: formatAsLocalTime(action.previousState.endDate),
            });
          }
        undoRedoManagerRef.current.undo();
        updateUndoRedoState();
        toast.error("Failed to redo action");
      }
    }
  }, [updateUndoRedoState]);

  // Keyboard shortcuts for undo/redo and full screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to exit full screen
      if (e.key === "Escape" && isMaximized) {
        e.preventDefault();
        setIsMaximized(false);
        return;
      }
      
      // Undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (undoRedoState.canUndo) {
          handleUndo();
        }
      } 
      // Redo
      else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        if (undoRedoState.canRedo) {
          handleRedo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, undoRedoState, isMaximized]);

  const handlePrev = () => {
    const newDate = new Date(baseDate);
    if (viewPreset === "hourAndDay") {
      newDate.setDate(newDate.getDate() - 1);
    } else if (viewPreset === "dayAndWeek") {
      newDate.setDate(newDate.getDate() - 7);
    } else if (viewPreset === "weekAndMonth") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() - 1);
    }
    setBaseDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(baseDate);
    if (viewPreset === "hourAndDay") {
      newDate.setDate(newDate.getDate() + 1);
    } else if (viewPreset === "dayAndWeek") {
      newDate.setDate(newDate.getDate() + 7);
    } else if (viewPreset === "weekAndMonth") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    setBaseDate(newDate);
  };

  const handleToday = () => {
    setBaseDate(new Date());
  };
  
  // Scroll to current time position
  const scrollToCurrentTime = useCallback(() => {
    if (!scale || !timelineScrollRef.current || !timeHeaderScrollRef.current) return;
    
    const now = new Date();
    
    // Check if current time is within the visible range
    if (now >= startDate && now <= endDate) {
      const currentTimeX = scale(now);
      const viewportWidth = dimensions.width;
      // Position current time 1/4 from left of viewport
      const scrollPosition = Math.max(0, currentTimeX - viewportWidth / 4);
      
      // Smooth scroll to position
      timelineScrollRef.current.scrollTo({ left: scrollPosition, behavior: 'smooth' });
      timeHeaderScrollRef.current.scrollTo({ left: scrollPosition, behavior: 'smooth' });
    } else {
      // If current time is not in view, change to today first
      setBaseDate(new Date());
      toast.success("Jumped to current time");
    }
  }, [scale, startDate, endDate, dimensions.width]);

  // Format date display based on view preset
  const getDateDisplay = () => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    
    if (viewPreset === "hourAndDay") {
      return baseDate.toLocaleDateString(undefined, options);
    } else if (viewPreset === "dayAndWeek") {
      const weekStart = new Date(baseDate);
      const dayOfWeek = weekStart.getDay();
      const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      weekStart.setDate(diff);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (viewPreset === "weekAndMonth") {
      return baseDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } else {
      return baseDate.getFullYear().toString();
    }
  };

  // User selection handlers
  const handleUserToggle = useCallback((userId: number) => {
    setSelectedUserIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  }, []);

  const handleClearAllUsers = useCallback(() => {
    setSelectedUserIds([]);
  }, []);

  return (
    <>
    <div className={`scheduler-container ${isMaximized ? 'fixed inset-0 z-50 bg-background p-4' : 'h-full w-full'} flex flex-col gap-2 min-h-0`}>
      <Card className="flex-1 flex flex-col overflow-hidden min-h-0 shadow-sm border-border/40 bg-background/95">
        <CardContent className="flex-1 min-h-0 flex flex-col pt-3 pb-2 overflow-hidden px-3">
          {/* Controls - Modern Bryntum-inspired toolbar */}
          <div className="scheduler-toolbar flex items-center justify-between gap-3 mb-3 flex-wrap px-1 py-1 rounded-xl bg-muted/20 border border-border/30">
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Navigation button group */}
              <div className="scheduler-toolbar-group inline-flex rounded-lg border border-border/40 bg-background/80 p-0.5 shadow-sm backdrop-blur-sm">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handlePrev} 
                  className="h-8 px-3.5 rounded-md hover:bg-muted/60 transition-all text-xs font-medium"
                >
                  Prev
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleToday} 
                  className="h-8 px-3.5 rounded-md hover:bg-muted/60 transition-all text-xs font-medium"
                >
                  Today
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleNext} 
                  className="h-8 px-3.5 rounded-md hover:bg-muted/60 transition-all text-xs font-medium"
                >
                  Next
                </Button>
              </div>
              
              {/* Date picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-2 px-3.5 shadow-sm hover:shadow border-border/40 hover:border-border/60 transition-all text-xs font-medium bg-background/80">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-foreground">{getDateDisplay()}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4 shadow-xl rounded-xl border-border/40" align="start">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-foreground">Select Date</label>
                    <input
                      type="date"
                      value={`${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`}
                      onChange={(e) => {
                        const [year, month, day] = e.target.value.split('-').map(Number);
                        const selectedDate = new Date(year, month - 1, day);
                        if (!isNaN(selectedDate.getTime())) {
                          setBaseDate(selectedDate);
                        }
                      }}
                      className="w-full px-3 py-2 text-sm border border-border/40 rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      autoFocus
                    />
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Go to Now button */}
              <Button
                size="sm"
                variant="outline"
                onClick={scrollToCurrentTime}
                title="Scroll to current time"
                className="h-8 gap-1.5 px-3 shadow-sm hover:shadow border-border/40 hover:border-destructive/40 transition-all text-xs font-medium bg-background/80 group"
              >
                <Clock className="h-3.5 w-3.5 text-destructive group-hover:animate-pulse" />
                <span>Now</span>
              </Button>
              
              {/* Fullscreen toggle */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsMaximized(!isMaximized)}
                title={isMaximized ? "Exit full screen" : "Full screen"}
                className="h-8 w-8 p-0 shadow-sm hover:shadow border-border/40 hover:border-border/60 transition-all bg-background/80"
              >
                {isMaximized ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </Button>
              
              {/* Separator */}
              <div className="scheduler-toolbar-divider h-6 w-px bg-border/40" />
              
              {/* User selector */}
              <UserSelector
                availableUsers={allUsers}
                selectedUserIds={selectedUserIds}
                onUserToggle={handleUserToggle}
                onClearAll={handleClearAllUsers}
              />
              
              {/* Separator */}
              <div className="scheduler-toolbar-divider h-6 w-px bg-border/40" />
              
              {/* View preset button group */}
              <div className="scheduler-view-toggle inline-flex rounded-lg border border-border/40 bg-background/80 p-0.5 shadow-sm backdrop-blur-sm">
                <Button
                  size="sm"
                  variant={viewPreset === "hourAndDay" ? "default" : "ghost"}
                  onClick={() => setViewPreset("hourAndDay")}
                  className={`scheduler-view-toggle-btn h-8 px-4 rounded-md text-xs font-medium transition-all ${
                    viewPreset === "hourAndDay" 
                      ? "shadow-sm" 
                      : "hover:bg-muted/60"
                  }`}
                >
                  Day
                </Button>
                <Button
                  size="sm"
                  variant={viewPreset === "dayAndWeek" ? "default" : "ghost"}
                  onClick={() => setViewPreset("dayAndWeek")}
                  className={`scheduler-view-toggle-btn h-8 px-4 rounded-md text-xs font-medium transition-all ${
                    viewPreset === "dayAndWeek" 
                      ? "shadow-sm" 
                      : "hover:bg-muted/60"
                  }`}
                >
                  Week
                </Button>
                <Button
                  size="sm"
                  variant={viewPreset === "weekAndMonth" ? "default" : "ghost"}
                  onClick={() => setViewPreset("weekAndMonth")}
                  className={`scheduler-view-toggle-btn h-8 px-4 rounded-md text-xs font-medium transition-all ${
                    viewPreset === "weekAndMonth" 
                      ? "shadow-sm" 
                      : "hover:bg-muted/60"
                  }`}
                >
                  Month
                </Button>
              </div>
            </div>
            
            {/* Right side controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <SchedulerControls
                onExportPDF={handleExportPDF}
                onExportPNG={handleExportPNG}
                onExportExcel={handleExportExcel}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={undoRedoState.canUndo}
                canRedo={undoRedoState.canRedo}
                onFilterChange={setFilters}
                filters={filters}
                availableCategories={useSelector((state: any) => (state.categories as any)?.value ?? [])}
                availableStatuses={useSelector((state: any) => (state.statuses as any)?.value ?? [])}
                availablePriorities={useSelector((state: any) => (state.priorities as any)?.value ?? [])}
                availableTeams={useSelector((state: any) => (state.teams as any)?.value ?? [])}
              />
            </div>
          </div>

          {/* Scheduler Content */}
          <div
            ref={containerRef}
            className="scheduler-main flex-1 min-h-0 flex flex-row overflow-hidden rounded-xl border border-border/30 bg-background shadow-sm"
          >
            <div ref={schedulerContainerRef} className="flex-1 min-h-0 flex flex-row overflow-hidden">
            {/* Resource List */}
            {loading ? (
              <div className="flex items-center justify-center p-4">
                <div className="text-sm text-muted-foreground">Loading resources...</div>
              </div>
            ) : selectedUserIds.length === 0 ? (
              <div className="flex items-center justify-center p-8 text-center">
                <div className="max-w-sm">
                  <p className="text-sm text-muted-foreground mb-2">
                    No users selected
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Click the "Users" button above to select users to display in the scheduler
                  </p>
                </div>
              </div>
            ) : (
              <ResourceList
                resources={displayedResources}
                rowHeight={rowHeight}
                selectedResourceIds={selectedResourceIds}
                onResourceSelect={(id) => {
                  const newSet = new Set(selectedResourceIds);
                  if (newSet.has(id)) {
                    newSet.delete(id);
                  } else {
                    newSet.add(id);
                  }
                  setSelectedResourceIds(newSet);
                }}
              />
            )}

            {/* Timeline Area */}
            <div className="flex-1 min-h-0 flex flex-col">
              {dimensions.width > 0 && dimensions.height > 0 && (
                <SchedulerErrorBoundary>
                  {/* Time Header - with horizontal scroll sync */}
                  <div 
                    ref={timeHeaderScrollRef}
                    className="border-b overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                    style={{ width: dimensions.width }}
                  >
                    <div style={{ width: timelineWidth + 80 }}>
                      <TimeHeader
                        scale={scale}
                        height={40}
                        preset={viewPreset}
                        startDate={startDate}
                        endDate={endDate}
                      />
                    </div>
                  </div>

                  {/* Timeline Canvas - scrollable with explicit height for always-visible scrollbar */}
                  <div 
                    ref={timelineScrollRef}
                    className="flex-1 overflow-auto"
                    style={{ width: dimensions.width, height: dimensions.height - 40, maxHeight: dimensions.height - 40 }}
                  >
                    <div style={{ width: timelineWidth + 80 }}>
                      <TimelineCanvas
                        scale={scale}
                        width={timelineWidth}
                        height={Math.max(displayedResources.length * rowHeight, dimensions.height - 40)}
                        preset={viewPreset}
                        startDate={startDate}
                        endDate={endDate}
                        resources={displayedResources}
                        events={filteredEvents}
                        rowHeight={rowHeight}
                        selectedCell={selectedCell}
                        onEventSelect={(event) => {
                          // Single click shows the tooltip/popover - handled in TimelineCanvas
                        }}
                        onEventDoubleClick={(event) => {
                        // Fetch the full task data for editing
                        TasksCache.getTask(event.taskId.toString()).then((task) => {
                          if (task) {
                            setEditingEvent(event);
                            setInitialTaskData(task);
                            setTaskDialogMode("edit");
                            setIsTaskDialogOpen(true);
                          }
                        });
                      }}
                      onEmptySpaceClick={(date, resourceIndex, colIndex) => {
                        // The resourceIndex comes from the canvas which uses displayedResources
                        const resourcesToUse = displayedResources.length > 0 ? displayedResources : resources;
                        
                        if (resourcesToUse.length === 0) {
                          toast.error("Please select at least one user to create a task");
                          return;
                        }
                        
                        if (resourceIndex >= 0 && resourceIndex < resourcesToUse.length) {
                          const resource = resourcesToUse[resourceIndex];
                          
                          console.log('[Scheduler] Empty space clicked:', {
                            resourceIndex,
                            resource,
                            resourceId: resource.id,
                            resourceName: resource.name,
                            displayedResourcesCount: displayedResources.length,
                            isUserAlreadySelected: selectedUserIds.includes(resource.id),
                          });
                          
                          // Ensure the clicked user is in selectedUserIds
                          // This is critical so the task will be visible after creation
                          if (!selectedUserIds.includes(resource.id)) {
                            console.log('[Scheduler] Auto-selecting user', resource.id, 'to show task after creation');
                            setSelectedUserIds((prev) => [...prev, resource.id]);
                          }
                          
                          // Round to nearest 15 minutes
                          // Ensure we're working with local time values explicitly
                          const clickedDate = new Date(date);
                          const year = clickedDate.getFullYear();
                          const month = clickedDate.getMonth();
                          const day = clickedDate.getDate();
                          const hours = clickedDate.getHours();
                          const mins = clickedDate.getMinutes();
                          const secs = clickedDate.getSeconds();
                          
                          // Create a new Date object with explicit local time values
                          // This ensures no timezone conversion happens
                          const start = new Date(year, month, day, hours, mins, secs);
                          const snappedStart = snapDateToInterval(start, 15 * 60 * 1000);
                          
                          const end = new Date(snappedStart);
                          end.setHours(end.getHours() + 1); // Default 1 hour duration
                          
                          // Create initial task data with start_date, due_date, user_ids, and workspace_id
                          const initialData = {
                            start_date: formatLocalDateTime(snappedStart),
                            due_date: formatLocalDateTime(end),
                            user_ids: [resource.id],
                            workspace_id: workspaceId ? parseInt(workspaceId) : undefined,
                          };
                          
                          console.log('[Scheduler] ⏰ Creating task at clicked time:', {
                            clickedDate: date,
                            clickedTime: `${hours}:${String(mins).padStart(2, '0')}`,
                            roundedTime: `${snappedStart.getHours()}:${String(snappedStart.getMinutes()).padStart(2, '0')}`,
                            formatted_start_date: initialData.start_date,
                            formatted_due_date: initialData.due_date,
                          });
                          
                          // Set selected cell for visual feedback
                          setSelectedCell({ row: resourceIndex, col: colIndex });
                          
                          setInitialTaskData(initialData);
                          setCreateEventData({ date, resourceIndex });
                          setEditingEvent(null);
                          setTaskDialogMode("create");
                          setIsTaskDialogOpen(true);
                        }
                      }}
                      onEventMove={async (event, newStartDate, newEndDate) => {
                        // 1. Get current task state FIRST for undo/rollback
                        const task = await TasksCache.getTask(event.taskId.toString());
                        if (!task) {
                          toast.error("Task not found");
                          return;
                        }

                        const previousState = {
                          startDate: task.start_date ? new Date(task.start_date) : event.startDate,
                          endDate: task.due_date ? new Date(task.due_date) : event.endDate,
                        };

                        // Track this as a pending optimistic update to prevent RTL overwrites
                        pendingOptimisticUpdatesRef.current.set(event.taskId, Date.now());

                        // 2. Optimistically update UI (cache + Redux) immediately
                        await TasksCache.updateTask(event.taskId.toString(), {
                          ...task,
                          start_date: formatLocalDateTime(newStartDate),
                          due_date: formatLocalDateTime(newEndDate),
                        });
                        
                        // Also update Redux store so useSchedulerData recalculates events correctly
                        dispatch(updateTaskLocally({
                          id: event.taskId,
                          updates: {
                            start_date: formatLocalDateTime(newStartDate),
                            due_date: formatLocalDateTime(newEndDate),
                          }
                        }));

                        // 3. Record action for undo/redo before API call
                        undoRedoManagerRef.current.push({
                          type: "move",
                          eventId: event.id,
                          taskId: event.taskId,
                          previousState,
                          newState: {
                            startDate: newStartDate,
                            endDate: newEndDate,
                          },
                        });
                        updateUndoRedoState();

                        // 4. Try API call in background
                        try {
                          await api.patch(`/tasks/${event.taskId}`, {
                            start_date: formatLocalDateTime(newStartDate),
                            due_date: formatLocalDateTime(newEndDate),
                          });
                          // Success - clear the pending update after a short delay to allow RTL to settle
                          setTimeout(() => {
                            pendingOptimisticUpdatesRef.current.delete(event.taskId);
                          }, 2000);
                        } catch (error) {
                          console.error("Failed to update task:", error);
                          
                          // Clear pending update immediately on error
                          pendingOptimisticUpdatesRef.current.delete(event.taskId);
                          
                          // 5. Rollback on failure (cache + Redux)
                          await TasksCache.updateTask(event.taskId.toString(), {
                            ...task,
                            start_date: formatLocalDateTime(previousState.startDate),
                            due_date: formatLocalDateTime(previousState.endDate),
                          });
                          
                          // Rollback Redux state
                          dispatch(updateTaskLocally({
                            id: event.taskId,
                            updates: {
                              start_date: formatLocalDateTime(previousState.startDate),
                              due_date: formatLocalDateTime(previousState.endDate),
                            }
                          }));
                          
                          // Remove from undo stack
                          undoRedoManagerRef.current.undo();
                          updateUndoRedoState();
                          
                          toast.error("Failed to move task. Changes reverted.");
                        }
                      }}
                      onEventResize={async (event, newStartDate, newEndDate) => {
                        // 1. Get current task state FIRST for undo/rollback
                        const task = await TasksCache.getTask(event.taskId.toString());
                        if (!task) {
                          toast.error("Task not found");
                          return;
                        }

                        const previousState = {
                          startDate: task.start_date ? new Date(task.start_date) : event.startDate,
                          endDate: task.due_date ? new Date(task.due_date) : event.endDate,
                        };

                        // Track this as a pending optimistic update to prevent RTL overwrites
                        pendingOptimisticUpdatesRef.current.set(event.taskId, Date.now());

                        // 2. Optimistically update UI (cache + Redux) immediately
                        await TasksCache.updateTask(event.taskId.toString(), {
                          ...task,
                          start_date: formatLocalDateTime(newStartDate),
                          due_date: formatLocalDateTime(newEndDate),
                        });
                        
                        // Also update Redux store so useSchedulerData recalculates events correctly
                        dispatch(updateTaskLocally({
                          id: event.taskId,
                          updates: {
                            start_date: formatLocalDateTime(newStartDate),
                            due_date: formatLocalDateTime(newEndDate),
                          }
                        }));

                        // 3. Record action for undo/redo before API call
                        undoRedoManagerRef.current.push({
                          type: "resize",
                          eventId: event.id,
                          taskId: event.taskId,
                          previousState,
                          newState: {
                            startDate: newStartDate,
                            endDate: newEndDate,
                          },
                        });
                        updateUndoRedoState();

                        // 4. Try API call in background
                        try {
                          await api.patch(`/tasks/${event.taskId}`, {
                            start_date: formatLocalDateTime(newStartDate),
                            due_date: formatLocalDateTime(newEndDate),
                          });
                          // Success - clear the pending update after a short delay to allow RTL to settle
                          setTimeout(() => {
                            pendingOptimisticUpdatesRef.current.delete(event.taskId);
                          }, 2000);
                        } catch (error) {
                          console.error("Failed to resize task:", error);
                          
                          // Clear pending update immediately on error
                          pendingOptimisticUpdatesRef.current.delete(event.taskId);
                          
                          // 5. Rollback on failure (cache + Redux)
                          await TasksCache.updateTask(event.taskId.toString(), {
                            ...task,
                            start_date: formatLocalDateTime(previousState.startDate),
                            due_date: formatLocalDateTime(previousState.endDate),
                          });
                          
                          // Rollback Redux state
                          dispatch(updateTaskLocally({
                            id: event.taskId,
                            updates: {
                              start_date: formatLocalDateTime(previousState.startDate),
                              due_date: formatLocalDateTime(previousState.endDate),
                            }
                          }));
                          
                          // Remove from undo stack
                          undoRedoManagerRef.current.undo();
                          updateUndoRedoState();
                          
                          toast.error("Failed to resize task. Changes reverted.");
                        }
                      }}
                    />
                    </div>
                  </div>
                </SchedulerErrorBoundary>
              )}
            </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Dialog */}
      <TaskDialog
        open={isTaskDialogOpen}
        onOpenChange={(open) => {
          setIsTaskDialogOpen(open);
          if (!open) {
            setEditingEvent(null);
            setCreateEventData(null);
            setInitialTaskData(null);
            setSelectedCell(null); // Clear cell selection when dialog closes
            // Note: TaskEvents listener already handles refreshing tasks when created/updated
          }
        }}
        mode={taskDialogMode}
        workspaceId={workspaceId ? parseInt(workspaceId) : undefined}
        task={taskDialogMode === "edit" && editingEvent ? initialTaskData : (taskDialogMode === "create" ? initialTaskData : null)}
      />
    </div>
    </>
  );
}
