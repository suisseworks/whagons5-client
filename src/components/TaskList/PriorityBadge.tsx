"use client";
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
  const name = (meta.name || '').toLowerCase();
  const palette = name.includes('high')
    ? { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444' }
    : name.includes('medium')
      ? { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B' }
      : name.includes('low')
        ? { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981' }
        : { bg: `color-mix(in oklab, ${(meta.color || '#6B7280')} 12%, #ffffff 88%)`, text: (meta.color || '#6B7280') };

  const inner = (
    <span
      className={"inline-flex items-center gap-2 rounded-[12px] px-3 py-1 text-[13px] font-medium leading-none " + (className || "")}
      style={{ background: palette.bg, color: palette.text }}
      aria-label={`Priority: ${meta.name}`}
    >
      <Flag className="h-3.5 w-3.5" style={{ color: palette.text, opacity: 0.9 }} />
      <span className="truncate max-w-[120px]">{meta.name}</span>
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


