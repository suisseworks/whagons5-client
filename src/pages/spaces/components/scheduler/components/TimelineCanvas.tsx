import { useEffect, useRef } from "react";
import { select } from "d3-selection";
import { pointer } from "d3-selection";
import { zoom as d3Zoom, zoomIdentity } from "d3-zoom";
import type { ScaleTime } from "d3-scale";
import type { ViewPreset, SchedulerEvent, SchedulerResource } from "../types/scheduler";
import { calculateAllEventPositions } from "../utils/eventPositioning";
import { detectOverlaps, adjustPositionsForOverlaps } from "../utils/collisionDetection";
import { useDragDrop } from "../hooks/useDragDrop";

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
  onZoom?: (transform: { x: number; k: number }) => void;
  onEventSelect?: (event: SchedulerEvent) => void;
  onEventDoubleClick?: (event: SchedulerEvent) => void;
  onEventMove?: (event: SchedulerEvent, newStartDate: Date, newEndDate: Date) => void;
  onEventResize?: (event: SchedulerEvent, newStartDate: Date, newEndDate: Date) => void;
  onEmptySpaceClick?: (date: Date, resourceIndex: number) => void;
}

export default function TimelineCanvas({
  scale,
  width,
  height,
  preset,
  startDate,
  endDate,
  resources,
  events,
  rowHeight = 60,
  onZoom,
  onEventSelect,
  onEventDoubleClick,
  onEventMove,
  onEventResize,
  onEmptySpaceClick,
}: TimelineCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const eventsGroupRef = useRef<SVGGElement>(null);

  // Setup drag & drop
  const { createDragBehavior, createResizeBehavior } = useDragDrop(
    scale,
    rowHeight,
    15 * 60 * 1000, // 15 minute snap interval
    onEventMove,
    onEventResize
  );

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const svg = select(svgRef.current);
    const g = select(gRef.current);

    // Clear previous content
    g.selectAll("*").remove();

    // Draw grid lines
    const gridLines = g.append("g").attr("class", "grid-lines");

    // Vertical lines for time intervals
    const tickInterval = getTickInterval(preset);
    const ticks: Date[] = [];
    let current = new Date(startDate);

    while (current <= endDate) {
      ticks.push(new Date(current));
      current = new Date(current.getTime() + tickInterval);
    }

    gridLines
      .selectAll("line")
      .data(ticks)
      .enter()
      .append("line")
      .attr("x1", (d) => scale(d))
      .attr("x2", (d) => scale(d))
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "currentColor")
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.1);

    // Horizontal lines for resources
    const numRows = Math.floor(height / rowHeight);
    for (let i = 0; i <= numRows; i++) {
      gridLines
        .append("line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", i * rowHeight)
        .attr("y2", i * rowHeight)
        .attr("stroke", "currentColor")
        .attr("stroke-width", 0.5)
        .attr("opacity", 0.1);
    }

    // Current time indicator
    const now = new Date();
    if (now >= startDate && now <= endDate) {
      g.append("line")
        .attr("x1", scale(now))
        .attr("x2", scale(now))
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "hsl(var(--destructive))")
        .attr("stroke-width", 2)
        .attr("opacity", 0.8)
        .attr("class", "current-time-indicator");
    }

    // Setup zoom behavior
    const zoom = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on("zoom", (event) => {
        const transform = event.transform;
        g.attr("transform", transform.toString());
        
        if (onZoom) {
          onZoom({ x: transform.x, k: transform.k });
        }
      });

    svg.call(zoom);

    // Reset zoom on double click (but not on event bars)
    svg.on("dblclick.zoom", (event) => {
      // Only reset if clicking on background, not on an event
      if ((event.target as SVGElement).tagName !== "rect") {
        svg.transition()
          .duration(750)
          .call(zoom.transform, zoomIdentity);
      }
    });

    // Handle click on empty space to create new event
    if (onEmptySpaceClick) {
      g.on("click", function(event: MouseEvent) {
        const target = event.target as SVGElement;
        // Only trigger if clicking on background (grid lines, grid-lines group, or the main group)
        // Don't trigger if clicking on event bars (rect elements that are not grid lines)
        const isGridLine = target.tagName === "line";
        const isGridLinesGroup = target.classList.contains("grid-lines") || 
                                 target.closest(".grid-lines") !== null;
        const isMainGroup = target === g.node();
        const isEventBar = target.closest(".events-group") !== null && 
                          target.tagName === "rect" && 
                          !target.closest(".grid-lines");
        
        if ((isGridLine || isGridLinesGroup || isMainGroup) && !isEventBar) {
          const [x, y] = pointer(event, g.node() as SVGGElement);
          const clickedDate = scale.invert(x);
          const resourceIndex = Math.floor(y / rowHeight);
          
          if (resourceIndex >= 0 && resourceIndex < resources.length) {
            onEmptySpaceClick(clickedDate, resourceIndex);
          }
        }
      });
    }
  }, [scale, width, height, preset, startDate, endDate, rowHeight, onZoom, onEmptySpaceClick, resources.length]);

  // Render events with performance optimization
  useEffect(() => {
    if (!eventsGroupRef.current || !scale || events.length === 0) {
      if (eventsGroupRef.current) {
        select(eventsGroupRef.current).selectAll("*").remove();
      }
      return;
    }

    const eventsGroup = select(eventsGroupRef.current);
    
    // Use requestAnimationFrame for smooth rendering
    let renderFrame = requestAnimationFrame(() => {
      eventsGroup.selectAll("*").remove();

      // Calculate positions for all events
      const positions = calculateAllEventPositions(events, resources, scale, rowHeight);
      
      // Detect and handle overlaps
      const overlaps = detectOverlaps(events, positions);
      const adjustedPositions = adjustPositionsForOverlaps(positions, overlaps);

      // Render each event
      events.forEach((event) => {
      const position = adjustedPositions.get(event.id);
      if (!position) return;

      // Create a group for each event
      const eventGroup = eventsGroup.append("g").attr("class", `event-group-${event.id}`);
      
      // Render event bar using D3
      const bar = eventGroup
        .append("rect")
        .attr("x", position.x)
        .attr("y", position.y)
        .attr("width", Math.max(position.width, 4))
        .attr("height", position.height)
        .attr("fill", event.color || "#6366f1")
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("stroke", "rgba(0, 0, 0, 0.1)")
        .attr("stroke-width", 1)
        .style("cursor", "move")
        .on("click", (e) => {
          e.stopPropagation();
          onEventSelect?.(event);
        })
        .on("dblclick", (e) => {
          e.stopPropagation();
          onEventDoubleClick?.(event);
        });

      // Add drag behavior
      if (onEventMove) {
        bar.call(createDragBehavior(event, position));
      }

      // Add hover effect
      bar
        .on("mouseenter", function () {
          select(this).attr("opacity", 0.8);
        })
        .on("mouseleave", function () {
          select(this).attr("opacity", 1);
        });

      // Add resize handles if event is wide enough
      if (position.width > 20 && onEventResize) {
        // Start resize handle
        const startHandle = eventGroup
          .append("rect")
          .attr("x", position.x - 2)
          .attr("y", position.y)
          .attr("width", 4)
          .attr("height", position.height)
          .attr("fill", "rgba(255, 255, 255, 0.5)")
          .attr("stroke", "rgba(0, 0, 0, 0.2)")
          .attr("stroke-width", 1)
          .style("cursor", "ew-resize")
          .style("opacity", 0)
          .on("mouseenter", function () {
            select(this).style("opacity", 1);
          })
          .on("mouseleave", function () {
            select(this).style("opacity", 0);
          });

        startHandle.call(createResizeBehavior(event, position, "start"));

        // End resize handle
        const endHandle = eventGroup
          .append("rect")
          .attr("x", position.x + position.width - 2)
          .attr("y", position.y)
          .attr("width", 4)
          .attr("height", position.height)
          .attr("fill", "rgba(255, 255, 255, 0.5)")
          .attr("stroke", "rgba(0, 0, 0, 0.2)")
          .attr("stroke-width", 1)
          .style("cursor", "ew-resize")
          .style("opacity", 0)
          .on("mouseenter", function () {
            select(this).style("opacity", 1);
          })
          .on("mouseleave", function () {
            select(this).style("opacity", 0);
          });

        endHandle.call(createResizeBehavior(event, position, "end"));
      }

      // Draw event label if there's enough space
      if (position.width > 60) {
        const label = eventGroup
          .append("text")
          .attr("x", position.x + 6)
          .attr("y", position.y + position.height / 2)
          .attr("dy", "0.35em")
          .attr("font-size", "12px")
          .attr("fill", "white")
          .attr("pointer-events", "none")
          .text(event.name);

        // Truncate text if too long
        const textLength = (label.node() as SVGTextElement)?.getComputedTextLength() || 0;
        if (textLength > position.width - 12) {
          const truncated = event.name.substring(0, Math.floor((event.name.length * (position.width - 12)) / textLength) - 3) + "...";
          label.text(truncated);
        }
      }
      });
    });

    return () => {
      if (renderFrame) {
        cancelAnimationFrame(renderFrame);
      }
    };
  }, [events, resources, scale, rowHeight, onEventSelect, onEventDoubleClick, createDragBehavior, createResizeBehavior, onEventMove, onEventResize]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="timeline-canvas"
      style={{ display: "block", cursor: "grab" }}
    >
      <g ref={gRef} className="timeline-content">
        <g ref={eventsGroupRef} className="events-group" />
      </g>
    </svg>
  );
}

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
