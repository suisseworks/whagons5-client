import dayjs from 'dayjs';
// import { Badge } from "@/components/ui/badge";
import HoverPopover from '@/pages/spaces/components/HoverPopover';
import StatusCell from '@/pages/spaces/components/StatusCell';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CalendarDays, MapPin, Flag } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTags } from "@fortawesome/free-solid-svg-icons";
import { iconService } from "@/database/iconService";
import { useEffect, useState } from "react";

export function buildWorkspaceColumns(opts: any) {
  const {
    getUserDisplayName,
    getStatusIcon,
    getAllowedNextStatuses,
    handleChangeStatus,
    statusesLoaded,
    priorityMap,
    prioritiesLoaded,
    filteredPriorities,
    statusMap,
    usersLoaded,
    getUsersFromIds,
    spotMap,
    spotsLoaded,
    userMap,
    groupField,
    showDescriptions,
  } = opts;

  const CategoryIconSmall = ({ iconClass, color }: { iconClass?: string; color?: string }) => {
    const [iconEl, setIconEl] = useState<any>(faTags);
    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const loaded = await iconService.getIcon(iconClass);
          if (!cancelled) setIconEl(loaded || faTags);
        } catch {
          if (!cancelled) setIconEl(faTags);
        }
      })();
      return () => { cancelled = true; };
    }, [iconClass]);
    return <FontAwesomeIcon icon={iconEl as any} className="mr-1" style={{ color: color || '#6b7280', width: 18, height: 18 }} />;
  };

  // Always render initials instead of profile pictures
  const UserInitial = ({ user }: { user: any }) => {
    const name: string = getUserDisplayName(user) || '';
    const initial = (name.trim().charAt(0) || '?').toUpperCase();
    return (
      <AvatarFallback className="text-[11px] font-semibold">
        {initial}
      </AvatarFallback>
    );
  };

  // groupByStatus can be toggled later if we add grouping by status

  const cols = ([
    {
      field: 'name',
      headerName: 'Task',
      flex: 3,
      filter: false,
      wrapText: true,
      autoHeight: true,
      cellRenderer: (p: any) => {
        const name = p.data?.name || '';
        const description = p.data?.description || '';
        const cat = (opts as any)?.categoryMap?.[Number(p.data?.category_id)];
        return (
          <div className="flex flex-col gap-0.5 py-0.5">
            <div className="flex items-center gap-2">
              <CategoryIconSmall iconClass={cat?.icon} color={cat?.color} />
              <div className="font-semibold text-[18px] leading-[1.6] tracking-[-0.01em] cursor-default text-[#0f172a] dark:text-white">{name}</div>
            </div>
            {showDescriptions && description && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="wh-task-desc mt-1 pl-6 text-[13px] leading-relaxed text-[#6b7280] dark:text-muted-foreground"
                      style={{
                        whiteSpace: 'normal',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as any,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {description}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[520px] whitespace-pre-wrap text-[14px] leading-relaxed">
                    {description}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        );
      },
      minWidth: 280,
    },
    {
      field: 'status_id',
      headerName: 'Status',
      sortable: true,
      rowGroup: undefined,
      hide: undefined,
      filter: 'agSetColumnFilter',
      valueFormatter: (p: any) => {
        const meta: any = statusMap[p.value as number];
        return meta?.name || `#${p.value}`;
      },
      filterParams: {
        values: (params: any) => {
          const ids = Object.keys(statusMap).map((k: any) => Number(k));
          params.success(ids);
        },
        suppressMiniFilter: false,
        valueFormatter: (p: any) => {
          const meta: any = statusMap[p.value as number];
          return meta?.name || `#${p.value}`;
        },
      },
      cellRenderer: (p: any) => {
        const row = p.data;
        if (!statusesLoaded || !row) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        const meta: any = statusMap[p.value as number];
        if (!meta) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        const allowedNext = getAllowedNextStatuses(row);
        return (
          <StatusCell
            value={p.value}
            statusMap={statusMap}
            getStatusIcon={getStatusIcon}
            allowedNext={allowedNext}
            onChange={(to: number) => handleChangeStatus(row, to)}
          />
        );
      },
      width: 170,
      minWidth: 160,
      maxWidth: 220,
    },
    {
      field: 'priority_id',
      headerName: 'Priority',
      sortable: true,
      filter: 'agSetColumnFilter',
      valueFormatter: (p: any) => {
        const meta: any = priorityMap[p.value as number];
        return meta?.name || `#${p.value}`;
      },
      filterParams: {
        values: (params: any) => {
          const ids = (filteredPriorities || []).map((p: any) => Number((p as any).id));
          params.success(ids);
        },
        suppressMiniFilter: false,
        valueFormatter: (p: any) => {
          const meta: any = priorityMap[p.value as number];
          return meta?.name || `#${p.value}`;
        },
      },
      cellRenderer: (p: any) => {
        if (!prioritiesLoaded || p.value == null) return (<div className="flex items-center h-full py-1"><span className="opacity-0">.</span></div>);
        const meta: any = priorityMap[p.value as number];
        if (!meta) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        const name = meta.name;
        const lower = (name || '').toLowerCase();
        const palette = lower.includes('high')
          ? { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444' }
          : lower.includes('medium')
            ? { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B' }
            : lower.includes('low')
              ? { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981' }
              : { bg: `color-mix(in oklab, ${(meta?.color || '#6B7280')} 12%, #ffffff 88%)`, text: (meta?.color || '#6B7280') };
        const pill = (
          <div className="inline-flex items-center h-full py-1.5">
            <span
              className="inline-flex items-center gap-2 rounded-[12px] px-3 py-1 text-[13px] font-medium leading-none truncate max-w-[160px]"
              style={{ background: palette.bg, color: palette.text }}
            >
              <Flag className="h-3.5 w-3.5" style={{ color: palette.text, opacity: 0.9 }} />
              {name}
            </span>
          </div>
        );
        return pill;
      },
      width: 110,
      minWidth: 110,
      maxWidth: 140,
    },
    {
      field: 'user_ids',
      headerName: 'Responsible',
      width: 140,
      filter: false,
      cellRenderer: (p: any) => {
        if (!usersLoaded) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        const userIds = p.data?.user_ids;
        if (userIds == null) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        const users = getUsersFromIds(userIds, userMap) || [];
        if (users.length === 0) return (<div className="flex items-center h-full py-2"><div className="text-sm text-muted-foreground">No users assigned</div></div>);
        const displayUsers = users.slice(0, 3);
        const remainingCount = users.length - displayUsers.length;
        return (
          <div className="flex items-center h-full py-0.5 gap-2">
            <div className="flex items-center -space-x-2">
              {displayUsers.map((user: any) => (
                <HoverPopover key={user.id} content={(
                  <div className="flex flex-col items-center gap-3">
                    <Avatar className="h-16 w-16 border-2 border-background bg-muted text-foreground">
                      <UserInitial user={user} />
                    </Avatar>
                    <span className="text-base font-medium text-popover-foreground text-center">{getUserDisplayName(user)}</span>
                  </div>
                )}>
                  <Avatar className="h-7 w-7 border-2 transition-colors cursor-pointer bg-muted text-foreground" title={getUserDisplayName(user)} style={{ borderColor: '#e5e7eb' }}>
                    <UserInitial user={user} />
                  </Avatar>
                </HoverPopover>
              ))}
              {remainingCount > 0 && (
                <div className="h-7 w-7 rounded-full bg-muted border-2 flex items-center justify-center" style={{ borderColor: '#e5e7eb' }}>
                  <span className="text-[10px] text-muted-foreground font-medium">+{remainingCount}</span>
                </div>
              )}
            </div>
          </div>
        );
      },
      minWidth: 140,
      maxWidth: 200,
    },
    {
      field: 'due_date',
      headerName: 'Due',
      filter: false,
      cellRenderer: (p: any) => {
        const dueDate = p.data?.due_date;
        if (!dueDate) {
          return (
            <div className="flex items-center h-full py-2">
              <span className="text-[13px] text-muted-foreground">No due date</span>
            </div>
          );
        }
        const d = dayjs(dueDate);
        const now = dayjs();
        const isOverdue = d.isBefore(now, 'day');
        const daysDiff = d.diff(now, 'day');
        const urgent = !isOverdue && daysDiff <= 2;
        const colorCls = isOverdue ? 'text-red-600' : urgent ? 'text-amber-600' : 'text-muted-foreground';
        const inner = (
          <div className="flex items-center h-full py-2 gap-2">
            <span className={`inline-flex items-center ${colorCls}`}>
              <span className="inline-block h-2 w-2 rounded-full mr-2" aria-hidden style={{ backgroundColor: isOverdue ? '#dc2626' : urgent ? '#d97706' : '#9ca3af' }} />
              <CalendarDays className="h-4 w-4 mr-2" aria-hidden={true} style={{ color: '#8B5CF6' }} />
              <span className="text-[13px] font-medium">{isOverdue ? d.fromNow() : `in ${Math.abs(daysDiff)} day${Math.abs(daysDiff) === 1 ? '' : 's'}`}</span>
            </span>
          </div>
        );
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>{inner}</TooltipTrigger>
              <TooltipContent side="top">{d.format('MMM D, YYYY')} • {d.fromNow()}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
      width: 140,
      minWidth: 140,
      maxWidth: 180,
    },
    {
      field: 'spot_id',
      headerName: 'Location',
      sortable: true,
      filter: 'agSetColumnFilter',
      rowGroup: groupField === 'spot_id' ? true : undefined,
      hide: groupField === 'spot_id' ? true : undefined,
      valueFormatter: (p: any) => {
        const meta: any = spotMap[p.value as number];
        return meta?.name || `#${p.value}`;
      },
      filterParams: {
        values: (params: any) => {
          const ids = Object.keys(spotMap).map((k: any) => Number(k));
          params.success(ids);
        },
        suppressMiniFilter: false,
        valueFormatter: (p: any) => {
          const meta: any = spotMap[p.value as number];
          return meta?.name || `#${p.value}`;
        },
      },
      cellRenderer: (p: any) => {
        if (!spotsLoaded) return (<div className="flex items-center h-full py-1"><span className="opacity-0">.</span></div>);
        if (p.value == null) return (<div className="flex items-center h-full py-1"><span className="opacity-0">.</span></div>);
        const meta: any = spotMap[p.value as number];
        if (!meta) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        const name = meta.name;
        const tag = (
          <div className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
            <MapPin className="h-4 w-4 mr-2" style={{ color: '#6366F1' }} />
            <span className="truncate max-w-[160px]">{name}</span>
          </div>
        );
        return (
          <div className="flex items-center h-full py-1">{tag}</div>
        );
      },
      flex: 2,
      minWidth: 220,
    },
  ]);

  // Apply grouping to status or priority when selected
  if (groupField === 'status_id') {
    const c = cols.find((x: any) => x.field === 'status_id');
    if (c) { c.rowGroup = true; c.hide = true; }
  }
  if (groupField === 'priority_id') {
    const c = cols.find((x: any) => x.field === 'priority_id');
    if (c) { c.rowGroup = true; c.hide = true; }
  }

  return cols;
}


