import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { Calendar as CalendarIcon, Maximize2, Minimize2 } from "lucide-react";
import toast from "react-hot-toast";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import type { EventClickArg, EventDropArg, EventResizeDoneArg, DateSelectArg, EventContentArg } from "@fullcalendar/core";
import type { AppDispatch, RootState } from "@/store/store";
import type { Task } from "@/store/types";
import TaskDialog from "./TaskDialog";
import { TasksCache } from "@/store/indexedDB/TasksCache";
import { api } from "@/store/api/internalApi";
import { TaskEvents } from "@/store/eventEmiters/taskEvents";
import { getTasksFromIndexedDB } from "@/store/reducers/tasksSlice";

// Helper to format date as local time without timezone conversion
const formatAsLocalTime = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${mins}:${secs}`;
};

type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';

export default function CalendarViewTab({ workspaceId }: { workspaceId: string | undefined }) {
  const dispatch = useDispatch<AppDispatch>();
  const calendarRef = useRef<FullCalendar>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { state: sidebarState, isMobile } = useSidebar();
  
  // Redux selectors
  const tasks = useSelector((state: RootState) => state.tasks.value || []);
  const users = useSelector((state: RootState) => state.users.value || []);
  const categories = useSelector((state: RootState) => state.categories.value || []);
  const statuses = useSelector((state: RootState) => state.statuses.value || []);
  const priorities = useSelector((state: RootState) => state.priorities.value || []);

  // Local state
  const [currentView, setCurrentView] = useState<CalendarView>('dayGridMonth');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [prefilledDates, setPrefilledDates] = useState<{ start: string | null; due: string | null }>({ start: null, due: null });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [calendarHeight, setCalendarHeight] = useState<number>(600);

  // Calculate calendar height using ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateHeight = () => {
      const rect = container.getBoundingClientRect();
      // Subtract some padding for the header (approximately 50px)
      const newHeight = Math.max(400, rect.height - 60);
      setCalendarHeight(newHeight);
    };

    // Initial calculation
    updateHeight();

    // Watch for size changes
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(container);

    // Also update on window resize
    window.addEventListener('resize', updateHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [isFullscreen]);

  // Filter tasks by workspace
  const workspaceTasks = useMemo(() => {
    if (!workspaceId) return tasks;
    const wsId = parseInt(workspaceId);
    return tasks.filter((task: Task) => task.workspace_id === wsId);
  }, [tasks, workspaceId]);

  // Map tasks to FullCalendar events (only tasks with start_date; no fallback to created_at)
  const calendarEvents = useMemo(() => {
    return workspaceTasks
      .filter((task: Task) => task.start_date) // Only show tasks with a start date
      .map((task: Task) => {
        const category = categories.find((c: any) => c.id === task.category_id);
        const status = statuses.find((s: any) => s.id === task.status_id);
        const priority = priorities.find((p: any) => p.id === task.priority_id);
        
        // Get assignee names
        const assigneeNames = task.user_ids
          ? task.user_ids
              .map((userId: number) => {
                const user = users.find((u: any) => u.id === userId);
                return user?.name || '';
              })
              .filter(Boolean)
              .join(', ')
          : '';

        // Determine event color (priority: category > status)
        const eventColor = category?.color || status?.color || '#3b82f6';
        
        // Determine if task is completed
        const isCompleted = status?.action === 'FINISHED';

        // Check if task has a meaningful time component (not just 00:00:00)
        // A task has time if start_date exists and contains a time part that's not 00:00:00
        let hasTime = false;
        if (task.start_date && typeof task.start_date === 'string') {
          if (task.start_date.includes('T')) {
            const timePart = task.start_date.split('T')[1];
            // Check if time is not 00:00:00 or 00:00
            hasTime = timePart && !timePart.match(/^00:00(:00)?/);
          }
        }
        
        // Determine if this is an all-day event
        // It's all-day if there's no start_date, or if start_date exists but has no meaningful time
        const isAllDay = !task.start_date || !hasTime;
        
        return {
          id: task.id.toString(),
          title: task.name,
          start: task.start_date,
          end: task.due_date,
          allDay: isAllDay,
          backgroundColor: eventColor,
          borderColor: eventColor,
          textColor: '#ffffff',
          classNames: isCompleted ? ['opacity-50'] : [],
          extendedProps: {
            task,
            category,
            status,
            priority,
            assignees: assigneeNames,
            isCompleted,
            hasTime, // Store for use in renderEventContent
          },
        };
      });
  }, [workspaceTasks, categories, statuses, priorities, users]);

  // Real-time updates listener
  useEffect(() => {
    const handleTaskChange = () => {
      dispatch(getTasksFromIndexedDB());
    };

    const unsubscribers = [
      TaskEvents.on(TaskEvents.EVENTS.TASK_CREATED, handleTaskChange),
      TaskEvents.on(TaskEvents.EVENTS.TASK_UPDATED, handleTaskChange),
      TaskEvents.on(TaskEvents.EVENTS.TASK_DELETED, handleTaskChange),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [dispatch]);

  // Handle event click (edit task)
  const handleEventClick = useCallback((info: EventClickArg) => {
    const task = info.event.extendedProps.task as Task;
    setSelectedTask(task);
    setDialogMode('edit');
    setPrefilledDates({ start: null, due: null });
    setDialogOpen(true);
  }, []);

  // Handle date selection (create task)
  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    const { start, end, allDay } = selectInfo;
    
    // Format dates based on allDay flag
    let startDate: string | null = null;
    let dueDate: string | null = null;

    if (allDay) {
      // For all-day events, set both start_date and due_date to the selected day(s)
      // FullCalendar's end is exclusive, so subtract 1 day to get the actual end date
      const selectedEnd = new Date(end.getTime() - 86400000);
      const selectedStart = new Date(start);
      
      // Set both dates to ensure the task appears on the calendar
      startDate = formatAsLocalTime(selectedStart);
      dueDate = formatAsLocalTime(selectedEnd);
    } else {
      // For timed events, set both start_date and due_date
      startDate = formatAsLocalTime(start);
      dueDate = formatAsLocalTime(end);
    }

    setPrefilledDates({ start: startDate, due: dueDate });
    setSelectedTask(null);
    setDialogMode('create');
    setDialogOpen(true);

    // Clear the selection
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.unselect();
    }
  }, []);

  // Handle event drag (move task)
  const handleEventDrop = useCallback(async (info: EventDropArg) => {
    const task = info.event.extendedProps.task as Task;
    const { start, end, allDay } = info.event;

    if (!start) return;

    // Calculate new dates preserving the original duration
    let newStartDate: string | null = null;
    let newDueDate: string | null = null;

    if (allDay) {
      // For all-day events, calculate duration and preserve it
      const originalStart = task.start_date ? new Date(task.start_date) : null;
      const originalDue = task.due_date ? new Date(task.due_date) : null;
      
      if (originalStart && originalDue) {
        // Calculate duration in milliseconds
        const duration = originalDue.getTime() - originalStart.getTime();
        // Apply new start date and add duration
        const newStart = new Date(start);
        // Reset to start of day for all-day events
        newStart.setHours(0, 0, 0, 0);
        const newDue = new Date(newStart.getTime() + duration);
        newDue.setHours(0, 0, 0, 0);
        
        newStartDate = formatAsLocalTime(newStart);
        newDueDate = formatAsLocalTime(newDue);
      } else if (originalDue) {
        // Only due_date exists, treat as single-day event
        const newStart = new Date(start);
        newStart.setHours(0, 0, 0, 0);
        newStartDate = formatAsLocalTime(newStart);
        newDueDate = formatAsLocalTime(newStart);
      } else {
        // Fallback: use the dropped date
        const newStart = new Date(start);
        newStart.setHours(0, 0, 0, 0);
        newStartDate = formatAsLocalTime(newStart);
        newDueDate = formatAsLocalTime(newStart);
      }
    } else {
      // For timed events, preserve the duration
      const originalStart = task.start_date ? new Date(task.start_date) : null;
      const originalDue = task.due_date ? new Date(task.due_date) : null;
      
      if (originalStart && originalDue) {
        // Calculate duration in milliseconds
        const duration = originalDue.getTime() - originalStart.getTime();
        // Apply new start time and add duration
        const newStart = new Date(start);
        const newDue = new Date(newStart.getTime() + duration);
        
        newStartDate = formatAsLocalTime(newStart);
        newDueDate = formatAsLocalTime(newDue);
      } else if (originalDue && task.start_date) {
        // Has start_date, calculate duration from it
        const originalStart = new Date(task.start_date);
        const duration = originalDue.getTime() - originalStart.getTime();
        const newStart = new Date(start);
        const newDue = new Date(newStart.getTime() + duration);
        
        newStartDate = formatAsLocalTime(newStart);
        newDueDate = formatAsLocalTime(newDue);
      } else {
        // Fallback: use the dropped start and end
        newStartDate = formatAsLocalTime(start);
        if (end) {
          newDueDate = formatAsLocalTime(end);
        } else {
          // If no end, use start + 1 hour as default duration
          const defaultEnd = new Date(start.getTime() + 3600000);
          newDueDate = formatAsLocalTime(defaultEnd);
        }
      }
    }

    // Optimistic update to cache
    try {
      await TasksCache.updateTask(task.id.toString(), {
        ...task,
        start_date: newStartDate,
        due_date: newDueDate,
      });

      // Update via API
      await api.patch(`/tasks/${task.id}`, {
        start_date: newStartDate,
        due_date: newDueDate,
      });

      toast.success('Task dates updated');
    } catch (error) {
      console.error('Failed to update task dates:', error);
      toast.error('Failed to update task dates');
      info.revert(); // Revert the calendar change
      
      // Revert cache
      await TasksCache.updateTask(task.id.toString(), task);
    }
  }, []);

  // Handle event resize (change task duration)
  const handleEventResize = useCallback(async (info: EventResizeDoneArg) => {
    const task = info.event.extendedProps.task as Task;
    const { start, end } = info.event;

    if (!start || !end) return;

    const newStartDate = task.start_date ? formatAsLocalTime(start) : null;
    const newDueDate = formatAsLocalTime(end);

    // Optimistic update to cache
    try {
      await TasksCache.updateTask(task.id.toString(), {
        ...task,
        start_date: newStartDate,
        due_date: newDueDate,
      });

      // Update via API
      await api.patch(`/tasks/${task.id}`, {
        start_date: newStartDate,
        due_date: newDueDate,
      });

      toast.success('Task duration updated');
    } catch (error) {
      console.error('Failed to update task duration:', error);
      toast.error('Failed to update task duration');
      info.revert(); // Revert the calendar change
      
      // Revert cache
      await TasksCache.updateTask(task.id.toString(), task);
    }
  }, []);

  // Handle view change
  const handleViewChange = useCallback((view: CalendarView) => {
    setCurrentView(view);
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.changeView(view);
    }
  }, []);

  // Handle dialog close
  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setSelectedTask(null);
      setPrefilledDates({ start: null, due: null });
    }
  }, []);

  // Custom event content renderer
  const renderEventContent = useCallback((eventInfo: EventContentArg) => {
    const { timeText, event } = eventInfo;
    const assignees = event.extendedProps.assignees as string;
    const hasTime = event.extendedProps.hasTime as boolean;
    
    // Only show time if:
    // 1. timeText exists
    // 2. The task has a meaningful time component (not 00:00:00)
    // 3. The event is not marked as all-day
    // 4. timeText is not "00:00"
    const shouldShowTime = timeText && hasTime && !event.allDay && timeText !== '00:00';
    
    return (
      <div className="fc-event-main-frame overflow-hidden">
        {shouldShowTime && <div className="fc-event-time font-semibold">{timeText}</div>}
        <div className="fc-event-title-container">
          <div className="fc-event-title fc-sticky truncate">{event.title}</div>
          {assignees && (
            <div className="text-[10px] opacity-80 truncate mt-0.5">{assignees}</div>
          )}
        </div>
      </div>
    );
  }, []);

  // Toggle fullscreen mode
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isFullscreen]);

  // Calculate sidebar offset based on sidebar state
  // On mobile, sidebar overlays so left should be 0
  // On desktop: use --sidebar-width-icon (4rem) when collapsed, --sidebar-width (15rem) when expanded
  const sidebarOffset = useMemo(() => {
    if (isMobile) return '0';
    return sidebarState === 'collapsed' 
      ? 'var(--sidebar-width-icon, 4rem)' 
      : 'var(--sidebar-width, 15rem)';
  }, [sidebarState, isMobile]);

  return (
    <>
      <div 
        ref={containerRef}
        className={`${isFullscreen ? 'fixed top-0 right-0 bottom-0 left-0 z-[100] bg-background' : 'absolute inset-0'} flex flex-col gap-2 p-2`}
        style={isFullscreen ? {
          left: sidebarOffset,
        } : undefined}
      >
        {/* Header with View Switcher */}
        <div className="flex-shrink-0 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarIcon className="w-5 h-5" />
            <h2 className="text-lg font-semibold text-foreground">Calendar View</h2>
            {workspaceId && <span className="text-xs opacity-60">workspace {workspaceId}</span>}
          </div>

          {/* View Switcher and Fullscreen Toggle */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={currentView === 'dayGridMonth' ? 'default' : 'outline'}
                onClick={() => handleViewChange('dayGridMonth')}
                className="shadow-sm"
              >
                Month
              </Button>
              <Button
                size="sm"
                variant={currentView === 'timeGridWeek' ? 'default' : 'outline'}
                onClick={() => handleViewChange('timeGridWeek')}
                className="shadow-sm"
              >
                Week
              </Button>
              <Button
                size="sm"
                variant={currentView === 'timeGridDay' ? 'default' : 'outline'}
                onClick={() => handleViewChange('timeGridDay')}
                className="shadow-sm"
              >
                Day
              </Button>
              <Button
                size="sm"
                variant={currentView === 'listWeek' ? 'default' : 'outline'}
                onClick={() => handleViewChange('listWeek')}
                className="shadow-sm"
              >
                List
              </Button>
            </div>

            {/* Fullscreen Toggle */}
            <Button
              size="sm"
              variant="outline"
              onClick={toggleFullscreen}
              className="shadow-sm"
              title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Calendar Card */}
        <div className="flex-1 min-h-0 rounded-xl border bg-card shadow-lg transition-shadow hover:shadow-xl overflow-hidden">
          <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView={currentView}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: '', // We handle view switching with our custom buttons
          }}
          events={calendarEvents}
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={4}
          weekends={true}
          height={calendarHeight}
          expandRows={true}
          stickyHeaderDates={true}
          eventClick={handleEventClick}
          select={handleDateSelect}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventContent={renderEventContent}
          eventDisplay="block"
          displayEventTime={true}
          displayEventEnd={false}
          nowIndicator={true}
          scrollTime="08:00:00"
          scrollTimeReset={false}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:30:00"
          allDaySlot={true}
          firstDay={1} // Monday
          weekNumbers={false}
          navLinks={true}
          businessHours={{
            daysOfWeek: [1, 2, 3, 4, 5], // Monday - Friday
            startTime: '09:00',
            endTime: '18:00',
          }}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }}
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }}
          />
        </div>
      </div>

      {/* Task Dialog */}
      <TaskDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        mode={dialogMode}
        workspaceId={workspaceId ? parseInt(workspaceId) : undefined}
        task={
          dialogMode === 'edit'
            ? selectedTask
            : prefilledDates.start || prefilledDates.due
            ? {
                workspace_id: workspaceId ? parseInt(workspaceId) : undefined,
                start_date: prefilledDates.start,
                due_date: prefilledDates.due,
              }
            : null
        }
      />
    </>
  );
}
