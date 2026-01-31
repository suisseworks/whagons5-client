import { useRef, useCallback, useEffect } from "react";
import { drag } from "d3-drag";
import { select, type Selection } from "d3-selection";
import type { ScaleTime } from "d3-scale";
import type { SchedulerEvent, EventPosition } from "../types/scheduler";

export interface DragState {
  isDragging: boolean;
  event: SchedulerEvent | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  offsetX: number;
  originalPosition: EventPosition | null;
}

export interface ResizeState {
  isResizing: boolean;
  event: SchedulerEvent | null;
  resizeHandle: "start" | "end" | null;
  startX: number;
  originalStartDate: Date;
  originalEndDate: Date;
  originalPosition: EventPosition | null;
}

export function useDragDrop(
  scale: ScaleTime<number, number>,
  rowHeight: number,
  snapInterval: number = 15 * 60 * 1000, // 15 minutes default
  onEventMove?: (event: SchedulerEvent, newStartDate: Date, newEndDate: Date) => void,
  onEventResize?: (event: SchedulerEvent, newStartDate: Date, newEndDate: Date) => void,
  onDragStart?: () => void,
  onDragEnd?: () => void
) {
  // Use refs for callbacks only (not scale - scale needs to be a real dependency)
  const onEventMoveRef = useRef(onEventMove);
  const onEventResizeRef = useRef(onEventResize);
  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  
  // Keep callback refs updated
  onEventMoveRef.current = onEventMove;
  onEventResizeRef.current = onEventResize;
  onDragStartRef.current = onDragStart;
  onDragEndRef.current = onDragEnd;

  const dragStateRef = useRef<DragState>({
    isDragging: false,
    event: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    offsetX: 0,
    originalPosition: null,
  });

  const resizeStateRef = useRef<ResizeState>({
    isResizing: false,
    event: null,
    resizeHandle: null,
    startX: 0,
    originalStartDate: new Date(),
    originalEndDate: new Date(),
    originalPosition: null,
  });

  const snapToInterval = useCallback((date: Date): Date => {
    const time = date.getTime();
    const snapped = Math.round(time / snapInterval) * snapInterval;
    return new Date(snapped);
  }, [snapInterval]);

  // Store scale at drag start to guard against scale changes during drag
  const scaleAtDragStartRef = useRef<ScaleTime<number, number> | null>(null);

  // Function to cancel drag and restore visual state
  const cancelDragOperation = useCallback(() => {
    const { isDragging, event: dragEvent, originalPosition } = dragStateRef.current;
    const { isResizing, event: resizeEvent, originalPosition: resizeOriginalPosition } = resizeStateRef.current;
    
    if (isDragging && dragEvent && originalPosition) {
      // Find the event group and restore original position
      const eventGroup = document.querySelector(`.event-group-${dragEvent.id}`) as SVGGElement | null;
      if (eventGroup) {
        const bar = eventGroup.querySelector('.scheduler-event-bar') as SVGRectElement | null;
        const stripe = eventGroup.querySelector('.scheduler-event-stripe') as SVGRectElement | null;
        const label = eventGroup.querySelector('.scheduler-event-label') as SVGTextElement | null;
        const leftHandle = eventGroup.querySelector('.scheduler-resize-handle.resize-left') as SVGRectElement | null;
        const rightHandle = eventGroup.querySelector('.scheduler-resize-handle.resize-right') as SVGRectElement | null;
        const recurrenceIcon = eventGroup.querySelector('.scheduler-recurrence-icon') as SVGPathElement | null;
        
        const barX = originalPosition.x + 3;
        const barWidth = Math.max(originalPosition.width - 6, 12);
        
        if (bar) {
          select(bar)
            .attr('x', barX)
            .attr('width', barWidth)
            .attr('opacity', 1)
            .style('cursor', 'grab');
        }
        if (stripe) stripe.setAttribute('x', String(barX));
        if (label) label.setAttribute('x', String(originalPosition.x + 15));
        if (leftHandle) leftHandle.setAttribute('x', String(originalPosition.x));
        if (rightHandle) rightHandle.setAttribute('x', String(originalPosition.x + originalPosition.width - 4));
        
        if (recurrenceIcon) {
          const currentTransform = recurrenceIcon.getAttribute('transform') || '';
          const scaleMatch = currentTransform.match(/scale\([^)]+\)/);
          const scaleStr = scaleMatch ? scaleMatch[0] : '';
          const translateMatch = currentTransform.match(/translate\([^,]+,\s*([^)]+)\)/);
          const yPos = translateMatch ? translateMatch[1] : '0';
          recurrenceIcon.setAttribute('transform', `translate(${originalPosition.x + 13}, ${yPos}) ${scaleStr}`);
        }
        
        eventGroup.removeAttribute('data-dragging');
      }
      
      // Reset drag state
      dragStateRef.current = {
        isDragging: false,
        event: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        offsetX: 0,
        originalPosition: null,
      };
      
      // Notify drag ended (without triggering a move)
      onDragEndRef.current?.();
    }
    
    if (isResizing && resizeEvent && resizeOriginalPosition) {
      // Find the event group and restore original position
      const eventGroup = document.querySelector(`.event-group-${resizeEvent.id}`) as SVGGElement | null;
      if (eventGroup) {
        const bar = eventGroup.querySelector('.scheduler-event-bar') as SVGRectElement | null;
        const stripe = eventGroup.querySelector('.scheduler-event-stripe') as SVGRectElement | null;
        const label = eventGroup.querySelector('.scheduler-event-label') as SVGTextElement | null;
        const leftHandle = eventGroup.querySelector('.scheduler-resize-handle.resize-left') as SVGRectElement | null;
        const rightHandle = eventGroup.querySelector('.scheduler-resize-handle.resize-right') as SVGRectElement | null;
        
        if (bar) {
          select(bar)
            .attr('x', resizeOriginalPosition.x)
            .attr('width', resizeOriginalPosition.width)
            .attr('opacity', 1);
        }
        if (stripe) stripe.setAttribute('x', String(resizeOriginalPosition.x));
        if (label) label.setAttribute('x', String(resizeOriginalPosition.x + 10));
        if (leftHandle) leftHandle.setAttribute('x', String(resizeOriginalPosition.x - 2));
        if (rightHandle) rightHandle.setAttribute('x', String(resizeOriginalPosition.x + resizeOriginalPosition.width - 3));
        
        // Hide resize handles
        eventGroup.querySelectorAll('.scheduler-resize-handle').forEach((handle) => {
          (handle as SVGRectElement).setAttribute('opacity', '0');
        });
        
        eventGroup.removeAttribute('data-resizing');
      }
      
      // Reset resize state
      resizeStateRef.current = {
        isResizing: false,
        event: null,
        resizeHandle: null,
        startX: 0,
        originalStartDate: new Date(),
        originalEndDate: new Date(),
        originalPosition: null,
      };
      
      // Notify drag ended (without triggering a resize)
      onDragEndRef.current?.();
    }
    
    scaleAtDragStartRef.current = null;
  }, []);

  // Add event listeners for drag interruption (ESC key, mouse leave)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (dragStateRef.current.isDragging || resizeStateRef.current.isResizing)) {
        e.preventDefault();
        cancelDragOperation();
      }
    };
    
    const handleMouseLeave = (e: MouseEvent) => {
      // Only cancel if mouse leaves the document entirely
      if (e.relatedTarget === null && (dragStateRef.current.isDragging || resizeStateRef.current.isResizing)) {
        cancelDragOperation();
      }
    };
    
    const handleVisibilityChange = () => {
      // Cancel drag if tab loses focus
      if (document.hidden && (dragStateRef.current.isDragging || resizeStateRef.current.isResizing)) {
        cancelDragOperation();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cancelDragOperation]);

  const createDragBehavior = useCallback((event: SchedulerEvent, position: EventPosition) => {
    return drag<SVGRectElement, unknown>()
      .clickDistance(5) // Allow small mouse movements during click (5px threshold)
      .subject(() => ({ x: position.x, y: position.y }))
      .on("start", function(d) {
        const bar = this as SVGRectElement;
        const eventGroup = bar.parentElement as SVGGElement | null;
        
        // IMPORTANT: Read the CURRENT visual position from DOM instead of using the stale position
        // This handles the case where the task was moved but no re-render happened yet
        let currentPosition = { ...position };
        
        const currentBarX = parseFloat(bar.getAttribute("x") || "0");
        const currentBarWidth = parseFloat(bar.getAttribute("width") || "0");
        
        // Convert bar coordinates back to event position coordinates
        // bar x = position.x + 3, bar width = position.width - 6
        const visualX = Math.round(currentBarX - 3);
        const visualWidth = Math.round(currentBarWidth + 6);
        
        // Only use visual position if it's significantly different from the stored position
        // This indicates the task was moved and the position hasn't been updated
        if (Math.abs(visualX - position.x) > 5 || Math.abs(visualWidth - position.width) > 5) {
          currentPosition = {
            ...position,
            x: visualX,
            width: visualWidth,
          };
        }
        
        dragStateRef.current = {
          isDragging: true,
          event,
          startX: d.x,
          startY: d.y,
          currentX: d.x,
          currentY: d.y,
          offsetX: 0,
          originalPosition: currentPosition,
        };
        
        // Notify drag started
        onDragStartRef.current?.();
        
        // Visual feedback
        select(bar)
          .attr("opacity", 0.8)
          .style("cursor", "grabbing");
        
        if (eventGroup) {
          eventGroup.setAttribute("data-dragging", "true");
          select(eventGroup).raise();
        }
      })
      .on("drag", function(d) {
        const bar = this as SVGRectElement;
        const eventGroup = bar.parentElement as SVGGElement | null;
        const { originalPosition, startX } = dragStateRef.current;
        
        if (!eventGroup || !originalPosition) return;
        
        const offsetX = d.x - startX;
        dragStateRef.current.offsetX = offsetX;
        dragStateRef.current.currentX = d.x;
        
        // Move all elements in the group (use rounded positions for smooth rendering)
        const newX = Math.round(originalPosition.x + offsetX);
        const roundedWidth = Math.round(originalPosition.width);
        
        // Update bar position
        select(bar)
          .attr("x", newX + 3)
          .attr("width", Math.max(roundedWidth - 6, 12));
        
        // Update stripe
        const stripe = eventGroup.querySelector(".scheduler-event-stripe");
        if (stripe) select(stripe).attr("x", newX + 3);
        
        // Update recurrence icon (if present)
        const recurrenceIcon = eventGroup.querySelector(".scheduler-recurrence-icon");
        const hasRecurrenceIcon = !!recurrenceIcon;
        const iconSpace = hasRecurrenceIcon ? 18 : 0;
        
        if (recurrenceIcon) {
          // Icon is positioned via transform, need to update the translate
          const currentTransform = recurrenceIcon.getAttribute("transform") || "";
          const scaleMatch = currentTransform.match(/scale\([^)]+\)/);
          const scaleStr = scaleMatch ? scaleMatch[0] : "";
          // Get the current y position from the transform
          const translateMatch = currentTransform.match(/translate\([^,]+,\s*([^)]+)\)/);
          const yPos = translateMatch ? translateMatch[1] : "0";
          recurrenceIcon.setAttribute("transform", `translate(${newX + 13}, ${yPos}) ${scaleStr}`);
        }
        
        // Update label (position depends on whether recurrence icon exists)
        const label = eventGroup.querySelector(".scheduler-event-label");
        if (label) select(label).attr("x", newX + 15 + iconSpace);
        
        // Update resize handles
        const leftHandle = eventGroup.querySelector(".scheduler-resize-handle.resize-left");
        const rightHandle = eventGroup.querySelector(".scheduler-resize-handle.resize-right");
        if (leftHandle) select(leftHandle).attr("x", newX);
        if (rightHandle) select(rightHandle).attr("x", newX + roundedWidth - 4);
      })
      .on("end", function(d) {
        const bar = this as SVGRectElement;
        const { event: dragEvent, startX, offsetX, originalPosition } = dragStateRef.current;
        
        if (!dragEvent || !originalPosition) return;
        
        const eventGroup = bar.parentElement as SVGGElement | null;
        
        // Calculate the current drag position (rounded to integers)
        const draggedX = Math.round(originalPosition.x + offsetX);
        
        // IMPORTANT: Calculate the actual current start date from the visual position
        // This handles the case where the event was already moved but dragEvent.startDate is stale
        const currentStartDate = scale.invert(originalPosition.x);
        const currentEndDate = new Date(currentStartDate.getTime() + (dragEvent.endDate.getTime() - dragEvent.startDate.getTime()));
        
        // Calculate new dates based on the drag offset using the CURRENT visual position
        const newStartTime = scale.invert(draggedX);
        const newStartDate = snapToInterval(newStartTime);
        const duration = currentEndDate.getTime() - currentStartDate.getTime();
        const newEndDate = new Date(newStartDate.getTime() + duration);
        
        // Calculate final snapped position (rounded to integers)
        const finalX = Math.round(scale(newStartDate));
        const finalWidth = Math.round(scale(newEndDate) - finalX);
        
        // Check if snapping causes a significant visual jump
        const snapDelta = Math.abs(finalX - draggedX);
        
        // If the snap delta is small (< 3px), use the dragged position to avoid micro-jumps
        // This makes the drag feel more responsive while still snapping to the grid
        const visualX = snapDelta < 3 ? draggedX : finalX;
        const visualWidth = snapDelta < 3 ? Math.round(originalPosition.width) : finalWidth;
        
        // Update all elements to final position (use rounded values)
        select(bar)
          .attr("x", visualX + 3)
          .attr("width", Math.max(visualWidth - 6, 12))
          .attr("opacity", 1)
          .style("cursor", "grab");
        
        if (eventGroup) {
          const stripe = eventGroup.querySelector(".scheduler-event-stripe");
          if (stripe) select(stripe).attr("x", visualX + 3);
          
          // Update recurrence icon (if present)
          const recurrenceIcon = eventGroup.querySelector(".scheduler-recurrence-icon");
          const hasRecurrenceIcon = !!recurrenceIcon;
          const iconSpace = hasRecurrenceIcon ? 18 : 0;
          
          if (recurrenceIcon) {
            const currentTransform = recurrenceIcon.getAttribute("transform") || "";
            const scaleMatch = currentTransform.match(/scale\([^)]+\)/);
            const scaleStr = scaleMatch ? scaleMatch[0] : "";
            const translateMatch = currentTransform.match(/translate\([^,]+,\s*([^)]+)\)/);
            const yPos = translateMatch ? translateMatch[1] : "0";
            recurrenceIcon.setAttribute("transform", `translate(${visualX + 13}, ${yPos}) ${scaleStr}`);
          }
          
          const label = eventGroup.querySelector(".scheduler-event-label");
          if (label) select(label).attr("x", visualX + 15 + iconSpace);
          
          const leftHandle = eventGroup.querySelector(".scheduler-resize-handle.resize-left");
          const rightHandle = eventGroup.querySelector(".scheduler-resize-handle.resize-right");
          if (leftHandle) select(leftHandle).attr("x", visualX);
          if (rightHandle) select(rightHandle).attr("x", visualX + visualWidth - 4);
          
          eventGroup.removeAttribute("data-dragging");
        }
        
        // Call move handler if we actually moved (using actual snapped dates for data)
        if (Math.abs(offsetX) > 5) {
          onEventMoveRef.current?.(dragEvent, newStartDate, newEndDate);
        }
        
        // Notify drag ended
        onDragEndRef.current?.();
        
        // Reset drag state
        dragStateRef.current = {
          isDragging: false,
          event: null,
          startX: 0,
          startY: 0,
          currentX: 0,
          currentY: 0,
          offsetX: 0,
          originalPosition: null,
        };
      });
  }, [scale, snapToInterval]); // Scale is needed for position calculations; callbacks use refs

  const createResizeBehavior = useCallback((
    event: SchedulerEvent,
    position: EventPosition,
    handle: "start" | "end"
  ) => {
    return drag<SVGRectElement, unknown>()
      .clickDistance(5) // Allow small mouse movements during click (5px threshold)
      .subject(() => ({
        x: handle === "start" ? position.x : position.x + position.width,
        y: position.y
      }))
      .on("start", function(d) {
        const handleElement = this as SVGRectElement;
        const eventGroup = handleElement.parentElement as SVGGElement | null;
        
        // IMPORTANT: Read the CURRENT visual position from DOM instead of using the stale position
        // This handles the case where the task was moved/resized but no re-render happened yet
        let currentPosition = { ...position };
        
        if (eventGroup) {
          const bar = eventGroup.querySelector(".scheduler-event-bar") as SVGRectElement | null;
          if (bar) {
            const currentBarX = parseFloat(bar.getAttribute("x") || "0");
            const currentBarWidth = parseFloat(bar.getAttribute("width") || "0");
            
            // Convert bar coordinates back to event position coordinates
            const visualX = Math.round(currentBarX - 3);
            const visualWidth = Math.round(currentBarWidth + 6);
            
            // Only use visual position if it's significantly different
            if (Math.abs(visualX - position.x) > 5 || Math.abs(visualWidth - position.width) > 5) {
              currentPosition = {
                ...position,
                x: visualX,
                width: visualWidth,
              };
            }
          }
        }
        
        // Calculate actual current dates from the visual position
        // This handles the case where the task was already moved but event dates are stale
        const currentStartDate = scale.invert(currentPosition.x);
        const currentEndDate = scale.invert(currentPosition.x + currentPosition.width);
        
        resizeStateRef.current = {
          isResizing: true,
          event,
          resizeHandle: handle,
          startX: d.x,
          originalStartDate: currentStartDate,
          originalEndDate: currentEndDate,
          originalPosition: currentPosition,
        };
        
        // Notify resize started (e.g., to hide tooltip)
        onDragStartRef.current?.();
        
        // Visual feedback
        select(handleElement)
          .attr("opacity", 1)
          .attr("fill", "white");
        
        if (eventGroup) {
          eventGroup.setAttribute("data-resizing", "true");
          
          const bar = eventGroup.querySelector(".scheduler-event-bar");
          if (bar) {
            select(bar).attr("opacity", 0.85);
          }
          
          select(eventGroup).raise();
        }
      })
      .on("drag", function(d) {
        const handleElement = this as SVGRectElement;
        const eventGroup = handleElement.parentElement as SVGGElement | null;
        const { resizeHandle, originalPosition } = resizeStateRef.current;
        
        if (!eventGroup || !originalPosition) return;
        
        const bar = eventGroup.querySelector(".scheduler-event-bar") as SVGRectElement | null;
        const stripe = eventGroup.querySelector(".scheduler-event-stripe") as SVGRectElement | null;
        const label = eventGroup.querySelector(".scheduler-event-label") as SVGTextElement | null;
        const leftHandle = eventGroup.querySelector(".scheduler-resize-handle.resize-left") as SVGRectElement | null;
        const rightHandle = eventGroup.querySelector(".scheduler-resize-handle.resize-right") as SVGRectElement | null;
        
        if (!bar) return;
        
        const deltaX = d.x - resizeStateRef.current.startX;
        
        if (resizeHandle === "start") {
          // Resize from left
          const newX = Math.max(0, originalPosition.x + deltaX);
          const newWidth = Math.max(20, originalPosition.width - deltaX);
          
          select(bar).attr("x", newX).attr("width", newWidth);
          if (stripe) select(stripe).attr("x", newX);
          if (label) select(label).attr("x", newX + 10);
          if (leftHandle) select(leftHandle).attr("x", newX - 2);
          if (rightHandle) select(rightHandle).attr("x", newX + newWidth - 3);
          select(handleElement).attr("x", newX - 2);
        } else {
          // Resize from right
          const newWidth = Math.max(20, originalPosition.width + deltaX);
          
          select(bar).attr("width", newWidth);
          if (rightHandle) select(rightHandle).attr("x", originalPosition.x + newWidth - 3);
          select(handleElement).attr("x", originalPosition.x + newWidth - 3);
        }
      })
      .on("end", function(d) {
        const { event, startX, resizeHandle, originalStartDate, originalEndDate, originalPosition } = resizeStateRef.current;
        if (!event || !resizeHandle || !originalPosition) return;
        
        const handleElement = this as SVGRectElement;
        const eventGroup = handleElement.parentElement as SVGGElement | null;
        
        const deltaX = d.x - startX;
        // Use rounded pixel position for time calculation
        const roundedDeltaX = Math.round(deltaX);
        const deltaTime = scale.invert(startX + roundedDeltaX).getTime() - scale.invert(startX).getTime();
        
        let newStartDate = new Date(originalStartDate);
        let newEndDate = new Date(originalEndDate);
        
        if (resizeHandle === "start") {
          newStartDate = snapToInterval(new Date(originalStartDate.getTime() + deltaTime));
          // Ensure start is before end (minimum duration)
          if (newStartDate >= newEndDate) {
            newStartDate = new Date(newEndDate.getTime() - snapInterval);
          }
        } else {
          newEndDate = snapToInterval(new Date(originalEndDate.getTime() + deltaTime));
          // Ensure end is after start (minimum duration)
          if (newEndDate <= newStartDate) {
            newEndDate = new Date(newStartDate.getTime() + snapInterval);
          }
        }
        
        // Calculate final visual position (rounded to integers)
        const finalX = Math.round(scale(newStartDate));
        const finalEndX = Math.round(scale(newEndDate));
        const finalWidth = Math.max(finalEndX - finalX, 20);
        
        // Update all elements to final position
        if (eventGroup) {
          const bar = eventGroup.querySelector(".scheduler-event-bar");
          const stripe = eventGroup.querySelector(".scheduler-event-stripe");
          const label = eventGroup.querySelector(".scheduler-event-label");
          const leftHandle = eventGroup.querySelector(".scheduler-resize-handle.resize-left");
          const rightHandle = eventGroup.querySelector(".scheduler-resize-handle.resize-right");
          
          if (bar) {
            select(bar)
              .attr("x", finalX)
              .attr("width", finalWidth)
              .attr("opacity", 1);
          }
          if (stripe) stripe.setAttribute("x", String(finalX));
          if (label) label.setAttribute("x", String(finalX + 10));
          if (leftHandle) leftHandle.setAttribute("x", String(finalX - 2));
          if (rightHandle) rightHandle.setAttribute("x", String(finalX + finalWidth - 3));
          
          eventGroup.removeAttribute("data-resizing");
        }
        
        // Hide handle
        select(handleElement).attr("opacity", 0);
        
        // Call resize handler
        onEventResizeRef.current?.(event, newStartDate, newEndDate);
        
        // Notify resize ended
        onDragEndRef.current?.();
        
        // Reset state
        resizeStateRef.current = {
          isResizing: false,
          event: null,
          resizeHandle: null,
          startX: 0,
          originalStartDate: new Date(),
          originalEndDate: new Date(),
          originalPosition: null,
        };
      });
  }, [scale, snapToInterval, snapInterval]); // Scale is needed for position calculations; callbacks use refs

  return {
    createDragBehavior,
    createResizeBehavior,
    dragState: dragStateRef.current,
    resizeState: resizeStateRef.current,
    cancelDragOperation, // Exposed for external use if needed
  };
}
