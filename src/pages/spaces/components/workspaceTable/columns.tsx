import dayjs from 'dayjs';
import { Badge } from "@/components/ui/badge";
import HoverPopover from '@/pages/spaces/components/HoverPopover';
import StatusCell from '@/pages/spaces/components/StatusCell';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CalendarDays, CheckCircle2, Edit3, UserRound, MoreHorizontal } from 'lucide-react';

export function buildWorkspaceColumns(opts: any) {
  const {
    getUserDisplayName,
    getUserInitials,
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
    getDoneStatusId,
    groupField,
  } = opts;

  const AvatarImg = ({ user }: { user: any }) => {
    return (
      <AvatarImage src={user?.url_picture || ''} alt={getUserDisplayName(user)} onError={() => {}} />
    );
  };

  // groupByStatus can be toggled later if we add grouping by status

  const cols = ([
    {
      field: 'name',
      headerName: 'Task',
      flex: 2.2,
      filter: false,
      wrapText: false,
      autoHeight: false,
      cellRenderer: (p: any) => {
        const name = p.data?.name || '';
        const description = p.data?.description || '';
        const statusMeta = statusMap[p.data?.status_id as number];
        const statusColor = statusMeta?.color;
        return (
          <div className="flex flex-col gap-0.5 py-0.5">
            <div className="flex items-center gap-2">
              {statusColor && (
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: statusColor, boxShadow: '0 0 0 1px var(--color-border)' }}
                />
              )}
              <HoverPopover content={(
                <div className="max-w-[420px] text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {description || 'No description'}
                </div>
              )}>
                <div className="font-semibold text-base leading-tight text-foreground truncate cursor-default" title={name}>{name}</div>
              </HoverPopover>
            </div>
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
      width: 160,
      minWidth: 120,
      maxWidth: 200,
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
        const color = meta?.color || '#6B7280';
        const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
        const bgTint = color ? (isDark
          ? `color-mix(in oklab, var(--color-card) 92%, ${color} 8%)`
          : `color-mix(in oklab, var(--color-card) 85%, ${color} 15%)`
        ) : undefined;
        const borderClr = color ? (isDark
          ? `color-mix(in oklab, ${color} 65%, var(--color-card) 35%)`
          : color
        ) : undefined;
        const textClr = color ? (isDark
          ? `color-mix(in oklab, ${color} 78%, white 22%)`
          : color
        ) : undefined;
        return (
          <div className="flex items-center h-full py-2">
            <Badge
              variant="outline"
              style={{ borderColor: borderClr, color: textClr, background: bgTint }}
              className="border rounded-md text-xs px-2 py-0.5 font-medium leading-tight truncate max-w-[100px]"
              title={name}
            >
              {name}
            </Badge>
          </div>
        );
      },
      width: 130,
      minWidth: 120,
      maxWidth: 180,
    },
    {
      field: 'user_ids',
      headerName: 'Responsible',
      flex: 0.85,
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
                    <Avatar className="h-16 w-16 border-2 border-background">
                      <AvatarImg user={user} />
                      <AvatarFallback className="text-base font-medium">{getUserInitials(user)}</AvatarFallback>
                    </Avatar>
                    <span className="text-base font-medium text-popover-foreground text-center">{getUserDisplayName(user)}</span>
                  </div>
                )}>
                  <Avatar className="h-7 w-7 border border-background hover:border-primary transition-colors cursor-pointer" title={getUserDisplayName(user)}>
                    <AvatarImg user={user} />
                    <AvatarFallback className="text-[10px]">{getUserInitials(user)}</AvatarFallback>
                  </Avatar>
                </HoverPopover>
              ))}
              {remainingCount > 0 && (
                <div className="h-7 w-7 rounded-full bg-muted border border-background flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground font-medium">+{remainingCount}</span>
                </div>
              )}
            </div>
          </div>
        );
      },
      minWidth: 120,
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
              <span className="text-sm text-muted-foreground">No due date</span>
            </div>
          );
        }
        const d = dayjs(dueDate);
        const now = dayjs();
        const isOverdue = d.isBefore(now, 'day');
        const daysDiff = d.diff(now, 'day');
        const urgent = !isOverdue && daysDiff <= 2;
        const colorCls = isOverdue ? 'text-red-600' : urgent ? 'text-amber-600' : 'text-muted-foreground';
        return (
          <div className="flex items-center h-full py-2 gap-2" title={`${d.format('MMM D, YYYY')} • ${d.fromNow()}`}>
            <CalendarDays className={`h-4 w-4 ${colorCls}`} aria-hidden="true" />
            <span className={`text-sm ${colorCls}`}>
              {d.format('MMM D')} <span className="text-xs text-muted-foreground">({d.fromNow()})</span>
            </span>
          </div>
        );
      },
      minWidth: 160,
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
        return (<div className="flex items-center h-full py-1"><span className="text-sm text-muted-foreground">{name}</span></div>);
      },
      minWidth: 100,
    },
    {
      field: 'actions',
      headerName: '',
      sortable: false,
      filter: false,
      width: 140,
      minWidth: 120,
      maxWidth: 160,
      pinned: 'right',
      cellRenderer: (p: any) => {
        const row = p.data;
        if (!row) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        const doneId = typeof getDoneStatusId === 'function' ? getDoneStatusId() : undefined;
        return (
          <div className="flex items-center h-full py-1 gap-2 justify-end pr-1">
            <button
              className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent"
              aria-label="Mark complete"
              title="Mark complete"
              onClick={(e) => { e.stopPropagation(); if (doneId != null) handleChangeStatus(row, doneId); }}
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </button>
            <button
              className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent"
              aria-label="Edit"
              title="Edit"
              onClick={(e) => { e.stopPropagation(); }}
            >
              <Edit3 className="h-4 w-4" />
            </button>
            <button
              className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent"
              aria-label="Reassign"
              title="Reassign"
              onClick={(e) => { e.stopPropagation(); }}
            >
              <UserRound className="h-4 w-4" />
            </button>
            <button
              className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent"
              aria-label="More options"
              title="More options"
              onClick={(e) => { e.stopPropagation(); }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        );
      },
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


