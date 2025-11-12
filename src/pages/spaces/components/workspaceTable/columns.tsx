import dayjs from 'dayjs';
// import { Badge } from "@/components/ui/badge";
import HoverPopover from '@/pages/spaces/components/HoverPopover';
import StatusCell from '@/pages/spaces/components/StatusCell';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Flag, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { iconService } from '@/database/iconService';
import { useState, useEffect } from 'react';
import { faTags } from "@fortawesome/free-solid-svg-icons";

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
    const iconColor = color || '#6b7280';
    const [icon, setIcon] = useState<any>(faTags);
    
    useEffect(() => {
      const loadIcon = async () => {
        if (!iconClass) {
          setIcon(faTags);
          return;
        }
        try {
          const parts = iconClass.split(' ');
          const last = parts[parts.length - 1];
          const loadedIcon = await iconService.getIcon(last);
          setIcon(loadedIcon || faTags);
        } catch (error) {
          setIcon(faTags);
        }
      };
      loadIcon();
    }, [iconClass]);
    
    return (
      <div 
        className="w-6 h-6 min-w-[1.5rem] rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: iconColor }}
      >
        <FontAwesomeIcon 
          icon={icon} 
          style={{ color: '#ffffff', fontSize: '12px' }}
          className="text-white"
        />
      </div>
    );
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
      headerName: 'Name',
      flex: 3,
      filter: false,
      wrapText: true,
      autoHeight: true,
      cellRenderer: (p: any) => {
        const name = p.data?.name || '';
        const description = p.data?.description || '';
        const cat = (opts as any)?.categoryMap?.[Number(p.data?.category_id)];
        const approvalId = p.data?.approval_id;
        const approvalStatus = p.data?.approval_status;
        const approvalTriggeredAt = p.data?.approval_triggered_at;
        const approvalMap = (opts as any)?.approvalMap || {};
        const taskApprovalInstances = (opts as any)?.taskApprovalInstances || [];
        const approval = approvalId ? approvalMap[approvalId] : null;
        
        // Calculate approval progress (only if approval exists)
        let totalApprovers = 0;
        let approvedCount = 0;
        let rejectedCount = 0;
        let pendingCount = 0;
        let progressPercent = 0;
        
        if (approvalId && taskApprovalInstances.length > 0) {
          const instances = taskApprovalInstances.filter((inst: any) => inst.task_id === p.data?.id);
          totalApprovers = instances.length;
          approvedCount = instances.filter((inst: any) => inst.status === 'approved').length;
          rejectedCount = instances.filter((inst: any) => inst.status === 'rejected').length;
          pendingCount = instances.filter((inst: any) => inst.status === 'pending').length;
          progressPercent = totalApprovers > 0 ? Math.round((approvedCount / totalApprovers) * 100) : 0;
        }
        
        // Check if approval is active
        // For ON_CREATE triggers, approval is active if task exists (was created) and status is pending/null
        // For other triggers, approval is active if it has been triggered and status is pending/null
        const isApprovalActive = approval 
          ? (approval.trigger_type === 'ON_CREATE' 
              ? (approvalStatus === 'pending' || approvalStatus === null)
              : !!approvalTriggeredAt && (approvalStatus === 'pending' || approvalStatus === null))
          : false;
        const hasApproval = !!approvalId;
        const isApprovalAssigned = !!approvalId && !approvalTriggeredAt && approval?.trigger_type !== 'ON_CREATE';
        
        // Calculate deadline and time remaining (skip time remaining calculation to avoid constant re-renders)
        let deadline: Date | null = null;
        let deadlineDisplay: string | null = null;
        
        if (approval && approval.deadline_value) {
          if (approval.deadline_type === 'hours') {
            // For ON_CREATE triggers, use task created_at if approvalTriggeredAt is not set
            const triggerTime = approvalTriggeredAt 
              ? approvalTriggeredAt 
              : (approval.trigger_type === 'ON_CREATE' && p.data?.created_at ? p.data.created_at : null);
            
            if (triggerTime) {
              const triggered = new Date(triggerTime);
              const deadlineHours = Number(approval.deadline_value);
              if (Number.isFinite(deadlineHours)) {
                deadline = new Date(triggered.getTime() + deadlineHours * 60 * 60 * 1000);
              }
            } else {
              deadlineDisplay = `${approval.deadline_value} hours`;
            }
          } else if (approval.deadline_type === 'date') {
            deadline = new Date(approval.deadline_value);
            deadlineDisplay = deadline.toLocaleDateString();
          }
        }
        
        // Get trigger type display
        const triggerTypeDisplay = approval?.trigger_type 
          ? approval.trigger_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
          : null;
        
        return (
          <div className="flex flex-col gap-1 py-1.5">
            <div className="flex items-center gap-2.5">
              <CategoryIconSmall iconClass={cat?.icon} color={cat?.color} />
              <div className="font-medium text-[14px] leading-[1.4] cursor-default text-[#1a1a1a] dark:text-white">{name}</div>
              {hasApproval && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-opacity-10" style={{
                        backgroundColor: isApprovalActive ? 'rgba(59, 130, 246, 0.1)' :
                                        approvalStatus === 'approved' ? 'rgba(34, 197, 94, 0.1)' :
                                        approvalStatus === 'rejected' ? 'rgba(239, 68, 68, 0.1)' :
                                        'rgba(156, 163, 175, 0.1)'
                      }}>
                        {isApprovalActive ? (
                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                        ) : approvalStatus === 'approved' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        ) : approvalStatus === 'rejected' ? (
                          <XCircle className="w-3.5 h-3.5 text-red-600" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-gray-500 opacity-50" />
                        )}
                        {isApprovalActive && totalApprovers > 0 && (
                          <span className="text-[11px] font-medium" style={{
                            color: approvalStatus === 'approved' ? '#22c55e' :
                                   approvalStatus === 'rejected' ? '#ef4444' :
                                   '#3b82f6'
                          }}>
                            {progressPercent}%
                          </span>
                        )}
                        {!isApprovalActive && approval?.deadline_value && (
                          <span className="text-[10px] text-gray-500">
                            {approval.deadline_type === 'hours' ? `${approval.deadline_value}h` : 'Due'}
                          </span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[320px] p-3">
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-sm">
                            {approval?.name || 'Approval Required'}
                          </div>
                          <div className="flex items-center gap-1">
                            {isApprovalAssigned && (
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                Assigned
                              </span>
                            )}
                            {approvalTriggeredAt && approvalStatus !== 'pending' && approvalStatus !== null && (
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                {approvalStatus === 'approved' ? 'Completed' : approvalStatus === 'rejected' ? 'Rejected' : 'Cancelled'}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {triggerTypeDisplay && (
                          <div className="text-xs text-muted-foreground">
                            Trigger: <span className="font-medium">{triggerTypeDisplay}</span>
                          </div>
                        )}
                        
                        {isApprovalActive && (
                          <div className="text-xs text-muted-foreground">
                            {approvalTriggeredAt ? (
                              <>Triggered: <span className="font-medium">
                                {new Date(approvalTriggeredAt).toLocaleString()}
                              </span></>
                            ) : approval?.trigger_type === 'ON_CREATE' && p.data?.created_at ? (
                              <>Created: <span className="font-medium">
                                {new Date(p.data.created_at).toLocaleString()}
                              </span></>
                            ) : null}
                          </div>
                        )}
                        
                        {isApprovalActive && totalApprovers > 0 && (
                          <>
                            <div className="text-xs text-muted-foreground">
                              Progress: {approvedCount} of {totalApprovers} approved
                              {rejectedCount > 0 && `, ${rejectedCount} rejected`}
                              {pendingCount > 0 && `, ${pendingCount} pending`}
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div 
                                className="h-1.5 rounded-full transition-all"
                                style={{
                                  width: `${progressPercent}%`,
                                  backgroundColor: approvalStatus === 'rejected' ? '#ef4444' :
                                                 approvalStatus === 'approved' ? '#22c55e' : '#3b82f6'
                                }}
                              />
                            </div>
                          </>
                        )}
                        
                        {approval?.deadline_value && (
                          <div className="text-xs text-muted-foreground border-t pt-2">
                            {isApprovalActive && deadline ? (
                              (() => {
                                // Calculate time remaining only when tooltip is shown (on hover)
                                const now = new Date();
                                const remaining = deadline.getTime() - now.getTime();
                                if (remaining > 0) {
                                  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
                                  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                                  const timeRemaining = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                                  return (
                                    <div>
                                      Time remaining: <span className="font-medium text-blue-600">{timeRemaining}</span>
                                      <div className="mt-0.5">Deadline: <span className="font-medium">{deadline.toLocaleString()}</span></div>
                                    </div>
                                  );
                                } else {
                                  return (
                                    <div>
                                      <span className="text-red-600 font-medium">⚠️ Time limit exceeded</span>
                                      <div className="mt-0.5">Deadline: <span className="font-medium">{deadline.toLocaleString()}</span></div>
                                    </div>
                                  );
                                }
                              })()
                            ) : isApprovalActive ? (
                              deadlineDisplay ? (
                                <div>Deadline: <span className="font-medium">{deadlineDisplay}</span></div>
                              ) : null
                            ) : (
                              <div>
                                Deadline: <span className="font-medium">
                                  {approval.deadline_type === 'hours' 
                                    ? `${approval.deadline_value} hours after ${approval.trigger_type === 'ON_CREATE' ? 'creation' : 'trigger'}`
                                    : deadlineDisplay || approval.deadline_value}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {approvalStatus && (
                          <div className="text-xs border-t pt-2">
                            Status: <span className="font-medium capitalize">{approvalStatus}</span>
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {showDescriptions && description && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="wh-task-desc mt-0.5 pl-7 text-[12px] leading-relaxed text-[#6b7280] dark:text-muted-foreground"
                      style={{
                        whiteSpace: 'normal',
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical' as any,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {description}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="bottom" 
                    align="start"
                    sideOffset={8}
                    collisionPadding={{ left: 300, right: 16, top: 16, bottom: 16 }}
                    avoidCollisions={true}
                    className="max-w-[520px] whitespace-pre-wrap text-base leading-relaxed z-[100]"
                    style={{ 
                      maxWidth: 'min(520px, calc(100vw - 340px))' // Account for sidebar width (~280px) + padding
                    }}
                  >
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
      onCellClicked: (params: any) => {
        // Prevent row click event from firing when clicking anywhere in the status column
        if (params.event) {
          params.event.stopPropagation();
          params.event.preventDefault();
        }
      },
      onCellMouseDown: (params: any) => {
        // Also prevent on mouse down to catch the event earlier
        if (params.event) {
          params.event.stopPropagation();
        }
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
      headerName: 'Owner',
      width: 140,
      filter: false,
      cellRenderer: (p: any) => {
        if (!usersLoaded) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        const userIds = p.data?.user_ids;
        if (userIds == null) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        const users = getUsersFromIds(userIds, userMap) || [];
        if (users.length === 0) return (<div className="flex items-center h-full py-2"><div className="text-[12px] text-muted-foreground">—</div></div>);
        const displayUsers = users.slice(0, 3);
        const remainingCount = users.length - displayUsers.length;
        return (
          <div className="flex items-center h-full py-1 gap-2">
            <div className="flex items-center -space-x-1.5">
              {displayUsers.map((user: any) => (
                <HoverPopover key={user.id} content={(
                  <div className="flex flex-col items-center gap-3">
                    <Avatar className="h-16 w-16 border-2 border-background bg-muted text-foreground">
                      <UserInitial user={user} />
                    </Avatar>
                    <span className="text-base font-medium text-popover-foreground text-center">{getUserDisplayName(user)}</span>
                  </div>
                )}>
                  <Avatar className="h-6 w-6 border transition-colors cursor-pointer bg-muted text-foreground" title={getUserDisplayName(user)} style={{ borderColor: '#e5e7eb' }}>
                    <UserInitial user={user} />
                  </Avatar>
                </HoverPopover>
              ))}
              {remainingCount > 0 && (
                <div className="h-6 w-6 rounded-full bg-muted border flex items-center justify-center" style={{ borderColor: '#e5e7eb' }}>
                  <span className="text-[9px] text-muted-foreground font-medium">+{remainingCount}</span>
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
              <span className="text-[12px] text-muted-foreground">—</span>
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
          <div className="flex items-center h-full py-2">
            <span className={`inline-flex items-center ${colorCls}`}>
              <span className="text-[12px]">{isOverdue ? d.fromNow() : `in ${Math.abs(daysDiff)} day${Math.abs(daysDiff) === 1 ? '' : 's'}`}</span>
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
      width: 120,
      minWidth: 100,
      maxWidth: 160,
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
        if (p.value == null) return (<div className="flex items-center h-full py-2"><span className="text-[12px] text-muted-foreground">—</span></div>);
        const meta: any = spotMap[p.value as number];
        if (!meta) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        const name = meta.name;
        const tag = (
          <div className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" style={{ color: '#9ca3af' }} />
            <span className="truncate max-w-[160px]">{name}</span>
          </div>
        );
        return (
          <div className="flex items-center h-full py-1">{tag}</div>
        );
      },
      flex: 2,
      minWidth: 180,
    },
    {
      field: 'created_at',
      colId: 'created_at',
      headerName: 'Last modified',
      sortable: true,
      filter: false,
      comparator: (valueA: any, valueB: any) => {
        // Proper date comparison for AG Grid client-side sorting
        if (!valueA && !valueB) return 0;
        if (!valueA) return -1;
        if (!valueB) return 1;
        const dateA = new Date(valueA).getTime();
        const dateB = new Date(valueB).getTime();
        // Return negative if dateA is newer (for descending sort, newer should come first)
        return dateA - dateB;
      },
      cellRenderer: (p: any) => {
        const createdAt = p.data?.created_at;
        if (!createdAt) {
          return (
            <div className="flex items-center h-full py-2">
              <span className="text-[12px] text-muted-foreground">—</span>
            </div>
          );
        }
        const d = dayjs(createdAt);
        const inner = (
          <div className="flex items-center h-full py-2">
            <span className="text-[12px] text-muted-foreground">{d.fromNow()}</span>
          </div>
        );
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>{inner}</TooltipTrigger>
              <TooltipContent side="top">{d.format('MMM D, YYYY [at] h:mm A')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
      width: 120,
      minWidth: 100,
      maxWidth: 160,
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


