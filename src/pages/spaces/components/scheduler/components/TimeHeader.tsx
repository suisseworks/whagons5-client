import { useEffect, useRef } from "react";
import { select } from "d3-selection";
import { timeFormat } from "d3-time-format";
import { timeHour, timeDay, timeWeek, timeMonth } from "d3-time";
import type { ScaleTime } from "d3-scale";
import type { ViewPreset } from "../types/scheduler";

interface TimeHeaderProps {
  scale: ScaleTime<number, number>;
  height: number;
  preset: ViewPreset;
  startDate: Date;
  endDate: Date;
}

const formatHour = timeFormat("%I %p"); // 12-hour format with AM/PM
const formatDay = timeFormat("%a %d");
const formatWeek = timeFormat("%b %d");
const formatMonth = timeFormat("%B %Y");

export default function TimeHeader({
  scale,
  height,
  preset,
  startDate,
  endDate,
}: TimeHeaderProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const width = scale.range()[1];
    const ticks = getTicks(preset, startDate, endDate);

    // Create main group with offset to prevent clipping of first label
    const mainGroup = svg.append("g").attr("transform", "translate(40, 0)");

    // Draw major ticks
    const majorTicks = mainGroup
      .append("g")
      .attr("class", "major-ticks");

    majorTicks
      .selectAll("line")
      .data(ticks.major)
      .enter()
      .append("line")
      .attr("x1", (d) => scale(d))
      .attr("x2", (d) => scale(d))
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "currentColor")
      .attr("stroke-width", 1)
      .attr("opacity", 0.2);

    // Draw minor ticks
    const minorTicks = mainGroup
      .append("g")
      .attr("class", "minor-ticks");

    minorTicks
      .selectAll("line")
      .data(ticks.minor)
      .enter()
      .append("line")
      .attr("x1", (d) => scale(d))
      .attr("x2", (d) => scale(d))
      .attr("y1", height * 0.7)
      .attr("y2", height)
      .attr("stroke", "currentColor")
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.1);

    // Draw labels
    const labels = mainGroup
      .append("g")
      .attr("class", "time-labels");

    labels
      .selectAll("text")
      .data(ticks.major)
      .enter()
      .append("text")
      .attr("x", (d) => scale(d))
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "12px")
      .attr("fill", "currentColor")
      .text((d) => formatTick(d, preset));
  }, [scale, height, preset, startDate, endDate]);

  return (
    <div>
      <svg
        ref={svgRef}
        width={scale.range()[1] + 80}
        height={height}
        className="time-header"
        style={{ display: "block" }}
      />
    </div>
  );
}

function getTicks(preset: ViewPreset, startDate: Date, endDate: Date) {
  let majorInterval: any;
  let minorInterval: any;

  switch (preset) {
    case "hourAndDay":
      // For day view, show hours as major ticks
      majorInterval = timeHour.every(1);
      minorInterval = timeHour.every(1);
      break;
    case "dayAndWeek":
      // For week view, show days
      majorInterval = timeDay;
      minorInterval = timeDay;
      break;
    case "weekAndMonth":
      // For month view, show weeks
      majorInterval = timeWeek;
      minorInterval = timeDay;
      break;
    case "monthAndYear":
      // For year view, show months
      majorInterval = timeMonth;
      minorInterval = timeWeek;
      break;
  }

  const major = majorInterval.range(startDate, endDate);
  const minor = minorInterval
    ? minorInterval.range(startDate, endDate)
    : [];

  return { major, minor };
}

function formatTick(date: Date, preset: ViewPreset): string {
  switch (preset) {
    case "hourAndDay":
      return formatHour(date);
    case "dayAndWeek":
      return formatDay(date);
    case "weekAndMonth":
      return formatWeek(date);
    case "monthAndYear":
      return formatMonth(date);
    default:
      return formatDay(date);
  }
}
