"use client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import StatusInfoPopover from "./StatusInfoPopover";

type StatusMeta = { id: number; name: string; color?: string; icon?: string };

export function StatusBadge({
  statusId,
  statusMap,
  getStatusIcon,
  className,
  taskId,
}: {
  statusId?: number | null;
  statusMap: Record<number, StatusMeta>;
  getStatusIcon?: (iconName?: string) => any;
  className?: string;
  taskId?: number;
}) {
  const meta = statusId != null ? statusMap[Number(statusId)] : undefined;
  if (!meta) {
    return (
      <span className={"inline-flex items-center text-xs text-muted-foreground" + (className ? ` ${className}` : "")}>No status</span>
    );
  }
  const color = meta.color || "#6B7280";
  const icon = meta.icon && typeof getStatusIcon === "function" ? getStatusIcon(meta.icon) : null;

  const inner = (
    <span
      className={"inline-flex items-center gap-2 rounded-[6px] px-3 py-1.5 text-[12px] font-medium leading-none border cursor-pointer " + (className || "")}
      style={{
        background: `color-mix(in oklab, ${color} 12%, #101014 88%)`,
        borderColor: 'oklch(from var(--color-border) l c h / 0.45)',
        color: '#F3F4F6'
      }}
      aria-label={`Status: ${meta.name}`}
    >
      {icon ? (
        <FontAwesomeIcon icon={icon} className="text-[10px]" style={{ color: '#F3F4F6' }} />
      ) : (
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      <span className="truncate max-w-[140px] lowercase">{meta.name}</span>
    </span>
  );

  // If taskId is provided, show status info popover on hover
  if (taskId && statusId) {
    return (
      <StatusInfoPopover taskId={taskId} statusId={statusId}>
        {inner}
      </StatusInfoPopover>
    );
  }

  // Fallback to simple badge without popover
  return inner;
}

export default StatusBadge;


