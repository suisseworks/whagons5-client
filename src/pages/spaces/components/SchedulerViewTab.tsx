import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

  const baseEvents = useMemo<SchedulerEvent[]>(
    () => [
      {
        id: "e1",
        name: "Preventive maintenance",
        startDate: toDateString(base, { dayOffset: 0, hour: 8, minute: 30 }),
        endDate: toDateString(base, { dayOffset: 0, hour: 10, minute: 15 }),
        eventColor: "blue",
        recurrenceRule: "FREQ=WEEKLY;BYDAY=MO,WE;INTERVAL=1",
      },
      {
        id: "e2",
        name: "Site inspection",
        startDate: toDateString(base, { dayOffset: 0, hour: 14, minute: 0 }),
        endDate: toDateString(base, { dayOffset: 0, hour: 16, minute: 0 }),
        eventColor: "cyan",
      },
      {
        id: "e3",
        name: "Emergency response",
        startDate: toDateString(base, { dayOffset: 0, hour: 10, minute: 30 }),
        endDate: toDateString(base, { dayOffset: 0, hour: 12, minute: 30 }),
        eventColor: "red",
      },
      {
        id: "e4",
        name: "Calibration",
        startDate: toDateString(base, { dayOffset: 1, hour: 9, minute: 0 }),
        endDate: toDateString(base, { dayOffset: 1, hour: 11, minute: 30 }),
        eventColor: "green",
        recurrenceRule: "FREQ=WEEKLY;BYDAY=FR",
      },
      {
        id: "e5",
        name: "Supplier audit",
        startDate: toDateString(base, { dayOffset: 2, hour: 11, minute: 0 }),
        endDate: toDateString(base, { dayOffset: 2, hour: 13, minute: 0 }),
        eventColor: "orange",
      },
      {
        id: "e6",
        name: "Client review",
        startDate: toDateString(base, { dayOffset: 2, hour: 15, minute: 0 }),
        endDate: toDateString(base, { dayOffset: 2, hour: 17, minute: 0 }),
        eventColor: "blue",
      },
      {
        id: "e7",
        name: "Prototype rollout",
        startDate: toDateString(base, { dayOffset: 3, hour: 9, minute: 30 }),
        endDate: toDateString(base, { dayOffset: 3, hour: 12, minute: 0 }),
        eventColor: "purple",
      },
      {
        id: "e8",
        name: "Safety workshop",
        startDate: toDateString(base, { dayOffset: 3, hour: 13, minute: 30 }),
        endDate: toDateString(base, { dayOffset: 3, hour: 15, minute: 0 }),
        eventColor: "blue",
      },
    ],
    [base],
  );

  const resources = useMemo<Resource[]>(() => {
    const names = Array.from(new Set(baseEvents.map((evt) => evt.name)));
    return names.map((taskName, idx) => ({
      id: taskName,
      name: taskName,
      role: "",
      department: "",
      color: taskColors[idx % taskColors.length],
    }));
  }, [baseEvents]);

  const events = useMemo(
    () =>
      baseEvents.map((evt) => ({
        ...evt,
        resourceId: evt.name,
      })),
    [baseEvents],
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
                  text: "Task",
                  field: "name",
                  width: 260,
                  renderer: ({ record }: any) => {
                    return record.name;
                  },
                },
              ]}
              features={{
                stripe: true,
                eventTooltip: true,
                eventEdit: {
                  items: {
                    recurrenceEditor: {
                      type: "recurrenceeditor",
                      title: "Recurrence",
                    },
                  },
                },
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

const taskColors = ["#2563eb", "#10b981", "#f59e0b", "#a855f7", "#ef4444", "#0ea5e9"];
