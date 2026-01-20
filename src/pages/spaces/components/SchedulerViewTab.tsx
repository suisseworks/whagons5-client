import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTimeScale } from "./scheduler/hooks/useTimeScale";
import { useSchedulerData } from "./scheduler/hooks/useSchedulerData";
import { useResourceGrouping } from "./scheduler/hooks/useResourceGrouping";
import TimeHeader from "./scheduler/components/TimeHeader";
import TimelineCanvas from "./scheduler/components/TimelineCanvas";
import ResourceList from "./scheduler/components/ResourceList";
import EventEditor from "./scheduler/components/EventEditor";
import SchedulerControls from "./scheduler/components/SchedulerControls";
import { SchedulerErrorBoundary } from "./scheduler/components/SchedulerErrorBoundary";
import { TasksCache } from "@/store/indexedDB/TasksCache";
import { api } from "@/store/api/internalApi";
import { exportToPDF, exportToPNG, exportToExcel } from "./scheduler/utils/exportUtils";
import { UndoRedoManager, type HistoryAction } from "./scheduler/utils/undoRedo";
import type { ViewPreset, SchedulerEvent } from "./scheduler/types/scheduler";
import type { AppDispatch } from "@/store/store";
import type { SchedulerResource } from "./scheduler/types/scheduler";
import toast from "react-hot-toast";

export default function SchedulerViewTab({ workspaceId }: { workspaceId: string | undefined }) {
  const dispatch = useDispatch<AppDispatch>();
  const [viewPreset, setViewPreset] = useState<ViewPreset>("hourAndDay");
  const [baseDate, setBaseDate] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<number>>(new Set());
  const [groupBy, setGroupBy] = useState<"none" | "team" | "role">("team");
  const [editingEvent, setEditingEvent] = useState<SchedulerEvent | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [createEventData, setCreateEventData] = useState<{ date: Date; resourceIndex: number } | null>(null);
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

  // Fetch resources and events from Redux
  const { resources, events, loading } = useSchedulerData(workspaceId);
  const { groupedResources } = useResourceGrouping(resources, groupBy);

  // Calculate dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width - 240, // Account for padding + resource list (200px)
          height: rect.height - 120, // Account for header and controls
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);


  const { scale, startDate, endDate } = useTimeScale(
    viewPreset,
    dimensions.width,
    baseDate
  );

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

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (undoRedoState.canUndo) {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        if (undoRedoState.canRedo) {
          handleRedo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, undoRedoState]);

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

  return (
    <div className="h-full w-full flex flex-col gap-2 min-h-0">
      <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
        <CardContent className="flex-1 min-h-0 flex flex-col pt-1 pb-1 overflow-hidden px-3 lg:px-6">
          {/* Controls */}
          <div className="flex items-center justify-between gap-2 mb-2 pr-3 lg:pr-6">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handlePrev}>
                Prev
              </Button>
              <Button size="sm" variant="outline" onClick={handleToday}>
                Today
              </Button>
              <Button size="sm" variant="outline" onClick={handleNext}>
                Next
              </Button>
            </div>
            <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={viewPreset === "hourAndDay" ? "default" : "secondary"}
                  onClick={() => setViewPreset("hourAndDay")}
                >
                  Day
                </Button>
                <Button
                  size="sm"
                  variant={viewPreset === "dayAndWeek" ? "default" : "secondary"}
                  onClick={() => setViewPreset("dayAndWeek")}
                >
                  Week
                </Button>
                <Button
                  size="sm"
                  variant={viewPreset === "weekAndMonth" ? "default" : "secondary"}
                  onClick={() => setViewPreset("weekAndMonth")}
                >
                  Month
                </Button>
              </div>
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
            ) : (
              <ResourceList
                resources={resources}
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
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {dimensions.width > 0 && dimensions.height > 0 && (
                <SchedulerErrorBoundary>
                  {/* Time Header */}
                  <div className="border-b">
                    <TimeHeader
                      scale={scale}
                      height={40}
                      preset={viewPreset}
                      startDate={startDate}
                      endDate={endDate}
                    />
                  </div>

                  {/* Timeline Canvas */}
                  <div className="flex-1 min-h-0 overflow-auto">
                    <TimelineCanvas
                      scale={scale}
                      width={dimensions.width}
                      height={Math.max(resources.length * rowHeight, dimensions.height - 40)}
                      preset={viewPreset}
                      startDate={startDate}
                      endDate={endDate}
                      resources={resources}
                      events={filteredEvents}
                      rowHeight={rowHeight}
                      onEventSelect={(event) => {
                        console.log("Event selected:", event);
                      }}
                      onEventDoubleClick={(event) => {
                        setEditingEvent(event);
                        setEditorMode("edit");
                        setIsEditorOpen(true);
                      }}
                      onEmptySpaceClick={(date, resourceIndex) => {
                        if (resourceIndex >= 0 && resourceIndex < resources.length) {
                          setCreateEventData({ date, resourceIndex });
                          setEditingEvent(null);
                          setEditorMode("create");
                          setIsEditorOpen(true);
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

      {/* Event Editor Dialog */}
      <EventEditor
        event={editingEvent}
        resources={resources}
        isOpen={isEditorOpen}
        createEventData={createEventData}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingEvent(null);
          setCreateEventData(null);
        }}
        onSave={async (eventData) => {
          try {
            if (editorMode === "create") {
              // Create new task
              const response = await api.post("/tasks", {
                name: eventData.name,
                description: eventData.description,
                start_date: eventData.startDate.toISOString(),
                due_date: eventData.endDate.toISOString(),
                user_ids: eventData.resourceIds,
                workspace_id: workspaceId ? parseInt(workspaceId) : undefined,
              });

              const newTask = response.data?.data || response.data;
              if (newTask) {
                await TasksCache.addTask(newTask);
              }
            } else if (editingEvent) {
              // Update existing task
              await api.patch(`/tasks/${editingEvent.taskId}`, {
                name: eventData.name,
                description: eventData.description,
                start_date: eventData.startDate.toISOString(),
                due_date: eventData.endDate.toISOString(),
                user_ids: eventData.resourceIds,
              });

              const task = await TasksCache.getTask(editingEvent.taskId.toString());
              if (task) {
                await TasksCache.updateTask(editingEvent.taskId.toString(), {
                  ...task,
                  name: eventData.name,
                  description: eventData.description,
                  start_date: eventData.startDate.toISOString(),
                  due_date: eventData.endDate.toISOString(),
                  user_ids: eventData.resourceIds,
                });
              }
            }
          } catch (error) {
            console.error("Failed to save event:", error);
            throw error;
          }
        }}
        mode={editorMode}
      />
    </div>
  );
}
