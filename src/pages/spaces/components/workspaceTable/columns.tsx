import dayjs from 'dayjs';
import { Badge } from "@/components/ui/badge";
import HoverPopover from '@/pages/spaces/components/HoverPopover';
import StatusCell from '@/pages/spaces/components/StatusCell';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

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
    formatDueDate,
    spotMap,
    spotsLoaded,
    userMap,
  } = opts;

  const AvatarImg = ({ user }: { user: any }) => {
    return (
      <AvatarImage src={user?.url_picture || ''} alt={getUserDisplayName(user)} onError={() => {}} />
    );
  };

  // groupByStatus can be toggled later if we add grouping by status

  return ([
    {
      field: 'name',
      headerName: 'Task',
      flex: 3.2,
      filter: false,
      wrapText: true,
      autoHeight: true,
      cellRenderer: (p: any) => {
        const name = p.data?.name || '';
        const description = p.data?.description || '';
        const statusMeta = statusMap[p.data?.status_id as number];
        const statusColor = statusMeta?.color;
        return (
          <div className="flex flex-col gap-1 py-1">
            <div className="flex items-center gap-2">
              {statusColor && (
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: statusColor, boxShadow: '0 0 0 1px var(--color-border)' }}
                />
              )}
              <div className="font-semibold text-lg text-foreground truncate" title={name}>{name}</div>
            </div>
            {description && (
              <div
                className="text-xs text-muted-foreground/70"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {description}
              </div>
            )}
          </div>
        );
      },
      minWidth: 340,
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
      width: 200,
      minWidth: 140,
      maxWidth: 240,
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
        if (!prioritiesLoaded || p.value == null) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
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
              className="border-2 rounded-md text-sm px-3 py-1 font-semibold leading-tight truncate max-w-[110px]"
              title={name}
            >
              {name}
            </Badge>
          </div>
        );
      },
      width: 110,
      minWidth: 72,
      maxWidth: 120,
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
          <div className="flex items-center h-full py-2 gap-2">
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
                  <Avatar className="h-8 w-8 border border-background hover:border-primary transition-colors cursor-pointer">
                    <AvatarImg user={user} />
                    <AvatarFallback className="text-xs">{getUserInitials(user)}</AvatarFallback>
                  </Avatar>
                </HoverPopover>
              ))}
              {remainingCount > 0 && (
                <div className="h-8 w-8 rounded-full bg-muted border border-background flex items-center justify-center">
                  <span className="text-xs text-muted-foreground font-medium">+{remainingCount}</span>
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
        const formatted = formatDueDate(dueDate);
        return (
          <div className="flex items-center h-full py-2">
            <span className={`text-sm ${dueDate && dayjs(dueDate).isBefore(dayjs()) ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>{formatted}</span>
          </div>
        );
      },
      minWidth: 140,
    },
    {
      field: 'spot_id',
      headerName: 'Location',
      sortable: true,
      filter: 'agSetColumnFilter',
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
        if (!spotsLoaded) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        if (p.value == null) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        const meta: any = spotMap[p.value as number];
        if (!meta) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        const name = meta.name;
        return (<div className="flex items-center h-full py-2"><span className="text-sm text-muted-foreground">{name}</span></div>);
      },
      minWidth: 100,
    },
  ]);
}


