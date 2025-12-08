import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ViewPreset = "hourAndDay" | "dayAndWeek";

export default function SchedulerViewTab({ workspaceId: _workspaceId }: { workspaceId: string | undefined }) {
  const [viewPreset, setViewPreset] = useState<ViewPreset>("hourAndDay");

  return (
    <div className="h-full w-full flex flex-col gap-2 min-h-0">
      <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
        <CardContent className="flex items-center justify-end gap-2 mb-2 pr-3 lg:pr-6">
          <Button size="sm" variant={viewPreset === "hourAndDay" ? "default" : "secondary"} onClick={() => setViewPreset("hourAndDay")}>
            Day view
          </Button>
          <Button size="sm" variant={viewPreset === "dayAndWeek" ? "default" : "secondary"} onClick={() => setViewPreset("dayAndWeek")}>
            Week view
          </Button>
        </CardContent>
        <CardContent className="flex-1 pt-0">
          <div className="h-full min-h-[480px] rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {/* Bryntum Scheduler deshabilitado temporalmente hasta disponer de la licencia y dependencias */}
            La vista de calendarización se encuentra temporalmente deshabilitada. Cuando se habilite Bryntum Scheduler se renderizará aquí.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
