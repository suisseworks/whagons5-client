import { scaleTime } from "d3-scale";
import type { ViewPreset, TimeScaleConfig } from "../types/scheduler";

export function createTimeScale(
  startDate: Date,
  endDate: Date,
  width: number,
  preset: ViewPreset
) {
  const scale = scaleTime()
    .domain([startDate, endDate])
    .range([0, width]);

  return scale;
}

export function getTickInterval(preset: ViewPreset): number {
  switch (preset) {
    case "hourAndDay":
      return 3600000; // 1 hour in milliseconds
    case "dayAndWeek":
      return 86400000; // 1 day in milliseconds
    case "weekAndMonth":
      return 604800000; // 1 week in milliseconds
    case "monthAndYear":
      return 2592000000; // ~1 month in milliseconds (30 days)
    default:
      return 3600000;
  }
}

export function getMajorTickInterval(preset: ViewPreset): number {
  switch (preset) {
    case "hourAndDay":
      return 86400000; // 1 day in milliseconds
    case "dayAndWeek":
      return 86400000; // 1 day in milliseconds
    case "weekAndMonth":
      return 604800000; // 1 week in milliseconds
    case "monthAndYear":
      return 2592000000; // 1 month in milliseconds (30 days)
    default:
      return 86400000;
  }
}

export function getTimeScaleConfig(
  preset: ViewPreset,
  baseDate: Date = new Date()
): TimeScaleConfig {
  let startDate: Date;
  let endDate: Date;

  switch (preset) {
    case "hourAndDay":
      // Normalize baseDate to local calendar day (ignore time portion)
      startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      break;
    case "dayAndWeek":
      startDate = new Date(baseDate);
      // Start from Monday
      const dayOfWeek = startDate.getDay();
      const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      startDate.setDate(diff);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);
      break;
    case "weekAndMonth":
      startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      endDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
      break;
    case "monthAndYear":
      startDate = new Date(baseDate.getFullYear(), 0, 1);
      endDate = new Date(baseDate.getFullYear() + 1, 0, 1);
      break;
    default:
      startDate = new Date(baseDate);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
  }

  return {
    preset,
    startDate,
    endDate,
    tickInterval: getTickInterval(preset),
    majorTickInterval: getMajorTickInterval(preset),
  };
}
