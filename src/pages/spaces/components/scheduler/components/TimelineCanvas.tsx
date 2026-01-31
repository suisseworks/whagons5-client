import { useEffect, useRef, useMemo, useCallback, useState, memo } from "react";
import { select } from "d3-selection";
import { pointer } from "d3-selection";
import "d3-transition";
import type { ScaleTime } from "d3-scale";
import type { ViewPreset, SchedulerEvent, SchedulerResource, EventPosition } from "../types/scheduler";
import { calculateAllEventPositions } from "../utils/eventPositioning";
import { detectOverlaps, adjustPositionsForOverlaps } from "../utils/collisionDetection";
import { useDragDrop } from "../hooks/useDragDrop";
import { TIMELINE_GUTTER_WIDTH } from "../utils/constants";
import EventTooltip from "./EventTooltip";

interface TimelineCanvasProps {
  scale: ScaleTime<number, number>;
  width: number;
  height: number;
  preset: ViewPreset;
  startDate: Date;
  endDate: Date;
  resources: SchedulerResource[];
  events: SchedulerEvent[];
  rowHeight?: number;
  selectedCell?: { row: number; col: number } | null;
  onZoom?: (transform: { x: number; k: number }) => void;
  onEventSelect?: (event: SchedulerEvent) => void;
  onEventDoubleClick?: (event: SchedulerEvent) => void;
  onEventMove?: (event: SchedulerEvent, newStartDate: Date, newEndDate: Date) => void;
  onEventResize?: (event: SchedulerEvent, newStartDate: Date, newEndDate: Date) => void;
  onEmptySpaceClick?: (date: Date, resourceIndex: number, colIndex: number) => void;
  onCurrentTimePosition?: (position: number | null) => void;
}

// Memoized tick interval calculation
function getTickInterval(preset: ViewPreset): number {
  switch (preset) {
    case "hourAndDay":
      return 3600000; // 1 hour
    case "dayAndWeek":
      return 86400000; // 1 day
    case "weekAndMonth":
      return 604800000; // 1 week
    case "monthAndYear":
      return 2592000000; // ~1 month
    default:
      return 3600000;
  }
}

// Check if a date is a weekend
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// Check if date is today
function isToday(date: Date): boolean {
  const today = new Date();
  return date.getFullYear() === today.getFullYear() &&
         date.getMonth() === today.getMonth() &&
         date.getDate() === today.getDate();
}

