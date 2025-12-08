import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { BryntumScheduler } from "@bryntum/scheduler-react";

type ViewPreset = "hourAndDay" | "dayAndWeek";

interface Resource {
  id: string;
  name: string;
  role: string;
  department: string;
  color: string;
}

interface SchedulerEvent {
  id: string;
  name: string;
  resourceId: string;
  startDate: string;
  endDate: string;
  eventColor?: string;
  recurrenceRule?: string;
  recurrenceException?: string;
  location?: string;
}

export default function SchedulerViewTab({ workspaceId }: { workspaceId: string | undefined }) {
  const [viewPreset, setViewPreset] = useState<ViewPreset>("hourAndDay");

  const base = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0, 0);
  }, []);

  const resources = useMemo<Resource[]>(
    () => [
      { id: "r1", name: "Alice Carter", role: "Maintenance Lead", department: "Mechanical", color: "#2563eb" },
      { id: "r2", name: "Bob Nguyen", role: "Field Technician", department: "Electrical", color: "#10b981" },
      { id: "r3", name: "Charlie Ramos", role: "QA Supervisor", department: "Quality", color: "#f59e0b" },
      { id: "r4", name: "Diana Patel", role: "Special Projects", department: "R&D", color: "#a855f7" },
    ],
    [],
  );

  const events = useMemo<SchedulerEvent[]>(
    () => [
      {
        id: "e1",
        resourceId: "r1",
        name: "Preventive maintenance",
        startDate: toDateString(base, { dayOffset: 0, hour: 8, minute: 30 }),
        endDate: toDateString(base, { dayOffset: 0, hour: 10, minute: 15 }),
        eventColor: "blue",
        recurrenceRule: "FREQ=WEEKLY;BYDAY=MO,WE;INTERVAL=1",
      },
      {
        id: "e2",
        resourceId: "r1",
        name: "Site inspection",
        startDate: toDateString(base, { dayOffset: 0, hour: 14, minute: 0 }),
        endDate: toDateString(base, { dayOffset: 0, hour: 16, minute: 0 }),
        eventColor: "cyan",
      },
      {
        id: "e3",
        resourceId: "r2",
        name: "Emergency response",
        startDate: toDateString(base, { dayOffset: 0, hour: 10, minute: 30 }),
        endDate: toDateString(base, { dayOffset: 0, hour: 12, minute: 30 }),
        eventColor: "red",
      },
      {
        id: "e4",
        resourceId: "r2",
        name: "Calibration",
        startDate: toDateString(base, { dayOffset: 1, hour: 9, minute: 0 }),
        endDate: toDateString(base, { dayOffset: 1, hour: 11, minute: 30 }),
        eventColor: "green",
        recurrenceRule: "FREQ=WEEKLY;BYDAY=FR",
      },
      {
        id: "e5",
        resourceId: "r3",
        name: "Supplier audit",
        startDate: toDateString(base, { dayOffset: 2, hour: 11, minute: 0 }),
        endDate: toDateString(base, { dayOffset: 2, hour: 13, minute: 0 }),
        eventColor: "orange",
      },
      {
        id: "e6",
        resourceId: "r3",
        name: "Client review",
        startDate: toDateString(base, { dayOffset: 2, hour: 15, minute: 0 }),
        endDate: toDateString(base, { dayOffset: 2, hour: 17, minute: 0 }),
        eventColor: "blue",
      },
      {
        id: "e7",
        resourceId: "r4",
        name: "Prototype rollout",
        startDate: toDateString(base, { dayOffset: 3, hour: 9, minute: 30 }),
        endDate: toDateString(base, { dayOffset: 3, hour: 12, minute: 0 }),
        eventColor: "purple",
      },
      {
        id: "e8",
        resourceId: "r4",
        name: "Safety workshop",
        startDate: toDateString(base, { dayOffset: 3, hour: 13, minute: 30 }),
        endDate: toDateString(base, { dayOffset: 3, hour: 15, minute: 0 }),
        eventColor: "blue",
      },
    ],
    [base],
  );

  const viewPresetConfig = viewPreset === "hourAndDay" ? "hourAndDay" : "dayAndWeek";

  const startDate = useMemo(() => base, [base]);
  const endDate = useMemo(() => addDays(base, viewPreset === "hourAndDay" ? 1 : 7), [base, viewPreset]);

  return (
    <div className="h-full w-full flex flex-col gap-2 min-h-0">
      <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
        <CardContent className="flex-1 min-h-0 flex flex-col pt-1 pb-1 overflow-hidden px-3 lg:px-6">
          <div className="flex items-center justify-end gap-2 mb-2 pr-3 lg:pr-6">
            <Button size="sm" variant={viewPreset === "hourAndDay" ? "default" : "secondary"} onClick={() => setViewPreset("hourAndDay")}>
              Day view
            </Button>
            <Button size="sm" variant={viewPreset === "dayAndWeek" ? "default" : "secondary"} onClick={() => setViewPreset("dayAndWeek")}>
              Week view
            </Button>
          </div>
          <div className="flex-1 min-h-0" style={{ fontSize: '12px', lineHeight: '1.25', paddingRight: '16px' }}>
            <BryntumScheduler
              resources={resources}
              events={events}
              startDate={startDate}
              endDate={endDate}
              viewPreset={viewPresetConfig}
              barMargin={8}
              rowHeight={64}
              multiEventSelect={true}
              timeRanges={[
                { id: 1, name: "Now", startDate: new Date(), cls: "b-sch-current-time" },
              ]}
              columns={[
                { 
                  text: "Technician", 
                  field: "name", 
                  width: 220, 
                  renderer: ({ record }: any) => `${record.name}${record.role ? ` — ${record.role}` : ''}` 
                },
                { text: "Dept", field: "department", width: 120 },
              ]}
              features={{
                stripe: true,
                eventTooltip: true,
                eventEdit: true,
                timeRanges: true,
                nonWorkingTime: true,
                recurringEvents: true,
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function toDateString(base: Date, opts: { dayOffset: number; hour: number; minute?: number }) {
  const date = addDays(base, opts.dayOffset);
  date.setHours(opts.hour, opts.minute ?? 0, 0, 0);
  return date.toISOString();
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
