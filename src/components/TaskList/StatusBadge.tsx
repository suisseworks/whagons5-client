"use client";

import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

type StatusMeta = { id: number; name: string; color?: string; icon?: string };

export function StatusBadge({
  statusId,
  statusMap,
  getStatusIcon,
  className,
}: {
  statusId?: number | null;
  statusMap: Record<number, StatusMeta>;
  getStatusIcon?: (iconName?: string) => any;
  className?: string;
}) {
  const meta = statusId != null ? statusMap[Number(statusId)] : undefined;
  if (!meta) {
    return (
      <span className={"inline-flex items-center text-xs text-muted-foreground" + (className ? ` ${className}` : "")}>No status</span>
    );
  }
  const color = meta.color || "#6B7280";
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const bg = isDark
    ? `color-mix(in oklab, ${color} 10%, var(--color-card) 90%)`
    : `color-mix(in oklab, ${color} 15%, var(--color-card) 85%)`;
  const border = isDark
    ? `color-mix(in oklab, ${color} 55%, var(--color-card) 45%)`
    : color;
  const text = isDark
    ? `color-mix(in oklab, ${color} 75%, white 25%)`
    : color;

  const icon = meta.icon && typeof getStatusIcon === "function" ? getStatusIcon(meta.icon) : null;

  const inner = (
    <span
      className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none border " + (className || "")}
      style={{ background: bg, borderColor: border, color: text }}
      aria-label={`Status: ${meta.name}`}
    >
      {icon ? (
        <FontAwesomeIcon icon={icon} className="text-[10px]" style={{ color: text }} />
      ) : (
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: text }} />
      )}
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

export default StatusBadge;


