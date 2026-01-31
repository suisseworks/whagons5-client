export type ViewPreset = "hourAndDay" | "dayAndWeek" | "weekAndMonth" | "monthAndYear";

export interface SchedulerResource {
  id: number;
  name: string;
  email?: string;
  avatar?: string;
  teamId?: number;
  teamName?: string;
  color?: string;
}

export interface SchedulerEvent {
  id: number;              // task.id
  resourceId: number;      // user.id (one event per user assignment)
  name: string;           // task.name
  startDate: Date;         // task.start_date
  endDate: Date;           // task.due_date or calculated from expected_duration
  color: string;           // derived from priority/status
  taskId: number;          // reference to full task
  priorityId?: number;
  statusId?: number;
  categoryId?: number;
  spotId?: number;
  // Resolved names for display
  statusName?: string;
  statusColor?: string;
  priorityName?: string;
  priorityColor?: string;
  spotName?: string;
  categoryName?: string;
  description?: string;
  // Recurrence info
  recurrenceId?: number | null;
  recurrenceInstanceNumber?: number | null;
  isRecurring?: boolean;
}

export interface TimeScaleConfig {
  preset: ViewPreset;
  startDate: Date;
  endDate: Date;
  tickInterval: number;    // milliseconds
  majorTickInterval: number; // milliseconds
}

export interface TimelineBounds {
  start: Date;
  end: Date;
  width: number;
  height: number;
}

export interface EventPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  resourceIndex: number;
}
