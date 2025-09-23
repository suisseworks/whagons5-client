'use client';

import React, { useMemo, useState } from 'react';
import blockShuffle from '@/assets/block-3-shuffle.svg';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MultiStateBadge } from '@/animated/Status';

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
              <div className="flex items-center h-full py-2 gap-2">
                <MultiStateBadge
                  state={animationState}
                  customStatus={customStatusConfig}
                  className="cursor-pointer"
                />
                {/* {isWorkingStatus && (
                  <img
                    src={blockShuffle}
                    alt=""
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                )} */}
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
                    {meta?.action?.toUpperCase?.() === 'WORKING' && (
                      <img
                        src={blockShuffle}
                        alt=""
                        aria-hidden="true"
                        className="h-3 w-3"
                      />
                    )}
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


