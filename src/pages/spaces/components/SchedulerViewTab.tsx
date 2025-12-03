import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { BryntumSchedulerPro } from "@bryntum/schedulerpro-react";
import "@bryntum/schedulerpro/schedulerpro.css";
import "@bryntum/schedulerpro/stockholm-light.css";

interface RowItem {
  id: string;
  name: string;
  role: string;
  department: string;
  color: string;
  workload: number;
}

type ViewPreset = "hourAndDay" | "dayAndWeek";
type EventStatus = "scheduled" | "in_progress" | "blocked" | "critical";

const STATUS_META: Record<EventStatus, { label: string; color: string; badgeBg: string }> = {
  scheduled: { label: "Scheduled", color: "#2563eb", badgeBg: "rgba(37,99,235,0.14)" },
  in_progress: { label: "In progress", color: "#0ea5e9", badgeBg: "rgba(14,165,233,0.14)" },
  blocked: { label: "Blocked", color: "#f97316", badgeBg: "rgba(249,115,22,0.18)" },
  critical: { label: "Critical", color: "#dc2626", badgeBg: "rgba(220,38,38,0.18)" },
};

interface SchedulerEvent {
  id: string;
  name: string;
  resourceId: string;
  startDate: Date;
  endDate: Date;
  status: EventStatus;
  location: string;
}

