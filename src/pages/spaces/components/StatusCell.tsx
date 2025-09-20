'use client';

import React, { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { faSpinner, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';

type StatusMeta = { name: string; color?: string; icon?: string };

interface StatusCellProps {
  value: number;
  statusMap: Record<number, StatusMeta>;
  getStatusIcon: (iconName?: string) => any;
  allowedNext: number[];
  onChange: (toStatusId: number) => Promise<boolean> | boolean;
}

const StatusCell: React.FC<StatusCellProps> = ({ value, statusMap, getStatusIcon, allowedNext, onChange }) => {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const meta = statusMap[value];
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
              <div
                className="flex items-center h-full py-1 px-2 gap-1 truncate cursor-pointer rounded-md hover:bg-muted/60 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {icon && typeof icon === 'object' ? (
                  <FontAwesomeIcon
                    icon={icon}
                    className="text-sm"
                    style={{ color }}
                  />
                ) : (
                  <span className="text-[10px] leading-none" style={{ color }}>●</span>
                )}
                <span className="text-xs font-medium truncate max-w-[120px]" title={name}>{name}</span>
                {state === 'loading' && (
                  <FontAwesomeIcon icon={faSpinner} spin className="text-[11px] ml-1 text-muted-foreground" />
                )}
                {state === 'success' && (
                  <FontAwesomeIcon icon={faCheck} className="text-[11px] ml-1 text-green-600" />
                )}
                {state === 'error' && (
                  <FontAwesomeIcon icon={faXmark} className="text-[11px] ml-1 text-red-600" />
                )}
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
                    setState('loading');
                    const ok = await onChange(id);
                    if (ok) {
                      setState('success');
                      setTimeout(() => setState('idle'), 1000);
                    } else {
                      setState('error');
                      setTimeout(() => setState('idle'), 1000);
                    }
                  } catch (_) {
                    setState('error');
                    setTimeout(() => setState('idle'), 1000);
                  }
                }}
              >
                <span className="inline-flex items-center gap-2">
                  {meta?.icon ? (
                    <FontAwesomeIcon icon={getStatusIcon(meta.icon)} className="text-[11px]" style={{ color: meta?.color || undefined }} />
                  ) : (
                    <span className="text-[10px] leading-none" style={{ color: meta?.color || '#6B7280' }}>●</span>
                  )}
                  <span>{meta?.name || `#${id}`}</span>
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


