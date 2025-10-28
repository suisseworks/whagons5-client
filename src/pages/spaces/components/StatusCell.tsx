'use client';

import React, { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MultiStateBadge, AnimatedSpinner } from '@/animated/Status';

type StatusMeta = { name: string; color?: string; icon?: string; action?: string };

interface StatusCellProps {
  value: number;
  statusMap: Record<number, StatusMeta>;
  getStatusIcon: (iconName?: string) => any;
  allowedNext: number[];
  onChange: (toStatusId: number) => Promise<boolean> | boolean;
}

const StatusCell: React.FC<StatusCellProps> = ({ value, statusMap, getStatusIcon, allowedNext, onChange }) => {
  const [open, setOpen] = useState(false);
  const [animationState, setAnimationState] = useState<'custom' | 'processing' | 'success' | 'error'>('custom');
  const meta = statusMap[value];
  const isWorkingStatus = meta?.action?.toUpperCase?.() === 'WORKING';
  if (!meta) {
    return (
      <div className="flex items-center h-full py-2">
        <span className="opacity-0">.</span>
      </div>
    );
  }
  const name = meta.name;
  const color = meta?.color || '#6B7280';
  const iconName = meta?.icon;
  const icon = getStatusIcon(iconName);

  // Create custom status config for the MultiStateBadge
  const customStatusConfig = {
    label: name,
    icon: icon,
    bg: "text-foreground",
    glow: "",
    color: color
  };

  // Build a compact pill with theme-aware contrast.
  // In dark mode, use a softer mix for bg and slightly softened border/text to reduce harshness.
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const tintedBackground = "transparent";
  const pillBorderColor = "transparent";
  const pillTextColor = color
    ? (isDark
      ? `color-mix(in oklab, ${color} 72%, white 28%)`
      : color)
    : undefined;
  const StatusPill = (
    <div
      className="inline-flex items-center gap-2 rounded-md px-2 py-0"
      style={{ background: tintedBackground, color: pillTextColor, borderColor: pillBorderColor }}
    >
      {isWorkingStatus ? (
        <span className="relative inline-flex items-center justify-center h-4 w-4" aria-busy="true">
          <span
            className="absolute inline-block rounded-full animate-ping"
            style={{ backgroundColor: pillBorderColor, opacity: isDark ? 0.35 : 0.45, height: '16px', width: '16px' }}
          />
          <span className="absolute inline-flex items-center justify-center" style={{ height: '16px', width: '16px', color: pillTextColor }}>
            <AnimatedSpinner />
          </span>
        </span>
      ) : meta?.icon ? (
        <FontAwesomeIcon icon={icon} className="text-[11px]" style={{ color: pillTextColor }} />
      ) : (
        <span className="text-[10px] leading-none" style={{ color: pillTextColor }}>●</span>
      )}
      <span className="text-xs font-semibold tracking-wide uppercase leading-none">{name}</span>
    </div>
  );

  const items = useMemo(() => {
    return allowedNext
      .map((id) => ({ id, meta: statusMap[id] }))
      .filter((it) => it.meta);
  }, [allowedNext, statusMap]);

  return (
    <TooltipProvider>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <div className="flex items-center h-full py-1 gap-2">
                <MultiStateBadge
                  state={animationState}
                  customStatus={customStatusConfig}
                  customComponent={StatusPill}
                  className="cursor-pointer"
                />
                {/* optional right-side animation removed by request */}
              </div>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">Change status</TooltipContent>
        </Tooltip>
        <PopoverContent side="right" align="start" className="p-2 w-[220px]" sideOffset={6}>
          <div className="flex flex-col gap-1">
            {items.length === 0 && (
              <div className="text-xs text-muted-foreground px-1 py-1">No allowed transitions</div>
            )}
            {items.map(({ id, meta }) => (
              <Button
                key={id}
                variant="ghost"
                className="justify-start h-7 px-2 text-xs"
                onClick={async (e) => {
                  e.stopPropagation();
                  setOpen(false);
                  try {
                    setAnimationState('processing');
                    const ok = await onChange(id);
                    if (ok) {
                      setAnimationState('success');
                      setTimeout(() => setAnimationState('custom'), 1000);
                    } else {
                      setAnimationState('error');
                      setTimeout(() => setAnimationState('custom'), 1000);
                    }
                  } catch (_) {
                    setAnimationState('error');
                    setTimeout(() => setAnimationState('custom'), 1000);
                  }
                }}
              >
                <span className="inline-flex items-center gap-2">
                  {meta?.icon ? (
                    <FontAwesomeIcon icon={getStatusIcon(meta.icon)} className="text-[11px]" style={{ color: meta?.color || undefined }} />
                  ) : (
                    <span className="text-[10px] leading-none" style={{ color: meta?.color || '#6B7280' }}>●</span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <span>{meta?.name || `#${id}`}</span>
                    {/* removed moving image for WORKING status */}
                  </span>
                </span>
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
};

export default StatusCell;


