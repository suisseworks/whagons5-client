'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
 
import { MultiStateBadge, AnimatedSpinner } from '@/animated/Status';
import { Clock, Zap, Check, PauseCircle } from 'lucide-react';

type StatusMeta = { name: string; color?: string; icon?: string; action?: string };

interface StatusCellProps {
  value: number;
  statusMap: Record<number, StatusMeta>;
  getStatusIcon: (iconName?: string) => any;
  allowedNext: number[];
  onChange: (toStatusId: number) => Promise<boolean> | boolean;
  taskId?: number;
}

const StatusCell: React.FC<StatusCellProps> = ({ value, statusMap, getStatusIcon, allowedNext, onChange, taskId }) => {
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
  const action = meta?.action?.toLowerCase?.() || '';
  const nameLower = (meta?.name || '').toLowerCase();
  const isWorkingStatus = action === 'working' || action === 'in_progress' || nameLower.includes('progress');
  const isPendingStatus = action === 'pending' || action === 'waiting' || action === 'queued' || nameLower.includes('pending') || nameLower.includes('review');
  const isDoneStatus = action === 'done' || action === 'completed' || nameLower.includes('done') || nameLower.includes('complete');
  const isNotStarted = action === 'todo' || action === 'not_started' || nameLower.includes('not started') || nameLower.includes('todo');

  const baseColor = meta?.color || '#6B7280';

  const variantIcon = isPendingStatus
    ? <Clock className="w-3.5 h-3.5" />
    : isWorkingStatus
      ? <Zap className="w-3.5 h-3.5" />
      : isDoneStatus
        ? <Check className="w-3.5 h-3.5" />
        : <PauseCircle className="w-3.5 h-3.5" />;
  if (!meta) {
    return (
      <div className="flex items-center h-full py-2">
        <span className="opacity-0">.</span>
      </div>
    );
  }
  const name = meta.name;
  const color = baseColor;

  // Create custom status config for the MultiStateBadge
  const customStatusConfig = {
    label: name,
    icon: null,
    bg: baseColor,
    glow: "",
    color: '#ffffff'
  };

  const StatusPill = (
    <div
      className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold"
      style={{ background: baseColor, color: '#ffffff' }}
    >
      {isWorkingStatus ? (
        <span className="relative inline-flex items-center justify-center h-3.5 w-3.5" aria-busy="true" style={{ color: '#ffffff' }}>
          <AnimatedSpinner />
        </span>
      ) : (
        <span className="w-3.5 h-3.5">{variantIcon}</span>
      )}
      <span className="text-[13px] font-semibold leading-none capitalize">{name}</span>
    </div>
  );

  const items = useMemo(() => {
    return allowedNext
      .map((id) => ({ id, meta: statusMap[id] }))
      .filter((it) => it.meta);
  }, [allowedNext, statusMap]);

  const BadgeContent = (
    <MultiStateBadge
      state={animationState}
      customStatus={customStatusConfig}
      customComponent={StatusPill}
      className="cursor-pointer"
    />
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className="flex items-center h-full py-1 gap-2 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
        >
          {BadgeContent}
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


