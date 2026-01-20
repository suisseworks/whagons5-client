import type { EventPosition, SchedulerEvent } from "../types/scheduler";

export interface OverlapInfo {
  eventId: number;
  overlaps: number[];
  stackIndex: number;
  totalOverlaps: number;
}

/**
 * Detects overlapping events and calculates stacking positions
 */
export function detectOverlaps(
  events: SchedulerEvent[],
  positions: Map<number, EventPosition>
): Map<number, OverlapInfo> {
  const overlapMap = new Map<number, OverlapInfo>();

  events.forEach((event) => {
    const pos = positions.get(event.id);
    if (!pos) return;

    const overlaps: number[] = [];

    events.forEach((otherEvent) => {
      if (event.id === otherEvent.id) return;
      if (event.resourceId !== otherEvent.resourceId) return; // Only check same resource

      const otherPos = positions.get(otherEvent.id);
      if (!otherPos) return;

      // Check if events overlap in time
      if (
        (event.startDate <= otherEvent.endDate && event.endDate >= otherEvent.startDate) &&
        pos.resourceIndex === otherPos.resourceIndex
      ) {
        overlaps.push(otherEvent.id);
      }
    });

    overlapMap.set(event.id, {
      eventId: event.id,
      overlaps,
      stackIndex: 0, // Will be calculated in next step
      totalOverlaps: overlaps.length,
    });
  });

  // Calculate stack indices
  const processed = new Set<number>();
  events.forEach((event) => {
    if (processed.has(event.id)) return;

    const info = overlapMap.get(event.id);
    if (!info || info.overlaps.length === 0) {
      processed.add(event.id);
      return;
    }

    // Group overlapping events
    const group = [event.id, ...info.overlaps];
    group.forEach((id, index) => {
      const groupInfo = overlapMap.get(id);
      if (groupInfo) {
        groupInfo.stackIndex = index;
        groupInfo.totalOverlaps = group.length;
      }
      processed.add(id);
    });
  });

  return overlapMap;
}

/**
 * Adjusts event positions to account for overlapping events
 */
export function adjustPositionsForOverlaps(
  positions: Map<number, EventPosition>,
  overlaps: Map<number, OverlapInfo>,
  barMargin: number = 4
): Map<number, EventPosition> {
  const adjusted = new Map<number, EventPosition>();

  positions.forEach((pos, eventId) => {
    const overlapInfo = overlaps.get(eventId);
    if (!overlapInfo || overlapInfo.totalOverlaps <= 1) {
      adjusted.set(eventId, pos);
      return;
    }

    // Calculate adjusted width and x position
    const totalOverlaps = overlapInfo.totalOverlaps;
    const stackIndex = overlapInfo.stackIndex;
    const adjustedWidth = pos.width / totalOverlaps - barMargin;
    const adjustedX = pos.x + (pos.width / totalOverlaps) * stackIndex + barMargin / 2;

    adjusted.set(eventId, {
      ...pos,
      x: adjustedX,
      width: adjustedWidth,
    });
  });

  return adjusted;
}
