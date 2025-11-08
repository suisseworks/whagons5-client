'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
 
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

  // Close popover on scroll
  useEffect(() => {
    if (!open) return;

    const handleScroll = () => {
      setOpen(false);
    };

    // Listen to scroll events on window and all scrollable containers
    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);
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

  // Status tag: solid colored pill with white text
  const pillTextColor = '#ffffff';
  const StatusPill = (
    <div
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.02em]"
      style={{ background: color, color: pillTextColor }}
    >
      {isWorkingStatus ? (
        <span className="relative inline-flex items-center justify-center h-3 w-3 mr-0.5" aria-busy="true" style={{ color: '#ffffff' }}>
          <AnimatedSpinner />
        </span>
      ) : meta?.icon ? (
        <FontAwesomeIcon icon={icon} className="text-[10px]" style={{ color: pillTextColor }} />
      ) : (
        <span className="inline-block h-2 w-2 rounded-full bg-white/80" />
      )}
      <span className="text-[12px] font-semibold tracking-wide leading-none">{name}</span>
    </div>
  );

  const items = useMemo(() => {
    return allowedNext
      .map((id) => ({ id, meta: statusMap[id] }))
      .filter((it) => it.meta);
  }, [allowedNext, statusMap]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div 
          className="flex items-center h-full py-1 gap-2"
          onClick={(e) => {
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
        >
          <MultiStateBadge
            state={animationState}
            customStatus={customStatusConfig}
            customComponent={StatusPill}
            className="cursor-pointer"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent 
        side="right" 
        align="start" 
        className="p-0 w-[280px] rounded-xl shadow-lg border border-border/50 bg-background" 
        sideOffset={8}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
          <div className="px-4 pt-3 pb-2 border-b border-border/40">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Change task status to...
            </div>
          </div>
          <div className="flex flex-col gap-2 p-3">
            {items.length === 0 && (
              <div className="text-sm text-muted-foreground px-2 py-2 text-center">No allowed transitions</div>
            )}
            {items.map(({ id, meta }) => (
              <Button
                key={id}
                variant="ghost"
                className="justify-start h-11 px-4 text-sm font-medium hover:bg-accent/50 transition-colors rounded-lg"
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
                <span className="inline-flex items-center gap-3 w-full">
                  {meta?.icon ? (
                    <FontAwesomeIcon 
                      icon={getStatusIcon(meta.icon)} 
                      className="text-base flex-shrink-0" 
                      style={{ color: meta?.color || undefined }} 
                    />
                  ) : (
                    <span 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: meta?.color || '#6B7280' }} 
                    />
                  )}
                  <span className="text-sm font-medium text-foreground capitalize">
                    {meta?.name || `#${id}`}
                  </span>
                </span>
              </Button>
            ))}
          </div>
        </PopoverContent>
    </Popover>
  );
};

export default StatusCell;


