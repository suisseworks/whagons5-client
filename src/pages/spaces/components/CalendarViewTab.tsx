import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

function getMonthMatrix(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startDay = (firstOfMonth.getDay() + 6) % 7; // make Monday=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const matrix: Array<Array<number | null>> = [];
  let day = 1 - startDay;
  for (let r = 0; r < 6; r++) {
    const row: Array<number | null> = [];
    for (let c = 0; c < 7; c++) {
      if (day < 1 || day > daysInMonth) row.push(null); else row.push(day);
      day++;
    }
    matrix.push(row);
  }
  return matrix;
}

export default function CalendarViewTab({ workspaceId }: { workspaceId: string | undefined }) {
  const [current, setCurrent] = useState(new Date());
  const matrix = useMemo(() => getMonthMatrix(current), [current]);
  const monthName = current.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  const shiftMonth = (delta: number) => {
    const d = new Date(current);
    d.setMonth(d.getMonth() + delta);
    setCurrent(d);
  };

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="h-full w-full flex flex-col gap-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Calendar className="w-4 h-4" />
        <span>Calendar (Bryntum mock)</span>
        <span className="text-xs ml-auto">space {workspaceId ?? ""}</span>
      </div>

      <Card className="flex-1 overflow-hidden">
        <CardHeader className="py-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">{monthName}</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => shiftMonth(-1)}>Prev</Button>
            <Button size="sm" variant="secondary" onClick={() => setCurrent(new Date())}>Today</Button>
            <Button size="sm" variant="secondary" onClick={() => shiftMonth(1)}>Next</Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 h-full">
          <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-1">
            {weekdays.map(w => (
              <div key={w} className="px-2 py-1 text-center">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 h-[calc(100%-2rem)]">
            {matrix.flatMap((row, rIdx) => row.map((d, cIdx) => (
              <div key={`${rIdx}-${cIdx}`} className="border rounded p-1 text-xs overflow-hidden">
                <div className="font-medium mb-1 opacity-70">{d ?? ''}</div>
                <div className="space-y-1">
                  {/* mock events */}
                  {d && (d % 7 === 0) && (
                    <div className="bg-primary/10 text-primary rounded px-1">Review sprint</div>
                  )}
                  {d && (d % 5 === 0) && (
                    <div className="bg-accent rounded px-1">Team standup</div>
                  )}
                </div>
              </div>
            )))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


