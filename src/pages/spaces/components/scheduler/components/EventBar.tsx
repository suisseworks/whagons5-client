import { useEffect, useRef } from "react";
import { select } from "d3-selection";
import type { SchedulerEvent, EventPosition } from "../types/scheduler";

interface EventBarProps {
  event: SchedulerEvent;
  position: EventPosition;
  onSelect?: (event: SchedulerEvent) => void;
  onDoubleClick?: (event: SchedulerEvent) => void;
}

export default function EventBar({
  event,
  position,
  onSelect,
  onDoubleClick,
}: EventBarProps) {
  const gRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!gRef.current) return;

    const g = select(gRef.current);
    g.selectAll("*").remove();

    // Draw event bar
    const bar = g
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
      .style("cursor", "pointer")
      .on("click", () => onSelect?.(event))
      .on("dblclick", () => onDoubleClick?.(event));

    // Add hover effect
    bar
      .on("mouseenter", function () {
        select(this).attr("opacity", 0.8);
      })
      .on("mouseleave", function () {
        select(this).attr("opacity", 1);
      });

    // Draw event label if there's enough space
    if (position.width > 60) {
      const label = g
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
  }, [event, position, onSelect, onDoubleClick]);

  return <g ref={gRef} className="event-bar" />;
}
