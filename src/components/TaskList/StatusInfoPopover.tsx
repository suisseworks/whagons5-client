"use client";
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Clock, Calendar } from "lucide-react";
import { DB } from "@/store/indexedDB/DB";
import { TasksCache } from "@/store/indexedDB/TasksCache";
import { cn } from "@/lib/utils";

interface StatusTransitionLog {
  id: number;
  task_id: number;
  type: 'NONE' | 'WORKING' | 'PAUSED' | 'FINISHED';
  from_status: number | null;
  to_status: number | null;
  start: string;
  end: string | null;
  user_id: number;
  created_at: string;
  updated_at: string;
}

interface StatusInfoPopoverProps {
  taskId: number;
  statusId: number;
  children: React.ReactNode;
}

function formatDuration(ms: number): string {
  if (ms < 0) return "0 seconds";
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''} ${hours % 24} hour${(hours % 24) !== 1 ? 's' : ''}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes % 60} minute${(minutes % 60) !== 1 ? 's' : ''}`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ${seconds % 60} second${(seconds % 60) !== 1 ? 's' : ''}`;
  }
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function StatusInfoPopover({ taskId, statusId, children }: StatusInfoPopoverProps) {
  const [statusInfo, setStatusInfo] = useState<{
    startedAt: string | null;
    duration: number | null;
    isActive: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatusInfo() {
      try {
        await DB.init();
        
        // Try to get status transition logs (store might not exist yet)
        let allLogs: StatusTransitionLog[] = [];
        try {
          allLogs = await DB.getAll('status_transition_logs') as StatusTransitionLog[];
        } catch (storeError: any) {
          // Store doesn't exist yet - that's okay, we'll use task data as fallback
          if (storeError.name !== 'NotFoundError') {
            console.warn('[StatusInfoPopover] Error accessing status_transition_logs:', storeError);
          }
        }
        
        if (cancelled) return;

        // Filter logs for this task and current status (where it transitioned TO this status)
        const relevantLogs = allLogs
          .filter(log => {
            const logTaskId = Number(log.task_id);
            const logToStatus = Number(log.to_status);
            return logTaskId === Number(taskId) && logToStatus === Number(statusId);
          })
          .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

        if (relevantLogs.length > 0) {
          // Found transition log - use it
          const latestLog = relevantLogs[0];
          const startedAt = latestLog.start;
          const endTime = latestLog.end ? new Date(latestLog.end).getTime() : null;
          const startTime = new Date(startedAt).getTime();
          
          if (!isNaN(startTime)) {
            const now = Date.now();
            // Calculate duration
            const duration = endTime ? (endTime - startTime) : (now - startTime);
            const isActive = !endTime;

            if (!cancelled) {
              setStatusInfo({
                startedAt,
                duration,
                isActive,
              });
              setLoading(false);
            }
            return;
          }
        }

        // No transition log found, try to get task data as fallback using TasksCache
        try {
          await TasksCache.init();
          const allTasks = await TasksCache.getTasks();
          const taskIdNum = Number(taskId);
          const task = allTasks.find(t => Number(t.id) === taskIdNum);
          
          if (task) {
            // For working/in-progress statuses, prefer start_date, otherwise use created_at
            const startedAt = task.start_date || task.created_at;
            if (startedAt) {
              const startTime = new Date(startedAt).getTime();
              if (!isNaN(startTime)) {
                const now = Date.now();
                const duration = now - startTime;
                
                setStatusInfo({
                  startedAt,
                  duration,
                  isActive: true, // Assume active if using task data
                });
                setLoading(false);
                return;
              }
            }
          }
        } catch (taskError) {
          console.error('[StatusInfoPopover] Error fetching task data:', taskError);
        }
        
        // No data available at all
        setStatusInfo({
          startedAt: null,
          duration: null,
          isActive: true,
        });
        setLoading(false);
      } catch (error) {
        console.error('[StatusInfoPopover] Error fetching status info:', error);
        if (!cancelled) {
          setStatusInfo(null);
          setLoading(false);
        }
      }
    }

    fetchStatusInfo();

    // Update duration every minute if status is active
    const interval = setInterval(() => {
      setStatusInfo(prev => {
        if (!prev?.isActive || !prev?.startedAt) return prev;
        const startTime = new Date(prev.startedAt).getTime();
        const now = Date.now();
        return {
          ...prev,
          duration: now - startTime,
        };
      });
    }, 60000); // Update every minute

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [taskId, statusId]);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    // Don't stop propagation - we want hover to work even inside AG Grid cells
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setOpen(true);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Delay closing to allow moving to popover content
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 200);
  };

  const handleContentMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setOpen(true);
  };

  const handleContentMouseLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Calculate position for the tooltip
  useEffect(() => {
    if (open && containerRef.current) {
      const updatePosition = () => {
        if (!containerRef.current || !contentRef.current) return;
        
        const containerRect = containerRef.current.getBoundingClientRect();
        const contentRect = contentRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        
        // Calculate center position above the badge
        let left = containerRect.left + containerRect.width / 2 - contentRect.width / 2;
        let top = containerRect.top - contentRect.height - 8;
        
        // Adjust if tooltip would go off screen horizontally
        if (left < 8) {
          left = 8;
        } else if (left + contentRect.width > viewportWidth - 8) {
          left = viewportWidth - contentRect.width - 8;
        }
        
        // If tooltip would go above viewport, show below instead
        if (top < 8) {
          top = containerRect.bottom + 8;
        }
        
        contentRef.current.style.left = `${left}px`;
        contentRef.current.style.top = `${top}px`;
      };
      
      // Small delay to ensure content is rendered and has dimensions
      const timeoutId = setTimeout(updatePosition, 10);
      
      // Update on scroll/resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [open, statusInfo, loading]);

  return (
    <>
      <div 
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-block relative"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={contentRef}
          className={cn(
            "fixed w-80 p-4 rounded-md border bg-popover text-popover-foreground shadow-md",
            "animate-in fade-in-0 zoom-in-95"
          )}
          onMouseEnter={handleContentMouseEnter}
          onMouseLeave={handleContentMouseLeave}
          style={{
            pointerEvents: 'auto',
            zIndex: 9999,
          }}
        >
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading status info...</div>
        ) : statusInfo?.startedAt ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-muted-foreground mb-1">Started</div>
                <div className="text-sm font-medium">
                  {formatDateTime(statusInfo.startedAt)}
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  {statusInfo.isActive ? 'Duration (active)' : 'Duration'}
                </div>
                <div className="text-sm font-medium">
                  {statusInfo.duration !== null ? formatDuration(statusInfo.duration) : 'Unknown'}
                </div>
              </div>
            </div>

            {statusInfo.isActive && (
              <div className="pt-2 border-t border-border">
                <div className="text-xs text-muted-foreground">
                  Status is currently active
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No status timing information available
          </div>
        )}
        </div>,
        document.body
      )}
    </>
  );
}

export default StatusInfoPopover;

