import type { ScaleTime } from "d3-scale";
import type { SchedulerEvent, SchedulerResource, EventPosition } from "../types/scheduler";

export function calculateEventPosition(
  event: SchedulerEvent,
  resourceIndex: number,
  scale: ScaleTime<number, number>,
  rowHeight: number,
  barMargin: number = 4
): EventPosition {
  const x = scale(event.startDate);
  const width = Math.max(scale(event.endDate) - x, 4); // Minimum width of 4px
  const y = resourceIndex * rowHeight + barMargin;
  const height = rowHeight - barMargin * 2;

  return {
    x,
    y,
    width,
    height,
    resourceIndex,
  };
}

export function getResourceIndex(
  resourceId: number,
  resources: SchedulerResource[]
): number {
  return resources.findIndex((r) => r.id === resourceId);
}

export function calculateAllEventPositions(
  events: SchedulerEvent[],
  resources: SchedulerResource[],
  scale: ScaleTime<number, number>,
  rowHeight: number,
  barMargin: number = 4
): Map<number, EventPosition> {
  const positions = new Map<number, EventPosition>();

  events.forEach((event) => {
    const resourceIndex = getResourceIndex(event.resourceId, resources);
    if (resourceIndex === -1) return; // Skip if resource not found

    const position = calculateEventPosition(
      event,
      resourceIndex,
      scale,
      rowHeight,
      barMargin
    );

    positions.set(event.id, position);
  });

  return positions;
}
