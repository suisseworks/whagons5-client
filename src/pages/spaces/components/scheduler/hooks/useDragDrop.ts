import { useRef, useCallback, useMemo } from "react";
import { drag } from "d3-drag";
import { select } from "d3-selection";
import type { ScaleTime } from "d3-scale";
import type { SchedulerEvent, EventPosition } from "../types/scheduler";

// Debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export interface DragState {
  isDragging: boolean;
  event: SchedulerEvent | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface ResizeState {
  isResizing: boolean;
  event: SchedulerEvent | null;
  resizeHandle: "start" | "end" | null;
  startX: number;
  originalStartDate: Date;
  originalEndDate: Date;
}

export function useDragDrop(
  scale: ScaleTime<number, number>,
  rowHeight: number,
  snapInterval: number = 15 * 60 * 1000, // 15 minutes default
  onEventMove?: (event: SchedulerEvent, newStartDate: Date, newEndDate: Date) => void,
  onEventResize?: (event: SchedulerEvent, newStartDate: Date, newEndDate: Date) => void
) {
  // Debounce API calls to avoid excessive requests during drag
  const debouncedMove = useMemo(
    () => (onEventMove ? debounce(onEventMove, 300) : undefined),
    [onEventMove]
  );
  
  const debouncedResize = useMemo(
    () => (onEventResize ? debounce(onEventResize, 300) : undefined),
    [onEventResize]
  );
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    event: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });

  const resizeStateRef = useRef<ResizeState>({
    isResizing: false,
    event: null,
    resizeHandle: null,
    startX: 0,
    originalStartDate: new Date(),
    originalEndDate: new Date(),
  });

  const snapToInterval = useCallback((date: Date): Date => {
    const time = date.getTime();
    const snapped = Math.round(time / snapInterval) * snapInterval;
    return new Date(snapped);
  }, [snapInterval]);

  const createDragBehavior = useCallback((event: SchedulerEvent, position: EventPosition) => {
    return drag<SVGRectElement, unknown>()
      .subject(() => ({ x: position.x, y: position.y }))
      .on("start", (d) => {
        dragStateRef.current = {
          isDragging: true,
          event,
          startX: d.x,
          startY: d.y,
          currentX: d.x,
          currentY: d.y,
        };
      })
      .on("drag", function(d) {
        dragStateRef.current.currentX = d.x;
        dragStateRef.current.currentY = d.y;
        // Update visual position during drag - update the bar element's x position
        select(this as SVGRectElement).attr("x", d.x);
      })
      .on("end", (d) => {
        const { event, startX, currentX } = dragStateRef.current;
        if (!event) return;

        const deltaX = currentX - startX;
        const deltaTime = scale.invert(deltaX).getTime() - scale.invert(0).getTime();
        
        const newStartDate = snapToInterval(new Date(event.startDate.getTime() + deltaTime));
        const duration = event.endDate.getTime() - event.startDate.getTime();
        const newEndDate = new Date(newStartDate.getTime() + duration);

        if (debouncedMove) {
          debouncedMove(event, newStartDate, newEndDate);
        }

        dragStateRef.current = {
          isDragging: false,
          event: null,
          startX: 0,
          startY: 0,
          currentX: 0,
          currentY: 0,
        };
      });
  }, [scale, snapToInterval, debouncedMove]);

  const createResizeBehavior = useCallback((
    event: SchedulerEvent,
    position: EventPosition,
    handle: "start" | "end"
  ) => {
    const handleX = handle === "start" ? position.x : position.x + position.width;
    return drag<SVGRectElement, unknown>()
      .subject(() => ({ x: handleX, y: position.y }))
      .on("start", (d) => {
        resizeStateRef.current = {
          isResizing: true,
          event,
          resizeHandle: handle,
          startX: d.x,
          originalStartDate: new Date(event.startDate),
          originalEndDate: new Date(event.endDate),
        };
      })
      .on("drag", function(d) {
        // Update visual position during drag
        const handleElement = this as SVGRectElement;
        if (!handleElement) return;
        
        const eventGroup = handleElement.parentElement;
        if (!eventGroup) return;
        
        const bar = eventGroup.querySelector("rect:first-of-type") as SVGRectElement;
        if (!bar) return;
        
        if (resizeStateRef.current.resizeHandle === "start") {
          const currentX = bar.x.baseVal.value;
          const currentWidth = bar.width.baseVal.value;
          const deltaX = d.x - resizeStateRef.current.startX;
          const newX = Math.max(currentX + deltaX, 0);
          const newWidth = Math.max(currentWidth - deltaX, 4);
          select(bar).attr("x", newX).attr("width", newWidth);
          select(handleElement).attr("x", newX - 2);
        } else {
          const currentX = bar.x.baseVal.value;
          const currentWidth = bar.width.baseVal.value;
          const deltaX = d.x - resizeStateRef.current.startX;
          const newWidth = Math.max(currentWidth + deltaX, 4);
          select(bar).attr("width", newWidth);
          select(handleElement).attr("x", currentX + newWidth - 2);
        }
      })
      .on("end", (d) => {
        const { event, startX, resizeHandle, originalStartDate, originalEndDate } = resizeStateRef.current;
        if (!event || !resizeHandle) return;

        const deltaX = d.x - startX;
        const deltaTime = scale.invert(deltaX).getTime() - scale.invert(0).getTime();
        
        let newStartDate = new Date(originalStartDate);
        let newEndDate = new Date(originalEndDate);

        if (resizeHandle === "start") {
          newStartDate = snapToInterval(new Date(originalStartDate.getTime() + deltaTime));
          // Ensure start date is before end date
          if (newStartDate >= newEndDate) {
            newStartDate = new Date(newEndDate.getTime() - snapInterval);
          }
        } else {
          newEndDate = snapToInterval(new Date(originalEndDate.getTime() + deltaTime));
          // Ensure end date is after start date
          if (newEndDate <= newStartDate) {
            newEndDate = new Date(newStartDate.getTime() + snapInterval);
          }
        }

        if (debouncedResize) {
          debouncedResize(event, newStartDate, newEndDate);
        }

        resizeStateRef.current = {
          isResizing: false,
          event: null,
          resizeHandle: null,
          startX: 0,
          originalStartDate: new Date(),
          originalEndDate: new Date(),
        };
      });
  }, [scale, snapToInterval, snapInterval, debouncedResize]);

  return {
    createDragBehavior,
    createResizeBehavior,
    dragState: dragStateRef.current,
    resizeState: resizeStateRef.current,
  };
}
