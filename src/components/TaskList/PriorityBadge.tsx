"use client";

import React from "react";
import { Flag } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type PriorityMeta = { id: number; name: string; color?: string };

export function PriorityBadge({
  priorityId,
  priorityMap,
  className,
}: {
  priorityId?: number | null;
  priorityMap: Record<number, PriorityMeta>;
  className?: string;
}) {
  const meta = priorityId != null ? priorityMap[Number(priorityId)] : undefined;
  if (!meta) {
    return <span className={"text-xs text-muted-foreground" + (className ? ` ${className}` : "")}>No priority</span>;
  }
  const color = meta.color || "#6B7280";
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const gradient = isDark
    ? `linear-gradient(135deg, color-mix(in oklab, ${color} 16%, #101014 84%), color-mix(in oklab, ${color} 10%, #101014 90%))`
    : `linear-gradient(135deg, color-mix(in oklab, ${color} 12%, #ffffff 88%), color-mix(in oklab, ${color} 6%, #ffffff 94%))`;
  // Make border neutral/subtle instead of priority-colored
  const border = `oklch(from var(--color-border) l c h / 0.45)`;
  const text = isDark
    ? `color-mix(in oklab, ${color} 78%, white 22%)`
    : color;

  const inner = (
    <span
      className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none border " + (className || "")}
      style={{ background: gradient, borderColor: border, color: text }}
      aria-label={`Priority: ${meta.name}`}
    >
      <Flag className="h-3 w-3" style={{ color: text }} />
      <span className="truncate max-w-[100px]">{meta.name}</span>
    </span>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="top">{meta.name}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default PriorityBadge;