function TimelineCanvasComponent({
  scale,
  width,
  height,
  preset,
  startDate,
  endDate,
  resources,
  events,
  rowHeight = 60,
  selectedCell,
  onZoom,
  onEventSelect,
  onEventDoubleClick,
  onEventMove,
  onEventResize,
  onEmptySpaceClick,
  onCurrentTimePosition,
}: TimelineCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const renderIdRef = useRef(0);

  // Store callback props in refs to avoid re-rendering the entire SVG when they change
  const onEventSelectRef = useRef(onEventSelect);
  const onEventDoubleClickRef = useRef(onEventDoubleClick);
  const onEmptySpaceClickRef = useRef(onEmptySpaceClick);
  const onEventMoveRef = useRef(onEventMove);
  const onEventResizeRef = useRef(onEventResize);
  
  // Keep refs updated
  useEffect(() => {
    onEventSelectRef.current = onEventSelect;
    onEventDoubleClickRef.current = onEventDoubleClick;
    onEmptySpaceClickRef.current = onEmptySpaceClick;
    onEventMoveRef.current = onEventMove;
    onEventResizeRef.current = onEventResize;
  });

  // Track if we should update only the time indicator (not full re-render)
  const timeIndicatorRef = useRef<{ group: SVGGElement | null; lastUpdate: number }>({ group: null, lastUpdate: 0 });
  
  // Separate effect for updating ONLY the current time indicator (avoids full SVG re-render)
  useEffect(() => {
    const updateTimeIndicator = () => {
      const svg = svgRef.current;
      if (!svg || !scale) return;
      
      const now = new Date();
      const nowTime = now.getTime();
      const isInRange = nowTime >= startDate.getTime() && nowTime <= endDate.getTime();
      
      // Find or create the time indicator group
      const existingGroup = svg.querySelector('.scheduler-time-indicator') as SVGGElement | null;
      
      if (!isInRange) {
        // Remove if out of range
        if (existingGroup) {
          existingGroup.remove();
        }
        return;
      }
      
      // Calculate position
      const msFromStart = nowTime - startDate.getTime();
      const totalRangeMs = endDate.getTime() - startDate.getTime();
      const nowX = Math.round((msFromStart / totalRangeMs) * width);
      
      if (existingGroup) {
        // Update existing elements (much faster than full re-render)
        const line = existingGroup.querySelector('.scheduler-current-time-line') as SVGLineElement | null;
        const glow = existingGroup.querySelector('.scheduler-current-time-glow') as SVGLineElement | null;
        const marker = existingGroup.querySelector('.scheduler-current-time-marker') as SVGRectElement | null;
        const label = existingGroup.querySelector('.scheduler-current-time-label') as SVGTextElement | null;
        
        if (line) {
          line.setAttribute('x1', String(nowX));
          line.setAttribute('x2', String(nowX));
        }
        if (glow) {
          glow.setAttribute('x1', String(nowX));
          glow.setAttribute('x2', String(nowX));
        }
        if (marker) {
          marker.setAttribute('x', String(nowX - 18)); // markerWidth/2 = 36/2 = 18
        }
        if (label) {
          label.setAttribute('x', String(nowX));
          const hours = now.getHours().toString().padStart(2, '0');
          const minutes = now.getMinutes().toString().padStart(2, '0');
          label.textContent = `${hours}:${minutes}`;
        }
      }
    };
    
    // Update immediately
    updateTimeIndicator();
    
    // Update every minute
    const interval = setInterval(updateTimeIndicator, 60000);
    return () => clearInterval(interval);
  }, [scale, width, startDate, endDate]); // Only depends on scale/dimensions, not tick state
  
  // Tooltip state
  const [tooltipState, setTooltipState] = useState<{
    event: SchedulerEvent | null;
    x: number;
    y: number;
    visible: boolean;
    pinned: boolean; // True if tooltip was shown via click (stays visible until click elsewhere)
  }>({ event: null, x: 0, y: 0, visible: false, pinned: false });
  const [isDragging, setIsDragging] = useState(false);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Tooltip functions using refs to avoid re-renders
  const isDraggingRef = useRef(isDragging);
  isDraggingRef.current = isDragging;
  
  // Show tooltip immediately on hover (no delay for now)
  const showTooltip = useCallback((event: SchedulerEvent, x: number, y: number) => {
    // Clear any existing timeout
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    // Show immediately
    setTooltipState({ event, x, y, visible: true, pinned: false });
  }, []);
  
  // Show tooltip immediately on click and pin it (stable reference)
  const showTooltipPinned = useCallback((event: SchedulerEvent, x: number, y: number) => {
    if (isDraggingRef.current) return;
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setTooltipState({ event, x, y, visible: true, pinned: true });
  }, []);
  
  // Hide tooltip (stable reference)
  const hideTooltip = useCallback((force: boolean = false) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setTooltipState(prev => {
      // Don't hide pinned tooltip unless forced (click elsewhere)
      if (prev.pinned && !force) return prev;
      return { ...prev, visible: false, pinned: false };
    });
  }, []);
  
  // Update tooltip position (stable reference)
  const updateTooltipPosition = useCallback((x: number, y: number) => {
    setTooltipState(prev => prev.visible ? { ...prev, x, y } : prev);
  }, []);

  // Track if we're currently in a drag/resize operation
  const isInteractingRef = useRef(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track recently moved events to prevent position jumping after drag
  // Maps event ID to expected position data with timestamp and snapped dates
  const recentlyMovedEventsRef = useRef<Map<number, { 
    x: number; 
    width: number; 
    timestamp: number;
    startDate?: Date;
    endDate?: Date;
  }>>(new Map());
  
  // Drag state callbacks with interaction tracking
  const handleDragStart = useCallback(() => {
    // Clear any pending timeout
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = null;
    }
    isInteractingRef.current = true;
    setIsDragging(true);
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setTooltipState(prev => ({ ...prev, visible: false }));
  }, []);
  
  const handleDragEnd = useCallback(() => {
    // Keep the interaction flag set for longer to allow API response to complete
    // This prevents the SVG from re-rendering while the data is being updated
    interactionTimeoutRef.current = setTimeout(() => {
      isInteractingRef.current = false;
    }, 8000); // 8s grace period for API to complete (increased from 3s to handle slow responses)
    setIsDragging(false);
  }, []);

  // Stable callback wrappers that use refs
  const stableOnEventMove = useCallback((event: SchedulerEvent, start: Date, end: Date) => {
    // Track the expected position to prevent jumping during re-render
    // Store rounded pixel positions for consistency
    const expectedX = Math.round(scale(start));
    const expectedWidth = Math.round(scale(end) - expectedX);
    recentlyMovedEventsRef.current.set(event.id, {
      x: expectedX,
      width: expectedWidth,
      timestamp: Date.now(),
      startDate: start,
      endDate: end,
    });
    // Clean up old entries after 10 seconds (extended from 5s to handle slow API responses)
    setTimeout(() => {
      recentlyMovedEventsRef.current.delete(event.id);
    }, 10000);
    onEventMoveRef.current?.(event, start, end);
  }, [scale]);
  
  const stableOnEventResize = useCallback((event: SchedulerEvent, start: Date, end: Date) => {
    // Track the expected position to prevent jumping during re-render
    // Store rounded pixel positions for consistency
    const expectedX = Math.round(scale(start));
    const expectedWidth = Math.round(scale(end) - expectedX);
    recentlyMovedEventsRef.current.set(event.id, {
      x: expectedX,
      width: expectedWidth,
      timestamp: Date.now(),
      startDate: start,
      endDate: end,
    });
    // Clean up old entries after 10 seconds (extended from 5s to handle slow API responses)
    setTimeout(() => {
      recentlyMovedEventsRef.current.delete(event.id);
    }, 10000);
    onEventResizeRef.current?.(event, start, end);
  }, [scale]);

  // Setup drag & drop
  const { createDragBehavior, createResizeBehavior } = useDragDrop(
    scale,
    rowHeight,
    15 * 60 * 1000, // 15 minute snap interval
    stableOnEventMove,
    stableOnEventResize,
    handleDragStart,
    handleDragEnd
  );
  
  // Store behaviors in refs so they don't trigger the main useEffect
  const createDragBehaviorRef = useRef(createDragBehavior);
  const createResizeBehaviorRef = useRef(createResizeBehavior);
  createDragBehaviorRef.current = createDragBehavior;
  createResizeBehaviorRef.current = createResizeBehavior;

  // Memoize tick calculations to prevent recalculation
  const tickInterval = useMemo(() => getTickInterval(preset), [preset]);
  
  const ticks = useMemo(() => {
    const result: Date[] = [];
    let current = new Date(startDate);
    while (current <= endDate) {
      result.push(new Date(current));
      current = new Date(current.getTime() + tickInterval);
    }
    return result;
  }, [startDate, endDate, tickInterval]);

  // Memoize event positions - this is the key optimization
  const memoizedPositions = useMemo(() => {
    if (!scale || events.length === 0 || resources.length === 0) {
      return new Map<number, EventPosition>();
    }
    const positions = calculateAllEventPositions(events, resources, scale, rowHeight);
    const overlaps = detectOverlaps(events, positions);
    return adjustPositionsForOverlaps(positions, overlaps);
  }, [events, resources, scale, rowHeight]);

  // Single consolidated rendering effect
  useEffect(() => {
    if (!svgRef.current || !scale) return;
    
    // Skip full re-render if we're actively dragging/resizing
    // (the drag behavior handles visual updates during interaction)
    if (isInteractingRef.current) return;
    
    const currentRenderId = ++renderIdRef.current;
    const svg = select(svgRef.current);
    
    // Clear everything and re-render in one pass
    svg.selectAll("*").remove();
    
    // Create single parent group with transform (only one transform!)
    const mainGroup = svg.append("g")
      .attr("class", "timeline-main")
      .attr("transform", `translate(${TIMELINE_GUTTER_WIDTH}, 0)`);
    
    // Create shared defs for all filters/gradients
    const defs = svg.append("defs");
    
    // Modern multi-layer shadow filter (Bryntum-inspired)
    const shadowFilter = defs.append("filter")
      .attr("id", "event-shadow")
      .attr("x", "-20%")
      .attr("y", "-20%")
      .attr("width", "140%")
      .attr("height", "150%");
    
    // Ambient shadow (soft, wide spread)
    shadowFilter.append("feDropShadow")
      .attr("dx", 0)
      .attr("dy", 1)
      .attr("stdDeviation", 2)
      .attr("flood-color", "rgba(0,0,0,0.06)");
    
    // Key shadow (sharper, more defined)
    shadowFilter.append("feDropShadow")
      .attr("dx", 0)
      .attr("dy", 3)
      .attr("stdDeviation", 4)
      .attr("flood-color", "rgba(0,0,0,0.1)");
    
    // Hover shadow filter (elevated effect)
    const hoverShadowFilter = defs.append("filter")
      .attr("id", "event-shadow-hover")
      .attr("x", "-25%")
      .attr("y", "-25%")
      .attr("width", "150%")
      .attr("height", "160%");
    
    // Ambient layer for hover
    hoverShadowFilter.append("feDropShadow")
      .attr("dx", 0)
      .attr("dy", 2)
      .attr("stdDeviation", 3)
      .attr("flood-color", "rgba(0,0,0,0.08)");
    
    // Key shadow for hover (deeper)
    hoverShadowFilter.append("feDropShadow")
      .attr("dx", 0)
      .attr("dy", 6)
      .attr("stdDeviation", 8)
      .attr("flood-color", "rgba(0,0,0,0.15)");
    
    // Glow effect for hover
    hoverShadowFilter.append("feDropShadow")
      .attr("dx", 0)
      .attr("dy", 0)
      .attr("stdDeviation", 6)
      .attr("flood-color", "rgba(0,0,0,0.05)");

    // ============ RENDER GRID (Modern, minimal design) ============
    const gridGroup = mainGroup.append("g").attr("class", "grid-layer");
    
    // Zebra striping for rows (very subtle alternating backgrounds)
    const numRows = Math.max(resources.length, Math.floor(height / rowHeight));
    for (let i = 0; i < numRows; i++) {
      if (i % 2 === 1) {
        gridGroup.append("rect")
          .attr("class", "scheduler-zebra-row")
          .attr("x", 0)
          .attr("y", i * rowHeight)
          .attr("width", width)
          .attr("height", rowHeight)
          .attr("fill", "var(--scheduler-zebra-stripe, rgba(0, 0, 0, 0.012))");
      }
    }
    
    // Weekend/non-working time backgrounds (render on top of zebra)
    if (preset === "hourAndDay" || preset === "dayAndWeek") {
      ticks.forEach((tick, i) => {
        if (i >= ticks.length - 1) return;
        const nextTick = ticks[i + 1];
        const x1 = scale(tick);
        const x2 = scale(nextTick);
        
        // Weekend shading (subtle gray tint)
        if (isWeekend(tick)) {
          gridGroup.append("rect")
            .attr("x", x1)
            .attr("y", 0)
            .attr("width", x2 - x1)
            .attr("height", height)
            .attr("fill", "var(--scheduler-weekend-bg, rgba(0, 0, 0, 0.015))")
            .attr("class", "scheduler-weekend-bg");
        }
        
        // Today highlight (soft blue accent)
        if (isToday(tick)) {
          // Background fill
          gridGroup.append("rect")
            .attr("x", x1)
            .attr("y", 0)
            .attr("width", x2 - x1)
            .attr("height", height)
            .attr("fill", "var(--scheduler-today-bg, rgba(59, 130, 246, 0.035))")
            .attr("class", "scheduler-today-bg");
          // Left accent line for today (gradient fade)
          const todayGradient = defs.append("linearGradient")
            .attr("id", "today-line-gradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%");
          todayGradient.append("stop").attr("offset", "0%").attr("stop-color", "hsl(var(--primary))").attr("stop-opacity", "0.5");
          todayGradient.append("stop").attr("offset", "50%").attr("stop-color", "hsl(var(--primary))").attr("stop-opacity", "0.2");
          todayGradient.append("stop").attr("offset", "100%").attr("stop-color", "hsl(var(--primary))").attr("stop-opacity", "0.05");
          
          gridGroup.append("line")
            .attr("x1", x1)
            .attr("x2", x1)
            .attr("y1", 0)
            .attr("y2", height)
            .attr("stroke", "url(#today-line-gradient)")
            .attr("stroke-width", 2)
            .attr("class", "scheduler-today-accent");
        }
      });
    }
    
    // Vertical grid lines (ultra-subtle, Bryntum-style)
    gridGroup.selectAll("line.v-grid")
      .data(ticks)
      .enter()
      .append("line")
      .attr("class", "scheduler-grid-line-v")
      .attr("x1", d => scale(d))
      .attr("x2", d => scale(d))
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "var(--scheduler-grid-line, currentColor)")
      .attr("stroke-width", 1)
      .attr("opacity", 1);
    
    // Horizontal grid lines (clean row separators)
    for (let i = 0; i <= numRows; i++) {
      gridGroup.append("line")
        .attr("class", "scheduler-grid-line-h")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", i * rowHeight)
        .attr("y2", i * rowHeight)
        .attr("stroke", "var(--scheduler-grid-line, currentColor)")
        .attr("stroke-width", 1)
        .attr("opacity", i === 0 ? 1 : 1);
    }

    // ============ RENDER HOVER CELLS (Modern interaction style) ============
    const hoverGroup = mainGroup.append("g").attr("class", "hover-layer");
    
    for (let rowIndex = 0; rowIndex < resources.length; rowIndex++) {
      for (let i = 0; i < ticks.length - 1; i++) {
        const x1 = scale(ticks[i]);
        const x2 = scale(ticks[i + 1]);
        const cellWidth = x2 - x1;
        
        if (cellWidth < 2) continue;
        
        const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === i;
        const cellPadding = 2;
        
        const cell = hoverGroup.append("rect")
          .attr("class", "scheduler-hover-cell")
          .attr("data-row", rowIndex)
          .attr("data-col", i)
          .attr("x", x1 + cellPadding)
          .attr("y", rowIndex * rowHeight + cellPadding)
          .attr("width", cellWidth - cellPadding * 2)
          .attr("height", rowHeight - cellPadding * 2)
          .attr("fill", isSelected ? "var(--scheduler-hover-cell, rgba(59, 130, 246, 0.1))" : "transparent")
          .attr("stroke", isSelected ? "hsl(var(--primary))" : "transparent")
          .attr("stroke-width", isSelected ? 2 : 0)
          .attr("stroke-dasharray", "none")
          .attr("rx", 6)
          .style("cursor", "cell")
          .style("pointer-events", "all")
          .style("transition", "all 150ms cubic-bezier(0.4, 0, 0.2, 1)");
        
        // Smooth hover effect with transition
        cell
          .on("mouseenter", function() {
            if (!isSelected) {
              select(this)
                .attr("fill", "var(--scheduler-hover-cell, rgba(59, 130, 246, 0.06))")
                .attr("stroke", "var(--scheduler-hover-cell-border, rgba(59, 130, 246, 0.25))")
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", "6 3");
            }
          })
          .on("mouseleave", function() {
            if (!isSelected) {
              select(this)
                .attr("fill", "transparent")
                .attr("stroke", "transparent")
                .attr("stroke-width", 0)
                .attr("stroke-dasharray", "none");
            }
          })
          .on("click", function(event: MouseEvent) {
            event.stopPropagation();
            // Dismiss any pinned tooltip when clicking empty space
            hideTooltip(true);
            onEmptySpaceClickRef.current?.(ticks[i], rowIndex, i);
          });
      }
    }

    // ============ RENDER CURRENT TIME INDICATOR ============
    // Use fresh Date() - timeRefreshTick triggers re-render every minute
    const now = new Date();
    const nowTime = now.getTime();
    const isInRange = nowTime >= startDate.getTime() && nowTime <= endDate.getTime();
    
    if (isInRange) {
      const timeGroup = mainGroup.append("g").attr("class", "scheduler-time-indicator");
      
      // Calculate nowX manually to avoid any timezone conversion issues
      const msFromStart = nowTime - startDate.getTime();
      const totalRangeMs = endDate.getTime() - startDate.getTime();
      const nowX = (msFromStart / totalRangeMs) * width;
      
      // Gradient for the time line (fade at the bottom)
      const timeLineGradient = defs.append("linearGradient")
        .attr("id", "current-time-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");
      timeLineGradient.append("stop").attr("offset", "0%").attr("stop-color", "hsl(var(--destructive))").attr("stop-opacity", "0.9");
      timeLineGradient.append("stop").attr("offset", "85%").attr("stop-color", "hsl(var(--destructive))").attr("stop-opacity", "0.7");
      timeLineGradient.append("stop").attr("offset", "100%").attr("stop-color", "hsl(var(--destructive))").attr("stop-opacity", "0.3");
      
      // Soft glow behind line (atmospheric effect)
      timeGroup.append("line")
        .attr("class", "scheduler-current-time-glow")
        .attr("x1", nowX)
        .attr("x2", nowX)
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "hsl(var(--destructive))")
        .attr("stroke-width", 8)
        .attr("opacity", 0.08);
      
      // Main line with gradient
      timeGroup.append("line")
        .attr("class", "scheduler-current-time-line")
        .attr("x1", nowX)
        .attr("x2", nowX)
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "url(#current-time-gradient)")
        .attr("stroke-width", 2);
      
      // Top marker - rounded pill shape (modern design)
      const markerWidth = 36;
      const markerHeight = 18;
      timeGroup.append("rect")
        .attr("class", "scheduler-current-time-marker")
        .attr("x", nowX - markerWidth / 2)
        .attr("y", 0)
        .attr("width", markerWidth)
        .attr("height", markerHeight)
        .attr("rx", markerHeight / 2)
        .attr("ry", markerHeight / 2)
        .attr("fill", "hsl(var(--destructive))");
      
      // Time label inside the pill
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      timeGroup.append("text")
        .attr("class", "scheduler-current-time-label")
        .attr("x", nowX)
        .attr("y", markerHeight / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "10px")
        .attr("font-weight", "600")
        .attr("fill", "white")
        .style("pointer-events", "none")
        .text(`${hours}:${minutes}`);
    }

    // ============ RENDER EVENTS (Modern Bryntum-inspired style) ============
    const eventsGroup = mainGroup.append("g").attr("class", "events-layer");
    
    events.forEach((event) => {
      let position = memoizedPositions.get(event.id);
      if (!position) return;
      
      // Check if this event was recently moved/resized and use expected position to prevent jumping
      const recentMove = recentlyMovedEventsRef.current.get(event.id);
      if (recentMove && Date.now() - recentMove.timestamp < 10000) {
        // Verify that the stored dates match what we expect
        // This handles cases where Redux updates with unexpected data
        const dateMatch = (!recentMove.startDate || !recentMove.endDate) ||
          (Math.abs(event.startDate.getTime() - recentMove.startDate.getTime()) < 60000 &&
           Math.abs(event.endDate.getTime() - recentMove.endDate.getTime()) < 60000);
        
        if (dateMatch) {
          // Use the expected position from the recent move (rounded values)
          position = {
            ...position,
            x: recentMove.x,
            width: recentMove.width,
          };
        } else {
          // Dates don't match - clear the tracking for this event
          recentlyMovedEventsRef.current.delete(event.id);
        }
      }
      
      const baseColor = event.color || "#6366f1";
      const eventId = event.id;
      
      // Create gradient for this event (refined multi-stop gradient for depth)
      const gradientId = `grad-${eventId}`;
      const gradient = defs.append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");
      
      // Three-stop gradient for more depth
      gradient.append("stop").attr("offset", "0%").attr("stop-color", lightenColor(baseColor, 12));
      gradient.append("stop").attr("offset", "50%").attr("stop-color", baseColor);
      gradient.append("stop").attr("offset", "100%").attr("stop-color", darkenColor(baseColor, 8));
      
      // Event group
      const eventGroup = eventsGroup.append("g")
        .attr("class", `scheduler-event-group event-group-${eventId}`)
        .style("pointer-events", "all");
      
      // Modern event bar with increased padding and rounded corners
      const barPadding = 6;
      const barHeight = position.height - barPadding * 2;
      const barY = position.y + barPadding;
      const barX = position.x + 3;
      const barWidth = Math.max(position.width - 6, 12);
      const borderRadius = 8;
      
      const bar = eventGroup.append("rect")
        .attr("class", "scheduler-event-bar")
        .attr("x", barX)
        .attr("y", barY)
        .attr("width", barWidth)
        .attr("height", barHeight)
        .attr("fill", `url(#${gradientId})`)
        .attr("rx", borderRadius)
        .attr("ry", borderRadius)
        .attr("stroke", darkenColor(baseColor, 15))
        .attr("stroke-width", 0.5)
        .attr("stroke-opacity", 0.4)
        .attr("filter", "url(#event-shadow)")
        .style("cursor", "grab");
      
      // Left accent stripe (refined with rounded clip)
      const stripeWidth = 4;
      const stripeGradientId = `stripe-${eventId}`;
      const stripeGradient = defs.append("linearGradient")
        .attr("id", stripeGradientId)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");
      stripeGradient.append("stop").attr("offset", "0%").attr("stop-color", darkenColor(baseColor, 15));
      stripeGradient.append("stop").attr("offset", "100%").attr("stop-color", darkenColor(baseColor, 30));
      
      // Create a clip path for the stripe to match the bar's rounded corners
      const stripeClipId = `stripe-clip-${eventId}`;
      const stripeClip = defs.append("clipPath").attr("id", stripeClipId);
      stripeClip.append("rect")
        .attr("x", barX)
        .attr("y", barY)
        .attr("width", stripeWidth + borderRadius)
        .attr("height", barHeight)
        .attr("rx", borderRadius)
        .attr("ry", borderRadius);
      
      eventGroup.append("rect")
        .attr("class", "scheduler-event-stripe")
        .attr("x", barX)
        .attr("y", barY)
        .attr("width", stripeWidth)
        .attr("height", barHeight)
        .attr("fill", `url(#${stripeGradientId})`)
        .attr("clip-path", `url(#${stripeClipId})`)
        .style("pointer-events", "none");
      
      // Recurrence icon (if recurring task)
      const hasRecurrenceIcon = event.isRecurring && barWidth > 50;
      const iconSpace = hasRecurrenceIcon ? 18 : 0;
      
      // Show recurrence icon for recurring tasks
      if (hasRecurrenceIcon) {
        const iconSize = 12;
        const iconX = barX + stripeWidth + 6;
        const iconY = barY + barHeight / 2 - iconSize / 2;
        
        // Repeat/refresh icon SVG path (circular arrows)
        eventGroup.append("path")
          .attr("class", "scheduler-recurrence-icon")
          .attr("d", "M4.5 0C2.015 0 0 2.015 0 4.5S2.015 9 4.5 9c1.576 0 2.954-.815 3.75-2.047l-.797-.6C6.805 7.336 5.732 8 4.5 8 2.567 8 1 6.433 1 4.5S2.567 1 4.5 1c1.234 0 2.31.666 2.953 1.648l.797-.6C7.454.815 6.076 0 4.5 0zm3.5 4v2.5H5.5v1H9V4H8z")
          .attr("transform", `translate(${iconX}, ${iconY}) scale(${iconSize / 9})`)
          .attr("fill", "rgba(255,255,255,0.9)")
          .style("pointer-events", "none");
      }
      
      // Event label (refined typography with better positioning)
      if (barWidth > 60) {
        const labelX = barX + stripeWidth + 8 + iconSpace;
        const label = eventGroup.append("text")
          .attr("class", "scheduler-event-label")
          .attr("x", labelX)
          .attr("y", barY + barHeight / 2)
          .attr("dy", "0.35em")
          .attr("font-size", "11px")
          .attr("font-weight", "500")
          .attr("letter-spacing", "0.02em")
          .attr("fill", "white")
          .style("pointer-events", "none")
          .style("text-shadow", "0 1px 3px rgba(0,0,0,0.3)")
          .text(event.name);
        
        // Truncate if needed
        const textNode = label.node();
        if (textNode) {
          const textLength = textNode.getComputedTextLength();
          const maxWidth = barWidth - stripeWidth - 16 - iconSpace;
          if (textLength > maxWidth) {
            let truncated = event.name;
            while (truncated.length > 3 && textNode.getComputedTextLength() > maxWidth) {
              truncated = truncated.slice(0, -1);
              label.text(truncated + "…");
            }
          }
        }
      }
      
      // Modern resize handles (sleek pill-shaped, hidden by default)
      if (barWidth > 40 && onEventResize) {
        const handleHeight = 20;
        const handleWidth = 6;
        const handleRadius = 3;
        
        // Left handle
        const leftHandle = eventGroup.append("rect")
          .attr("class", "scheduler-resize-handle resize-left")
          .attr("x", barX - 1)
          .attr("y", barY + barHeight / 2 - handleHeight / 2)
          .attr("width", handleWidth)
          .attr("height", handleHeight)
          .attr("fill", "white")
          .attr("stroke", darkenColor(baseColor, 25))
          .attr("stroke-width", 1)
          .attr("rx", handleRadius)
          .attr("opacity", 0)
          .style("cursor", "ew-resize")
          .style("pointer-events", "all")
          .style("filter", "drop-shadow(0 1px 2px rgba(0,0,0,0.2))");
        
        leftHandle.call(createResizeBehaviorRef.current(event, position, "start"));
        
        // Right handle
        const rightHandle = eventGroup.append("rect")
          .attr("class", "scheduler-resize-handle resize-right")
          .attr("x", barX + barWidth - handleWidth + 1)
          .attr("y", barY + barHeight / 2 - handleHeight / 2)
          .attr("width", handleWidth)
          .attr("height", handleHeight)
          .attr("fill", "white")
          .attr("stroke", darkenColor(baseColor, 25))
          .attr("stroke-width", 1)
          .attr("rx", handleRadius)
          .attr("opacity", 0)
          .style("cursor", "ew-resize")
          .style("pointer-events", "all")
          .style("filter", "drop-shadow(0 1px 2px rgba(0,0,0,0.2))");
        
        rightHandle.call(createResizeBehaviorRef.current(event, position, "end"));
      }
      
      // Add drag behavior FIRST (so it captures pointer events)
      if (onEventMoveRef.current) {
        bar.call(createDragBehaviorRef.current(event, position));
      }
      
      // Event interactions - use native DOM listeners to avoid d3-drag conflicts
      const barNode = bar.node();
      if (barNode) {
        // Double click to open task
        barNode.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          hideTooltip(true);
          onEventDoubleClickRef.current?.(event);
        });
        
        // Pointer events for hover (works better with d3-drag)
        barNode.addEventListener("pointerenter", (e: PointerEvent) => {
          const group = eventGroup.node();
          if (group?.getAttribute("data-dragging") === "true" || 
              group?.getAttribute("data-resizing") === "true") return;
          
          // Smooth hover transition
          select(barNode)
            .transition()
            .duration(150)
            .attr("stroke-width", 1)
            .attr("stroke-opacity", 0.6)
            .attr("filter", "url(#event-shadow-hover)");
          
          // Slight scale effect on the entire group
          eventGroup
            .transition()
            .duration(150)
            .attr("transform", "translate(0, -1)");
          
          eventGroup.selectAll(".scheduler-resize-handle")
            .transition()
            .duration(150)
            .attr("opacity", 1);
          eventGroup.raise();
          
          // Show tooltip on hover
          showTooltip(event, e.clientX, e.clientY);
        });
        
        barNode.addEventListener("pointermove", (e: PointerEvent) => {
          const group = eventGroup.node();
          if (group?.getAttribute("data-dragging") === "true" || 
              group?.getAttribute("data-resizing") === "true") return;
          
          updateTooltipPosition(e.clientX, e.clientY);
        });
        
        barNode.addEventListener("pointerleave", () => {
          const group = eventGroup.node();
          if (group?.getAttribute("data-dragging") === "true" || 
              group?.getAttribute("data-resizing") === "true") return;
          
          // Smooth return to normal state
          select(barNode)
            .transition()
            .duration(150)
            .attr("stroke-width", 0.5)
            .attr("stroke-opacity", 0.4)
            .attr("filter", "url(#event-shadow)");
          
          eventGroup
            .transition()
            .duration(150)
            .attr("transform", "translate(0, 0)");
          
          eventGroup.selectAll(".scheduler-resize-handle")
            .transition()
            .duration(150)
            .attr("opacity", 0);
          
          hideTooltip();
        });
      }
    });

    // Raise events layer to top
    eventsGroup.raise();
    
  }, [
    scale, width, height, preset, startDate, endDate, rowHeight,
    ticks, tickInterval, resources, events, memoizedPositions,
    selectedCell,
    showTooltip, showTooltipPinned, hideTooltip, updateTooltipPosition
    // Note: callbacks and drag behaviors use refs to prevent SVG re-render
    // Note: timeRefreshTick removed - time indicator updates via separate effect
  ]);

  // Track hovered event using React events (bypasses d3 event issues)
  const hoveredEventRef = useRef<SchedulerEvent | null>(null);
  
  const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      hoveredEventRef.current = null;
      return;
    }
    
    const svg = svgRef.current;
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - TIMELINE_GUTTER_WIDTH;
    const mouseY = e.clientY - rect.top;
    
    // Find which event is under the mouse
    let foundEvent: SchedulerEvent | null = null;
    for (const evt of events) {
      const pos = memoizedPositions.get(evt.id);
      if (pos) {
        // Check if mouse is within the event bar bounds
        if (mouseX >= pos.x && mouseX <= pos.x + pos.width &&
            mouseY >= pos.y && mouseY <= pos.y + pos.height) {
          foundEvent = evt;
          break;
        }
      }
    }
    
    if (foundEvent) {
      if (foundEvent.id !== hoveredEventRef.current?.id) {
        // New event hovered
        hoveredEventRef.current = foundEvent;
      }
      // Always update tooltip when over an event
      showTooltip(foundEvent, e.clientX, e.clientY);
    } else if (hoveredEventRef.current) {
      // Left event area
      hoveredEventRef.current = null;
      hideTooltip();
    }
  }, [events, memoizedPositions, isDragging, showTooltip, hideTooltip]);
  
  const handleSvgMouseLeave = useCallback(() => {
    hoveredEventRef.current = null;
    hideTooltip();
  }, [hideTooltip]);

  return (
    <>
      <div 
        style={{ 
          width: width + TIMELINE_GUTTER_WIDTH * 2, 
          height: height,
          minWidth: width + TIMELINE_GUTTER_WIDTH * 2,
          minHeight: height,
          position: "relative",
        }}
      >
        <svg
          ref={svgRef}
          width={width + TIMELINE_GUTTER_WIDTH * 2}
          height={height}
          className="timeline-canvas bg-background"
          style={{ 
            display: "block", 
            cursor: "default",
          }}
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={handleSvgMouseLeave}
        />
      </div>
      <EventTooltip
        event={tooltipState.event}
        x={tooltipState.x}
        y={tooltipState.y}
        visible={tooltipState.visible}
        isDragging={isDragging}
        pinned={tooltipState.pinned}
      />
    </>
  );
}

