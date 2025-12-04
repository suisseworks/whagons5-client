import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface RowItem {
  id: string;
  name: string;
  color: string;
}

export default function SchedulerViewTab({ workspaceId }: { workspaceId: string | undefined }) {
  const rows: RowItem[] = useMemo(() => ([
    { id: 'r1', name: 'Alice', color: '#60a5fa' },
    { id: 'r2', name: 'Bob', color: '#34d399' },
    { id: 'r3', name: 'Charlie', color: '#f59e0b' },
  ]), []);

  const hours = useMemo(() => Array.from({ length: 10 }).map((_, i) => 8 + i), []); // 8..17

  return (
    <div className="h-full w-full flex flex-col gap-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span>Scheduler (Bryntum mock)</span>
        <span className="text-xs ml-auto">space {workspaceId ?? ""}</span>
      </div>
      <Card className="flex-1 overflow-hidden">
        <CardHeader className="py-3">
          <CardTitle className="text-base">Today</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 h-full overflow-auto">
          <div className="min-w-[800px]">
            <div className="grid" style={{ gridTemplateColumns: `200px repeat(${hours.length}, 1fr)` }}>
              <div className="px-2 py-1 text-xs text-muted-foreground">Resource</div>
              {hours.map(h => (
                <div key={h} className="px-2 py-1 text-xs text-muted-foreground text-center border-l">{h}:00</div>
              ))}
            </div>
            {rows.map((row) => (
              <div key={row.id} className="grid border-t" style={{ gridTemplateColumns: `200px repeat(${hours.length}, 1fr)` }}>
                <div className="px-2 py-2 text-sm font-medium">{row.name}</div>
                {hours.map((h) => (
                  <div key={h} className="relative h-12 border-l">
                    {(row.id === 'r1' && h === 9) && (
                      <div className="absolute top-1 left-2 right-4 h-8 rounded text-[10px] flex items-center px-2 text-white" style={{ backgroundColor: row.color }}>
                        Planning
                      </div>
                    )}
                    {(row.id === 'r2' && h === 11) && (
                      <div className="absolute top-1 left-2 right-6 h-8 rounded text-[10px] flex items-center px-2 text-white" style={{ backgroundColor: row.color }}>
                        Development
                      </div>
                    )}
                    {(row.id === 'r3' && h === 14) && (
                      <div className="absolute top-1 left-2 right-10 h-8 rounded text-[10px] flex items-center px-2 text-white" style={{ backgroundColor: row.color }}>
                        Review
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