export default function SchedulerViewTab({ workspaceId }: { workspaceId: string | undefined }) {
  const [viewPreset, setViewPreset] = useState<ViewPreset>("hourAndDay");

  const resources = useMemo<RowItem[]>(
    () => [
      {
        id: "r1",
        name: "Alice Carter",
        role: "Maintenance Lead",
        department: "Mechanical",
        color: "#2563eb",
        workload: 82,
      },
      {
        id: "r2",
        name: "Bob Nguyen",
        role: "Field Technician",
        department: "Electrical",
        color: "#10b981",
        workload: 64,
      },
      {
        id: "r3",
        name: "Charlie Ramos",
        role: "QA Supervisor",
        department: "Quality",
        color: "#f59e0b",
        workload: 74,
      },
      {
        id: "r4",
        name: "Diana Patel",
        role: "Special Projects",
        department: "R&D",
        color: "#a855f7",
        workload: 58,
      },
    ],
    [],
  );

  const columns = useMemo(
    () => [
      {
        text: "Technician",
        field: "name",
        width: 230,
        htmlEncode: false,
        renderer: ({ record }: { record: RowItem }) => renderTechnicianCell(record),
      },
      {
        text: "Department",
        field: "department",
        width: 150,
      },
      {
        text: "Load",
        field: "workload",
        width: 130,
        htmlEncode: false,
        renderer: ({ record }: { record: RowItem }) => renderWorkload(record),
      },
    ],
    [],
  );

  const events = useMemo<SchedulerEvent[]>(
    () => {
      const raw = [
        {
          id: "e1",
          resourceId: "r1",
          name: "Preventive maintenance",
          start: { hour: 8, minute: 30, dayOffset: 0 },
          end: { hour: 10, minute: 15, dayOffset: 0 },
          status: "scheduled" as EventStatus,
          location: "Boiler room",
        },
        {
          id: "e2",
          resourceId: "r1",
          name: "Site inspection",
          start: { hour: 14, minute: 0, dayOffset: 0 },
          end: { hour: 16, minute: 0, dayOffset: 0 },
          status: "in_progress" as EventStatus,
          location: "Cooling tower",
        },
        {
          id: "e3",
          resourceId: "r2",
          name: "Emergency response",
          start: { hour: 10, minute: 30, dayOffset: 0 },
          end: { hour: 12, minute: 30, dayOffset: 0 },
          status: "critical" as EventStatus,
          location: "Line 4",
        },
        {
          id: "e4",
          resourceId: "r2",
          name: "Calibration",
          start: { hour: 9, minute: 0, dayOffset: 1 },
          end: { hour: 11, minute: 30, dayOffset: 1 },
          status: "scheduled" as EventStatus,
          location: "Test lab",
        },
        {
          id: "e5",
          resourceId: "r3",
          name: "Supplier audit",
          start: { hour: 11, minute: 0, dayOffset: 2 },
          end: { hour: 13, minute: 0, dayOffset: 2 },
          status: "blocked" as EventStatus,
          location: "Warehouse",
        },
        {
          id: "e6",
          resourceId: "r3",
          name: "Client review",
          start: { hour: 15, minute: 0, dayOffset: 2 },
          end: { hour: 17, minute: 0, dayOffset: 2 },
          status: "scheduled" as EventStatus,
          location: "Board room",
        },
        {
          id: "e7",
          resourceId: "r4",
          name: "Prototype rollout",
          start: { hour: 9, minute: 30, dayOffset: 3 },
          end: { hour: 12, minute: 0, dayOffset: 3 },
          status: "in_progress" as EventStatus,
          location: "Innovation lab",
        },
        {
          id: "e8",
          resourceId: "r4",
          name: "Safety workshop",
          start: { hour: 13, minute: 30, dayOffset: 3 },
          end: { hour: 15, minute: 0, dayOffset: 3 },
          status: "scheduled" as EventStatus,
          location: "Auditorium",
        },
      ];

      return raw.map((event) => ({
        id: event.id,
        resourceId: event.resourceId,
        name: event.name,
        startDate: getDateForHour(event.start.hour, event.start.minute, event.start.dayOffset),
        endDate: getDateForHour(event.end.hour, event.end.minute, event.end.dayOffset),
        status: event.status,
        location: event.location,
      }));
    },
    [],
  );

  const dependencies = useMemo(
    () => [
      { id: "dep-1", fromEvent: "e1", toEvent: "e2" },
      { id: "dep-2", fromEvent: "e7", toEvent: "e8" },
    ],
    [],
  );

  const { startDate, endDate } = useMemo(() => {
    const start = getDateForHour(7, 30, 0);
    const spanDays = viewPreset === "dayAndWeek" ? 5 : 0;
    const end = getDateForHour(19, 0, spanDays);
    return { startDate: start, endDate: end };
  }, [viewPreset]);

  const timeRanges = useMemo(() => buildTimeRanges(viewPreset), [viewPreset]);

  const stats = useMemo(() => {
    const totalHours = events.reduce((sum, event) => sum + (event.endDate.getTime() - event.startDate.getTime()) / 36e5, 0);
    const criticalCount = events.filter((event) => event.status === "critical").length;
    return {
      totalHours: Math.round(totalHours * 10) / 10,
      criticalCount,
    };
  }, [events]);

  const schedulerConfig = useMemo(
    () => ({
      startDate,
      endDate,
      viewPreset,
      barMargin: 10,
      rowHeight: 80,
      tickSize: 70,
      zoomKeepsOriginalTimespan: true,
      columns,
      resources,
      events,
      dependencies,
      timeRanges,
      eventStyle: "rounded",
      eventRenderer: renderEvent,
      features: {
        stripe: true,
        currentTimeLine: true,
        timeRanges: true,
        dependencies: true,
        eventTooltip: {
          template: eventTooltipTemplate,
        },
        eventDrag: {
          showExactDropPosition: true,
        },
        eventResize: {
          showTooltip: true,
        },
        nonWorkingTime: {
          disabled: false,
        },
      },
      project: {
        calendar: "general",
      },
    }),
    [columns, dependencies, endDate, events, resources, startDate, timeRanges, viewPreset],
  );

  return (
    <div className="h-full w-full flex flex-col gap-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span>Scheduler</span>
        <span className="text-xs ml-auto">space {workspaceId ?? ""}</span>
      </div>
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="py-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base">Today's workload</CardTitle>
            <p className="text-sm text-muted-foreground">
              {stats.totalHours} hrs scheduled · {stats.criticalCount} critical task{stats.criticalCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={viewPreset === "hourAndDay" ? "default" : "secondary"} onClick={() => setViewPreset("hourAndDay")}>
              Day view
            </Button>
            <Button size="sm" variant={viewPreset === "dayAndWeek" ? "default" : "secondary"} onClick={() => setViewPreset("dayAndWeek")}>
              Week view
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <div className="h-full min-h-[480px]">
            <BryntumSchedulerPro {...schedulerConfig} style={{ height: "100%" }} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function renderTechnicianCell(record: RowItem) {
  const initials = record.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return `
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="width:34px;height:34px;border-radius:999px;background:${record.color};color:white;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;">
        ${initials}
      </div>
      <div>
        <div style="font-weight:600;">${record.name}</div>
        <div style="font-size:12px;color:#64748b;">${record.role}</div>
      </div>
    </div>
  `;
}

function renderWorkload(record: RowItem) {
  return `
    <div style="display:flex;flex-direction:column;gap:6px;">
      <div style="font-weight:600;">${record.workload}%</div>
      <div style="height:4px;background:#e2e8f0;border-radius:999px;overflow:hidden;">
        <div style="width:${record.workload}%;background:${record.color};height:100%;border-radius:999px;"></div>
      </div>
    </div>
  `;
}

function renderEvent({ eventRecord }: { eventRecord: SchedulerEvent }) {
  const status = STATUS_META[eventRecord.status] ?? STATUS_META.scheduled;
  const start = formatTime(eventRecord.startDate);
  const end = formatTime(eventRecord.endDate);

  return `
    <div style="display:flex;flex-direction:column;gap:4px;font-size:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span style="font-weight:600;font-size:13px;">${eventRecord.name}</span>
        <span style="font-size:10px;padding:2px 8px;border-radius:999px;background:${status.badgeBg};color:${status.color};text-transform:uppercase;">
          ${status.label}
        </span>
      </div>
      <div style="color:#0f172a;opacity:0.85;display:flex;flex-direction:column;gap:2px;">
        <span>${start} – ${end}</span>
        <span style="font-size:11px;">${eventRecord.location}</span>
      </div>
    </div>
  `;
}

function buildTimeRanges(viewPreset: ViewPreset) {
  const dayOffsets = viewPreset === "dayAndWeek" ? [0, 1, 2, 3, 4] : [0];
  return dayOffsets.flatMap((dayOffset) => [
    {
      id: `core-${dayOffset}`,
      name: "Core hours",
      startDate: getDateForHour(8, 0, dayOffset),
      endDate: getDateForHour(12, 0, dayOffset),
    },
    {
      id: `lunch-${dayOffset}`,
      name: "Lunch",
      startDate: getDateForHour(12, 0, dayOffset),
      endDate: getDateForHour(13, 0, dayOffset),
    },
    {
      id: `shift-${dayOffset}`,
      name: "Afternoon",
      startDate: getDateForHour(13, 0, dayOffset),
      endDate: getDateForHour(17, 30, dayOffset),
    },
  ]);
}

function getDateForHour(hour: number, minute = 0, dayOffset = 0) {
  const base = new Date();
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, hour, minute, 0, 0);
}

function eventTooltipTemplate({ eventRecord }: { eventRecord: SchedulerEvent }) {
  const status = STATUS_META[eventRecord.status] ?? STATUS_META.scheduled;
  const start = formatTime(eventRecord.startDate);
  const end = formatTime(eventRecord.endDate);

  return `
    <div style="display:flex;flex-direction:column;gap:4px;max-width:220px;">
      <div style="font-weight:600;">${eventRecord.name}</div>
      <div style="font-size:12px;color:#475569;">${start} – ${end}</div>
      <div style="font-size:12px;color:#475569;">${eventRecord.location}</div>
      <div style="font-size:11px;color:${status.color};">${status.label}</div>
    </div>
  `;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
