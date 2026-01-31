import { useEffect, useRef, useMemo } from "react";
import { select } from "d3-selection";
import { timeFormat } from "d3-time-format";
import { timeHour, timeDay, timeWeek, timeMonth, timeYear } from "d3-time";
import type { ScaleTime } from "d3-scale";
import type { ViewPreset } from "../types/scheduler";
import { TIMELINE_GUTTER_WIDTH } from "../utils/constants";

interface TimeHeaderProps {
  scale: ScaleTime<number, number>;
  height: number;
  preset: ViewPreset;
  startDate: Date;
  endDate: Date;
}

const formatHour = timeFormat("%I %p");
const formatHour24 = timeFormat("%H:%M");
const formatDay = timeFormat("%a %d");
const formatDayNum = timeFormat("%d");
const formatDayShort = timeFormat("%a");
const formatWeek = timeFormat("%b %d");
const formatMonth = timeFormat("%B %Y");
const formatMonthShort = timeFormat("%b");
const formatYear = timeFormat("%Y");

// Check if date is today
function isToday(date: Date): boolean {
  const today = new Date();
  return date.getFullYear() === today.getFullYear() &&
         date.getMonth() === today.getMonth() &&
         date.getDate() === today.getDate();
}

// Check if date is a weekend
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export default function TimeHeader({
  scale,
  height,
  preset,
  startDate,
  endDate,
}: TimeHeaderProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Memoize tick calculations
  const { majorRanges, minorRanges, ticks } = useMemo(() => {
    const tickData = getTicks(preset, startDate, endDate);
    return {
      ticks: tickData,
      majorRanges: buildRanges(tickData.major, endDate),
      minorRanges: buildRanges(tickData.minor, endDate),
    };
  }, [preset, startDate, endDate]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const width = scale.range()[1];
    const separatorY = Math.round(height * 0.5); // Clean 50/50 split

    // Create defs for gradients
    const defs = svg.append("defs");
    
    // Subtle header background gradient
    const headerGradient = defs.append("linearGradient")
      .attr("id", "header-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
    headerGradient.append("stop").attr("offset", "0%").attr("stop-color", "var(--scheduler-zebra-stripe, rgba(0,0,0,0.01))");
    headerGradient.append("stop").attr("offset", "100%").attr("stop-color", "var(--scheduler-zebra-stripe, rgba(0,0,0,0.025))");

    // Create main group with offset
    const mainGroup = svg.append("g").attr("transform", `translate(${TIMELINE_GUTTER_WIDTH}, 0)`);

    // Background with subtle gradient
    mainGroup.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "url(#header-gradient)");

    // Today highlight in header (modern blue accent)
    if (preset === "hourAndDay" || preset === "dayAndWeek") {
      minorRanges.forEach((range) => {
        if (isToday(range.start)) {
          const x1 = scale(range.start);
          const x2 = scale(range.end);
          
          // Today background gradient
          const todayGradientId = "today-header-gradient";
          const todayGradient = defs.append("linearGradient")
            .attr("id", todayGradientId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%");
          todayGradient.append("stop").attr("offset", "0%").attr("stop-color", "rgba(59, 130, 246, 0.06)");
          todayGradient.append("stop").attr("offset", "100%").attr("stop-color", "rgba(59, 130, 246, 0.1)");
          
          mainGroup.append("rect")
            .attr("class", "scheduler-today-header-bg")
            .attr("x", x1)
            .attr("y", 0)
            .attr("width", x2 - x1)
            .attr("height", height)
            .attr("fill", `url(#${todayGradientId})`);
          
          // Today accent bar at bottom (rounded)
          mainGroup.append("rect")
            .attr("x", x1 + 2)
            .attr("y", height - 3)
            .attr("width", x2 - x1 - 4)
            .attr("height", 3)
            .attr("rx", 1.5)
            .attr("fill", "hsl(var(--primary))")
            .attr("opacity", 0.7);
        }
      });
    }

    // Major tier background bands (very subtle alternating)
    majorRanges.forEach((range, i) => {
      const x1 = scale(range.start);
      const x2 = scale(range.end);
      if (i % 2 === 0) {
        mainGroup.append("rect")
          .attr("x", x1)
          .attr("y", 0)
          .attr("width", x2 - x1)
          .attr("height", separatorY)
          .attr("fill", "var(--scheduler-zebra-stripe, rgba(0, 0, 0, 0.01))");
      }
    });

    // Major vertical dividers (subtle)
    ticks.major.forEach((tick) => {
      mainGroup.append("line")
        .attr("x1", scale(tick))
        .attr("x2", scale(tick))
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "var(--scheduler-grid-line-major, currentColor)")
        .attr("stroke-width", 1)
        .attr("opacity", 1);
    });

    // Minor vertical dividers (ultra-subtle)
    ticks.minor.forEach((tick) => {
      mainGroup.append("line")
        .attr("x1", scale(tick))
        .attr("x2", scale(tick))
        .attr("y1", separatorY)
        .attr("y2", height)
        .attr("stroke", "var(--scheduler-grid-line, currentColor)")
        .attr("stroke-width", 1)
        .attr("opacity", 1);
    });

    // Horizontal separator between tiers (clean line)
    mainGroup.append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", separatorY)
      .attr("y2", separatorY)
      .attr("stroke", "var(--scheduler-grid-line, currentColor)")
      .attr("stroke-width", 1)
      .attr("opacity", 1);

    // Major labels (top tier - refined typography)
    majorRanges.forEach((range) => {
      const x1 = scale(range.start);
      const x2 = scale(range.end);
      const cellWidth = x2 - x1;
      
      if (cellWidth < 50) return;
      
      mainGroup.append("text")
        .attr("class", "scheduler-time-major")
        .attr("x", (x1 + x2) / 2)
        .attr("y", separatorY / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .attr("letter-spacing", "0.02em")
        .attr("fill", "currentColor")
        .attr("opacity", 0.8)
        .text(formatMajorTick(range.start, range.end, preset));
    });

    // Minor labels (bottom tier - refined typography)
    minorRanges.forEach((range) => {
      const x1 = scale(range.start);
      const x2 = scale(range.end);
      const cellWidth = x2 - x1;
      
      if (cellWidth < 24) return;
      
      const isTodayCell = isToday(range.start);
      const isWeekendCell = isWeekend(range.start);
      
      mainGroup.append("text")
        .attr("class", `scheduler-time-minor ${isTodayCell ? 'today' : ''} ${isWeekendCell ? 'weekend' : ''}`)
        .attr("x", (x1 + x2) / 2)
        .attr("y", separatorY + (height - separatorY) / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "10px")
        .attr("font-weight", isTodayCell ? "700" : "500")
        .attr("letter-spacing", "0.01em")
        .attr("fill", isTodayCell ? "hsl(var(--primary))" : "currentColor")
        .attr("opacity", isTodayCell ? 1 : (isWeekendCell ? 0.45 : 0.65))
        .text(formatMinorTick(range.start, preset));
    });

    // Bottom border (clean)
    mainGroup.append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", height - 0.5)
      .attr("y2", height - 0.5)
      .attr("stroke", "var(--scheduler-grid-line-major, currentColor)")
      .attr("stroke-width", 1)
      .attr("opacity", 1);

  }, [scale, height, preset, majorRanges, minorRanges, ticks]);

  return (
    <div className="scheduler-time-header bg-gradient-to-b from-background/95 via-muted/20 to-muted/30 border-b border-border/25 backdrop-blur-sm">
      <svg
        ref={svgRef}
        width={scale.range()[1] + TIMELINE_GUTTER_WIDTH * 2}
        height={height}
        className="scheduler-time-header-svg"
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
      majorInterval = timeDay.every(1);
      minorInterval = timeHour.every(1);
      break;
    case "dayAndWeek":
      majorInterval = timeWeek.every(1);
      minorInterval = timeDay.every(1);
      break;
    case "weekAndMonth":
      majorInterval = timeMonth.every(1);
      minorInterval = timeWeek.every(1);
      break;
    case "monthAndYear":
      majorInterval = timeYear.every(1);
      minorInterval = timeMonth.every(1);
      break;
  }

  const major = majorInterval.range(startDate, endDate);
  const minor = minorInterval ? minorInterval.range(startDate, endDate) : [];

  return { major, minor };
}

function buildRanges(ticks: Date[], endDate: Date) {
  return ticks.map((tick, index) => ({
    start: tick,
    end: ticks[index + 1] ?? endDate,
  }));
}

function formatMajorTick(start: Date, end: Date, preset: ViewPreset): string {
  switch (preset) {
    case "hourAndDay":
      return formatDay(start);
    case "dayAndWeek":
      return formatWeekRange(start, end);
    case "weekAndMonth":
      return formatMonth(start);
    case "monthAndYear":
      return formatYear(start);
    default:
      return formatDay(start);
  }
}

function formatMinorTick(date: Date, preset: ViewPreset): string {
  switch (preset) {
    case "hourAndDay":
      return formatHour24(date);
    case "dayAndWeek":
      return `${formatDayShort(date)} ${formatDayNum(date)}`;
    case "weekAndMonth":
      return formatWeek(date);
    case "monthAndYear":
      return formatMonthShort(date);
    default:
      return formatDayShort(date);
  }
}

function formatWeekRange(start: Date, end: Date): string {
  const endDisplay = new Date(end.getTime() - 1);
  return `${formatWeek(start)} - ${formatWeek(endDisplay)}`;
}