// Helper functions for color manipulation
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function parseColor(color: string): { r: number; g: number; b: number } | null {
  if (color.startsWith("rgb")) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      return {
        r: parseInt(match[0]),
        g: parseInt(match[1]),
        b: parseInt(match[2]),
      };
    }
  }
  return hexToRgb(color);
}

function lightenColor(color: string, percent: number): string {
  const rgb = parseColor(color);
  if (rgb) {
    const r = Math.min(255, rgb.r + percent * 2.55);
    const g = Math.min(255, rgb.g + percent * 2.55);
    const b = Math.min(255, rgb.b + percent * 2.55);
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }
  return color;
}

function darkenColor(color: string, percent: number): string {
  const rgb = parseColor(color);
  if (rgb) {
    const r = Math.max(0, rgb.r - percent * 2.55);
    const g = Math.max(0, rgb.g - percent * 2.55);
    const b = Math.max(0, rgb.b - percent * 2.55);
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }
  return color;
}

// Custom comparison function to prevent unnecessary re-renders
// Only re-render when significant props change, not callback changes
function arePropsEqual(
  prevProps: TimelineCanvasProps,
  nextProps: TimelineCanvasProps
): boolean {
  // Always re-render if data changes
  if (prevProps.events !== nextProps.events) return false;
  if (prevProps.resources !== nextProps.resources) return false;
  if (prevProps.scale !== nextProps.scale) return false;
  
  // Re-render on dimension changes
  if (prevProps.width !== nextProps.width) return false;
  if (prevProps.height !== nextProps.height) return false;
  if (prevProps.rowHeight !== nextProps.rowHeight) return false;
  
  // Re-render on date range changes
  if (prevProps.startDate?.getTime() !== nextProps.startDate?.getTime()) return false;
  if (prevProps.endDate?.getTime() !== nextProps.endDate?.getTime()) return false;
  
  // Re-render on view changes
  if (prevProps.preset !== nextProps.preset) return false;
  
  // Re-render on selection changes
  if (prevProps.selectedCell?.row !== nextProps.selectedCell?.row) return false;
  if (prevProps.selectedCell?.col !== nextProps.selectedCell?.col) return false;
  
  // Skip re-render for callback changes (they use refs internally)
  return true;
}

// Wrap with React.memo using custom comparison
const TimelineCanvas = memo(TimelineCanvasComponent, arePropsEqual);

export default TimelineCanvas;
