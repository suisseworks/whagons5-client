import { useMemo } from "react";
import type { SchedulerEvent } from "../types/scheduler";
import { MapPin, Clock, Calendar, Tag, Flag, Layers, RefreshCw } from "lucide-react";

interface EventTooltipProps {
  event: SchedulerEvent | null;
  x: number;
  y: number;
  visible: boolean;
  isDragging?: boolean;
  pinned?: boolean;
}

export default function EventTooltip({
  event,
  x,
  y,
  visible,
  isDragging = false,
}: EventTooltipProps) {
  // Calculate position to keep tooltip in viewport
  const position = useMemo(() => {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const tooltipWidth = 280;
    const tooltipHeight = 200;
    
    let posX = x + 15;
    let posY = y - 10;
    
    // Adjust if tooltip would go off right edge
    if (posX + tooltipWidth > viewportWidth - 20) {
      posX = x - tooltipWidth - 15;
    }
    
    // Adjust if tooltip would go off bottom edge
    if (posY + tooltipHeight > viewportHeight - 20) {
      posY = viewportHeight - tooltipHeight - 20;
    }
    
    // Ensure tooltip doesn't go above viewport
    if (posY < 20) {
      posY = 20;
    }
    
    return { left: posX, top: posY };
  }, [x, y]);

  // Don't render if no event or not visible or dragging
  if (!event || !visible || isDragging) {
    return null;
  }

  const duration = Math.round((event.endDate.getTime() - event.startDate.getTime()) / 60000);
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div
      className="scheduler-tooltip fixed z-[100] pointer-events-none animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ 
        left: position.left,
        top: position.top,
        minWidth: 260,
        maxWidth: 340,
        background: 'hsl(var(--popover) / 0.92)',
        backdropFilter: 'blur(16px) saturate(180%)',
        border: '1px solid hsl(var(--border) / 0.4)',
        borderRadius: '14px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Header with color accent */}
      <div 
        className="scheduler-tooltip-header px-4 py-3.5"
        style={{ 
          background: `linear-gradient(135deg, ${event.color}12 0%, ${event.color}05 50%, transparent 100%)`,
          borderLeft: `4px solid ${event.color}`,
          borderRadius: '14px 14px 0 0',
          borderBottom: '1px solid hsl(var(--border) / 0.2)'
        }}
      >
        <div className="scheduler-tooltip-title font-semibold text-[13px] text-foreground leading-tight tracking-[-0.01em]">{event.name}</div>
        {event.description && (
          <div className="scheduler-tooltip-description text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{event.description}</div>
        )}
      </div>
      
      {/* Content */}
      <div className="scheduler-tooltip-content px-4 py-3.5 space-y-3">
        {/* Time info */}
        <div className="scheduler-tooltip-row flex items-start gap-3">
          <Calendar className="scheduler-tooltip-icon h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <div className="scheduler-tooltip-label text-foreground font-medium">{formatDate(event.startDate)}</div>
            <div className="scheduler-tooltip-sublabel text-muted-foreground mt-0.5">
              {formatTime(event.startDate)} – {formatTime(event.endDate)}
            </div>
          </div>
        </div>
        
        {/* Duration */}
        <div className="scheduler-tooltip-row flex items-center gap-3">
          <Clock className="scheduler-tooltip-icon h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="scheduler-tooltip-label text-xs text-foreground font-medium">{durationText}</span>
        </div>
        
        {/* Status & Priority row */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {event.statusName && (
            <span 
              className="scheduler-tooltip-badge inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{ 
                backgroundColor: event.statusColor ? `${event.statusColor}18` : 'hsl(var(--muted))',
                color: event.statusColor || 'hsl(var(--muted-foreground))',
                boxShadow: event.statusColor ? `0 0 0 1px ${event.statusColor}20` : 'none'
              }}
            >
              {event.statusName}
            </span>
          )}
          
          {event.priorityName && (
            <span 
              className="scheduler-tooltip-badge inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{ 
                backgroundColor: event.priorityColor ? `${event.priorityColor}18` : 'hsl(var(--muted))',
                color: event.priorityColor || 'hsl(var(--muted-foreground))',
                boxShadow: event.priorityColor ? `0 0 0 1px ${event.priorityColor}20` : 'none'
              }}
            >
              {event.priorityName}
            </span>
          )}
        </div>
        
        {/* Spot */}
        {event.spotName && (
          <div className="scheduler-tooltip-row flex items-center gap-3">
            <MapPin className="scheduler-tooltip-icon h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="scheduler-tooltip-label text-xs text-foreground">{event.spotName}</span>
          </div>
        )}
        
        {/* Category */}
        {event.categoryName && (
          <div className="scheduler-tooltip-row flex items-center gap-3">
            <Tag className="scheduler-tooltip-icon h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="scheduler-tooltip-label text-xs text-muted-foreground">{event.categoryName}</span>
          </div>
        )}
        
        {/* Recurrence indicator */}
        {event.isRecurring && (
          <div className="scheduler-tooltip-row flex items-center gap-3">
            <RefreshCw className="scheduler-tooltip-icon h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-xs text-primary font-medium">
              Recurring task
              {event.recurrenceInstanceNumber && (
                <span className="text-muted-foreground font-normal ml-1.5">
                  #{event.recurrenceInstanceNumber}
                </span>
              )}
            </span>
          </div>
        )}
      </div>
      
      {/* Footer hint */}
      <div 
        className="scheduler-tooltip-footer px-4 py-2.5"
        style={{
          background: 'hsl(var(--muted) / 0.25)',
          borderTop: '1px solid hsl(var(--border) / 0.2)',
          borderRadius: '0 0 14px 14px'
        }}
      >
        <div className="scheduler-tooltip-hint text-[10px] text-muted-foreground/80">Double-click to edit</div>
      </div>
    </div>
  );
}
