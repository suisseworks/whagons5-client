"use client";

import React from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { CalendarDays } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

dayjs.extend(relativeTime);

export function DueDateCell({
  dueDate,
  className,
}: {
  dueDate?: string | null;
  className?: string;
}) {
  if (!dueDate) {
    return <span className={"text-xs text-muted-foreground" + (className ? ` ${className}` : "")}>No due date</span>;
  }
  const d = dayjs(dueDate);
  const now = dayjs();
  const isOverdue = d.isBefore(now, "day");
  const daysDiff = d.diff(now, "day");
  const urgent = !isOverdue && daysDiff <= 2;
  const colorCls = isOverdue ? "text-red-600" : urgent ? "text-amber-600" : "text-muted-foreground";
  const rel = isOverdue ? `${d.fromNow()}` : `in ${Math.abs(daysDiff)} day${Math.abs(daysDiff) === 1 ? "" : "s"}`;

  const inner = (
    <span className={"inline-flex items-center gap-1.5 " + (className || "")}>{/* relative prominent */}
      <span className={`inline-flex items-center ${colorCls}`}>
        <span className="inline-block h-1.5 w-1.5 rounded-full mr-1" aria-hidden style={{ backgroundColor: isOverdue ? "#dc2626" : urgent ? "#d97706" : "#9ca3af" }} />
        <CalendarDays className="h-3.5 w-3.5 mr-1" aria-hidden />
        <span className="text-sm font-medium">{rel}</span>
      </span>
    </span>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="top">{d.format("MMM D, YYYY")} • {d.fromNow()}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default DueDateCell;


