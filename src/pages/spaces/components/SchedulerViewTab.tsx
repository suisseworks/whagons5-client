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
import type { ViewPreset, SchedulerEvent } from "./scheduler/types/scheduler";
import type { AppDispatch, RootState } from "@/store/store";
import type { SchedulerResource } from "./scheduler/types/scheduler";
import toast from "react-hot-toast";
import { Maximize2, Minimize2, Calendar } from "lucide-react";

export default function SchedulerViewTab({ workspaceId }: { workspaceId: string | undefined }) {
  const dispatch = useDispatch<AppDispatch>();
  const [viewPreset, setViewPreset] = useState<ViewPreset>("hourAndDay");
  const [baseDate, setBaseDate] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<number>>(new Set());
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [groupBy, setGroupBy] = useState<"none" | "team" | "role">("team");
  const [editingEvent, setEditingEvent] = useState<SchedulerEvent | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskDialogMode, setTaskDialogMode] = useState<"create" | "edit">("create");
  const [createEventData, setCreateEventData] = useState<{ date: Date; resourceIndex: number } | null>(null);
  const [initialTaskData, setInitialTaskData] = useState<any>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [filters, setFilters] = useState({
    categories: [] as number[],
    statuses: [] as number[],
    priorities: [] as number[],
    teams: [] as number[],
  });
  const undoRedoManagerRef = useRef(new UndoRedoManager());
  const schedulerContainerRef = useRef<HTMLDivElement>(null);
  const [undoRedoState, setUndoRedoState] = useState({ canUndo: false, canRedo: false });
  const rowHeight = 60;
  const timeHeaderScrollRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // Debug: Log when TaskDialog state changes
  useEffect(() => {
    console.log('[SchedulerViewTab] TaskDialog state:', {
      isOpen: isTaskDialogOpen,
      mode: taskDialogMode,
      hasInitialData: !!initialTaskData,
      initialData: initialTaskData,
    });
  }, [isTaskDialogOpen, taskDialogMode, initialTaskData]);

  // Get all users for the user selector
  const allUsers = useSelector((state: RootState) => (state.users as any)?.value ?? []);

  // Fetch resources and events from Redux
  const { resources, events, loading } = useSchedulerData(workspaceId);
  
  // Filter resources to only show selected users
  const displayedResources = useMemo(() => {
    if (selectedUserIds.length === 0) {
      return []; // Show empty scheduler if no users selected
    }
    return resources.filter((resource) => selectedUserIds.includes(resource.id));
  }, [resources, selectedUserIds]);

  const { groupedResources } = useResourceGrouping(displayedResources, groupBy);

  // Calculate dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width - 200, // Account for resource list (200px)
          height: rect.height - 120, // Account for header and controls
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
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

  // Synchronize horizontal scrolling between TimeHeader and TimelineCanvas
  useEffect(() => {
    const timelineScroll = timelineScrollRef.current;
    const headerScroll = timeHeaderScrollRef.current;
    
    if (!timelineScroll || !headerScroll) return;

    const handleTimelineScroll = () => {
      if (headerScroll) {
        headerScroll.scrollLeft = timelineScroll.scrollLeft;
      }
    };

    timelineScroll.addEventListener('scroll', handleTimelineScroll);
    return () => {
      timelineScroll.removeEventListener('scroll', handleTimelineScroll);
    };
  }, []);

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
          start_date: action.previousState.startDate.toISOString(),
          due_date: action.previousState.endDate.toISOString(),
        });
      }
      updateUndoRedoState();

      // Try API call in background
      try {
        await api.patch(`/tasks/${action.taskId}`, {
          start_date: action.previousState.startDate.toISOString(),
          due_date: action.previousState.endDate.toISOString(),
        });
        toast.success("Undo successful");
      } catch (error) {
        console.error("Failed to undo action:", error);
        // Revert the undo
        if (task) {
          await TasksCache.updateTask(action.taskId.toString(), {
            ...task,
            start_date: action.newState.startDate.toISOString(),
            due_date: action.newState.endDate.toISOString(),
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
          start_date: action.newState.startDate.toISOString(),
          due_date: action.newState.endDate.toISOString(),
        });
      }
      updateUndoRedoState();

      // Try API call in background
      try {
        await api.patch(`/tasks/${action.taskId}`, {
          start_date: action.newState.startDate.toISOString(),
          due_date: action.newState.endDate.toISOString(),
        });
        toast.success("Redo successful");
      } catch (error) {
        console.error("Failed to redo action:", error);
        // Revert the redo
        if (task) {
          await TasksCache.updateTask(action.taskId.toString(), {
            ...task,
            start_date: action.previousState.startDate.toISOString(),
            due_date: action.previousState.endDate.toISOString(),
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
    <div className={`${isMaximized ? 'fixed inset-0 z-50 bg-background p-4' : 'h-full w-full'} flex flex-col gap-2 min-h-0`}>
      <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
        <CardContent className="flex-1 min-h-0 flex flex-col pt-3 pb-1 overflow-hidden px-3">
          {/* Controls */}
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={handlePrev} className="min-w-[60px]">
                Prev
              </Button>
              <Button size="sm" variant="outline" onClick={handleToday} className="min-w-[60px]">
                Today
              </Button>
              <Button size="sm" variant="outline" onClick={handleNext} className="min-w-[60px]">
                Next
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Calendar className="h-4 w-4" />
                    {getDateDisplay()}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Date</label>
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
                      className="w-full px-3 py-2 text-sm border rounded-md"
                      autoFocus
                    />
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsMaximized(!isMaximized)}
                title={isMaximized ? "Exit full screen" : "Full screen"}
                className="flex-shrink-0"
              >
                {isMaximized ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              <UserSelector
                availableUsers={allUsers}
                selectedUserIds={selectedUserIds}
                onUserToggle={handleUserToggle}
                onClearAll={handleClearAllUsers}
              />
              <Button
                size="sm"
                variant={viewPreset === "hourAndDay" ? "default" : "secondary"}
                onClick={() => setViewPreset("hourAndDay")}
                className="min-w-[50px]"
              >
                Day
              </Button>
              <Button
                size="sm"
                variant={viewPreset === "dayAndWeek" ? "default" : "secondary"}
                onClick={() => setViewPreset("dayAndWeek")}
                className="min-w-[55px]"
              >
                Week
              </Button>
              <Button
                size="sm"
                variant={viewPreset === "weekAndMonth" ? "default" : "secondary"}
                onClick={() => setViewPreset("weekAndMonth")}
                className="min-w-[60px]"
              >
                Month
              </Button>
            </div>
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
            className="flex-1 min-h-0 flex flex-row overflow-hidden"
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
                    <TimeHeader
                      scale={scale}
                      height={40}
                      preset={viewPreset}
                      startDate={startDate}
                      endDate={endDate}
                    />
                  </div>

                  {/* Timeline Canvas - scrollable */}
                  <div 
                    ref={timelineScrollRef}
                    className="flex-1 overflow-auto"
                    style={{ width: dimensions.width }}
                  >
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
                      onEventSelect={(event) => {
                        console.log("Event selected:", event);
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
                      onEmptySpaceClick={(date, resourceIndex) => {
                        console.log('[SchedulerViewTab] onEmptySpaceClick called:', { 
                          date, 
                          resourceIndex, 
                          displayedResourcesLength: displayedResources.length,
                          resourcesLength: resources.length,
                          selectedUserIds,
                          displayedResources: displayedResources.map(r => ({ id: r.id, name: r.name })),
                          allResources: resources.map(r => ({ id: r.id, name: r.name })),
                        });
                        
                        // The resourceIndex comes from the canvas which uses displayedResources
                        // If displayedResources is empty but we have resources, use resources instead
                        // This can happen if selectedUserIds is empty but resources exist
                        const resourcesToUse = displayedResources.length > 0 ? displayedResources : resources;
                        
                        if (resourcesToUse.length === 0) {
                          console.warn('[SchedulerViewTab] No resources available to create task');
                          toast.error("Please select at least one user to create a task");
                          return;
                        }
                        
                        if (resourceIndex >= 0 && resourceIndex < resourcesToUse.length) {
                          const resource = resourcesToUse[resourceIndex];
                          // Round to nearest 15 minutes
                          const start = new Date(date);
                          const minutes = Math.round(start.getMinutes() / 15) * 15;
                          start.setMinutes(minutes, 0, 0);
                          
                          const end = new Date(start);
                          end.setHours(end.getHours() + 1); // Default 1 hour duration
                          
                          // Create initial task data with start_date and due_date
                          const initialData = {
                            start_date: start.toISOString(),
                            due_date: end.toISOString(),
                            user_ids: [resource.id],
                          };
                          
                          console.log('[SchedulerViewTab] Opening TaskDialog with:', initialData);
                          setInitialTaskData(initialData);
                          setCreateEventData({ date, resourceIndex });
                          setEditingEvent(null);
                          setTaskDialogMode("create");
                          setIsTaskDialogOpen(true);
                          console.log('[SchedulerViewTab] TaskDialog state set to open');
                        } else {
                          console.warn('[SchedulerViewTab] Invalid resourceIndex:', resourceIndex, 'resourcesToUse.length:', resourcesToUse.length);
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

                        // 2. Optimistically update UI (cache) immediately
                        await TasksCache.updateTask(event.taskId.toString(), {
                          ...task,
                          start_date: newStartDate.toISOString(),
                          due_date: newEndDate.toISOString(),
                        });

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
                            start_date: newStartDate.toISOString(),
                            due_date: newEndDate.toISOString(),
                          });
                        } catch (error) {
                          console.error("Failed to update task:", error);
                          
                          // 5. Rollback on failure
                          await TasksCache.updateTask(event.taskId.toString(), {
                            ...task,
                            start_date: previousState.startDate.toISOString(),
                            due_date: previousState.endDate.toISOString(),
                          });
                          
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

                        // 2. Optimistically update UI (cache) immediately
                        await TasksCache.updateTask(event.taskId.toString(), {
                          ...task,
                          start_date: newStartDate.toISOString(),
                          due_date: newEndDate.toISOString(),
                        });

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
                            start_date: newStartDate.toISOString(),
                            due_date: newEndDate.toISOString(),
                          });
                        } catch (error) {
                          console.error("Failed to resize task:", error);
                          
                          // 5. Rollback on failure
                          await TasksCache.updateTask(event.taskId.toString(), {
                            ...task,
                            start_date: previousState.startDate.toISOString(),
                            due_date: previousState.endDate.toISOString(),
                          });
                          
                          // Remove from undo stack
                          undoRedoManagerRef.current.undo();
                          updateUndoRedoState();
                          
                          toast.error("Failed to resize task. Changes reverted.");
                        }
                      }}
                    />
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
