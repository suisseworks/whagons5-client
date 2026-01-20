import { useEffect, useRef } from "react";
import { select } from "d3-selection";
import type { SchedulerEvent } from "../types/scheduler";

interface EventTooltipProps {
  event: SchedulerEvent | null;
  x: number;
  y: number;
  visible: boolean;
}

export default function EventTooltip({
  event,
  x,
  y,
  visible,
}: EventTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tooltipRef.current) return;

    const tooltip = select(tooltipRef.current);
    
    if (visible && event) {
      tooltip
        .style("opacity", 1)
        .style("left", `${x + 10}px`)
        .style("top", `${y - 10}px`)
        .style("display", "block");
    } else {
      tooltip.style("opacity", 0).style("display", "none");
    }
  }, [event, x, y, visible]);

  if (!event) return null;

  const duration = Math.round((event.endDate.getTime() - event.startDate.getTime()) / 60000); // minutes
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return (
    <div
      ref={tooltipRef}
      className="fixed z-50 bg-popover border rounded-lg shadow-lg p-3 pointer-events-none transition-opacity"
      style={{ opacity: 0, display: "none" }}
    >
      <div className="font-semibold text-sm mb-1">{event.name}</div>
      <div className="text-xs text-muted-foreground space-y-1">
        <div>
          Start: {event.startDate.toLocaleString()}
        </div>
        <div>
          End: {event.endDate.toLocaleString()}
        </div>
        <div>
          Duration: {durationText}
        </div>
      </div>
    </div>
  );
}
