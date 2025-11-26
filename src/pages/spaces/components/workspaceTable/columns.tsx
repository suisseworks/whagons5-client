import dayjs from 'dayjs';
// import { Badge } from "@/components/ui/badge";
import HoverPopover from '@/pages/spaces/components/HoverPopover';
import StatusCell from '@/pages/spaces/components/StatusCell';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Flag, CheckCircle2, Clock, XCircle, MessageSquare } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { iconService } from '@/database/iconService';
import { useState, useEffect } from 'react';
import { faTags } from "@fortawesome/free-solid-svg-icons";

// Calculate text color based on background color luminance
function getContrastTextColor(backgroundColor: string): string {
  if (!backgroundColor) return '#1a1a1a';
  
  let r = 0, g = 0, b = 0;
  
  // Handle hex colors (#RRGGBB or #RGB)
  if (backgroundColor.startsWith('#')) {
    const hex = backgroundColor.slice(1);
    
    if (hex.length === 3) {
      // 3-digit hex (#RGB)
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      // 6-digit hex (#RRGGBB)
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
  } else if (backgroundColor.startsWith('rgb')) {
    // Handle rgb/rgba colors
    const matches = backgroundColor.match(/\d+/g);
    if (matches && matches.length >= 3) {
      r = parseInt(matches[0], 10);
      g = parseInt(matches[1], 10);
      b = parseInt(matches[2], 10);
    }
  }
  
  // Validate RGB values
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return '#1a1a1a'; // Default to dark text
  }
  
  // Calculate relative luminance (per WCAG 2.1)
  // Normalize RGB values to 0-1 range
  const normalize = (val: number) => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  };
  
  const rNorm = normalize(r);
  const gNorm = normalize(g);
  const bNorm = normalize(b);
  
  const luminance = 0.2126 * rNorm + 0.7152 * gNorm + 0.0722 * bNorm;
  
  // Return white for dark backgrounds (luminance < 0.5), dark for light backgrounds
  return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
}

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
    tagMap,
    taskTags,
    tagDisplayMode = 'icon-text',
    visibleColumns,
    workspaceCustomFields,
    taskCustomFieldValueMap,
    taskNotes,
    taskAttachments,
    approvalApprovers,
  } = opts;

  const visibilitySet: Set<string> | null = Array.isArray(visibleColumns)
    ? new Set<string>(visibleColumns as string[])
    : null;

  const isVisible = (id: string | undefined): boolean => {
    if (!visibilitySet) return true;
    if (!id) return true;
    // "name" is always visible as the primary column
    if (id === 'name') return true;
    return visibilitySet.has(id);
  };

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

  // Tag icon component for inline use in tag badges
  const TagIconSmall = ({ iconClass, color }: { iconClass?: string | null; color?: string }) => {
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
      <FontAwesomeIcon 
        icon={icon} 
        className="w-3 h-3 flex-shrink-0"
        style={{ color: color || '#ffffff' }}
      />
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

  // Helper function to render approval/SLA badge
  const renderApprovalOrSLA = (p: any) => {
    const approvalId = p.data?.approval_id;
    const approvalStatus = p.data?.approval_status;
    const approvalTriggeredAt = p.data?.approval_triggered_at;
    const approvalMap = (opts as any)?.approvalMap || {};
    const taskApprovalInstances = (opts as any)?.taskApprovalInstances || [];
    const categoryMap = (opts as any)?.categoryMap || {};
    const categoryId = p.data?.category_id;
    const category = categoryId ? categoryMap[Number(categoryId)] : null;
    const slaId = category?.sla_id;
    
    const approval = approvalId ? approvalMap[approvalId] : null;
    
    // Calculate approval progress
    let totalApprovers = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;
    let progressPercent = 0;
    
    let approverDetails: Array<{
      id: number | string;
      name: string;
      status: string;
      statusColor: string;
      isRequired: boolean;
      step: number;
      respondedAt?: string | null;
    }> = [];
    
    if (approvalId && taskApprovalInstances.length > 0) {
      const taskRowId = Number(p.data?.id);
      const instances = taskApprovalInstances
        .filter((inst: any) => Number(inst.task_id) === taskRowId)
        .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));
      totalApprovers = instances.length;
      approvedCount = instances.filter((inst: any) => String(inst.status).toLowerCase() === 'approved').length;
      rejectedCount = instances.filter((inst: any) => String(inst.status).toLowerCase() === 'rejected').length;
      pendingCount = instances.filter((inst: any) => !inst.status || String(inst.status).toLowerCase() === 'pending').length;
      progressPercent = totalApprovers > 0 ? Math.round((approvedCount / totalApprovers) * 100) : 0;
      
      approverDetails = instances.map((inst: any, idx: number) => {
        const userRecord = inst.approver_user_id != null
          ? ((userMap?.[Number(inst.approver_user_id)]) || (userMap?.[String(inst.approver_user_id)]) || null)
          : null;
        const displayName = userRecord
          ? getUserDisplayName(userRecord)
          : (inst.approver_name || `Approver ${idx + 1}`);
        const normalizedStatus = (inst.status || 'pending').toString().toLowerCase();
        const statusColor =
          normalizedStatus === 'approved'
            ? 'text-green-600'
            : normalizedStatus === 'rejected'
              ? 'text-red-600'
              : normalizedStatus === 'skipped'
                ? 'text-amber-600'
                : 'text-blue-600';
        return {
          id: inst.id ?? `${inst.task_id}-${idx}`,
          name: displayName,
          status: normalizedStatus,
          statusColor,
          isRequired: inst.is_required !== false,
          step: (inst.order_index ?? idx) + 1,
          respondedAt: inst.responded_at,
        };
      });
    }

    if (approverDetails.length === 0 && approvalId && Array.isArray(approvalApprovers)) {
      const configuredApprovers = approvalApprovers
        .filter((ap: any) => Number(ap.approval_id) === Number(approvalId))
        .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));
      if (configuredApprovers.length > 0) {
        approverDetails = configuredApprovers.map((config: any, idx: number) => {
          const userRecord = config.approver_type === 'user'
            ? ((userMap?.[Number(config.approver_id)]) || (userMap?.[String(config.approver_id)]) || null)
            : null;
          const name = userRecord
            ? getUserDisplayName(userRecord)
            : (
              config.approver_type === 'role'
                ? `Role #${config.approver_id}`
                : config.approver_label || `Approver ${idx + 1}`
            );
          const scopeLabel = config.scope && config.scope !== 'global'
            ? ` • ${String(config.scope).replace(/_/g, ' ')}`
            : '';
          return {
            id: config.id ?? `config-${idx}`,
            name: `${name}${scopeLabel}`,
            status: 'not started',
            statusColor: 'text-muted-foreground',
            isRequired: config.required !== false,
            step: (config.order_index ?? idx) + 1,
            respondedAt: null,
          };
        });
      }
    }

    const isApprovalActive = approval 
      ? (approval.trigger_type === 'ON_CREATE' 
          ? (approvalStatus === 'pending' || approvalStatus === null)
          : !!approvalTriggeredAt && (approvalStatus === 'pending' || approvalStatus === null))
      : false;
    const hasApproval = !!approvalId;
    
    // Calculate deadline
    let deadline: Date | null = null;
    let deadlineDisplay: string | null = null;
    
    if (approval && approval.deadline_value) {
      if (approval.deadline_type === 'hours') {
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
    const triggerTypeDisplay = approval?.trigger_type 
      ? approval.trigger_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      : null;

    // Show approval if exists
    if (hasApproval && approval) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 px-2 py-1 rounded-md border transition-all cursor-default group hover:shadow-sm" style={{
                backgroundColor: isApprovalActive ? 'rgba(59, 130, 246, 0.04)' :
                                approvalStatus === 'approved' ? 'rgba(34, 197, 94, 0.04)' :
                                approvalStatus === 'rejected' ? 'rgba(239, 68, 68, 0.04)' :
                                'rgba(249, 250, 251, 1)',
                borderColor: isApprovalActive ? 'rgba(59, 130, 246, 0.2)' :
                             approvalStatus === 'approved' ? 'rgba(34, 197, 94, 0.2)' :
                             approvalStatus === 'rejected' ? 'rgba(239, 68, 68, 0.2)' :
                             'rgba(229, 231, 235, 0.6)'
              }}>
                {/* Status Icon Area */}
                <div className="flex items-center justify-center shrink-0">
                  {isApprovalActive ? (
                    <div className="relative flex items-center justify-center w-4 h-4">
                      <svg className="animate-spin w-3.5 h-3.5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  ) : approvalStatus === 'approved' ? (
                    <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="w-3 h-3 text-green-600" />
                    </div>
                  ) : approvalStatus === 'rejected' ? (
                    <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center">
                       <XCircle className="w-3 h-3 text-red-600" />
                    </div>
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                  )}
                </div>

                {/* Text Info Area */}
                <div className="flex flex-col leading-none justify-center gap-0.5 min-w-[60px]">
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="text-[11px] font-semibold truncate" style={{
                      color: isApprovalActive ? '#2563eb' :
                             approvalStatus === 'approved' ? '#16a34a' :
                             approvalStatus === 'rejected' ? '#dc2626' :
                             '#4b5563'
                    }}>
                      {isApprovalActive ? 'Reviewing' :
                       approvalStatus === 'approved' ? 'Approved' :
                       approvalStatus === 'rejected' ? 'Rejected' :
                       'Pending'}
                    </span>
                  </div>

                  {/* Secondary Line: Progress or Time */}
                  <div className="flex items-center gap-1.5">
                    {(isApprovalActive || approvalStatus === 'pending') && totalApprovers > 0 && (
                       <span className="text-[9px] text-muted-foreground font-medium bg-gray-100 px-1 rounded-sm">
                         {approvedCount}/{totalApprovers}
                       </span>
                    )}
                    
                    {(isApprovalActive && deadline) ? (
                       (() => {
                         const now = new Date();
                         const remaining = deadline.getTime() - now.getTime();
                         const isLate = remaining < 0;
                         
                         if (isLate) return <span className="text-[9px] text-red-600 font-medium">Overdue</span>;
                         
                         const hours = Math.floor(remaining / (1000 * 60 * 60));
                         const days = Math.floor(hours / 24);
                         
                         const timeText = days > 0 ? `${days}d left` : hours > 0 ? `${hours}h left` : `<1h left`;
                         
                         return <span className="text-[9px] text-amber-600 font-medium">{timeText}</span>;
                       })()
                    ) : null}
                  </div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="min-w-[360px] max-w-[440px] p-4">
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm">
                    {approval?.name || 'Approval Required'}
                  </div>
                </div>
                {triggerTypeDisplay && (
                  <div className="text-xs text-muted-foreground">
                    Trigger: <span className="font-medium">{triggerTypeDisplay}</span>
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
                {approverDetails.length > 0 && (
                  <div className="text-xs border-t pt-3 space-y-2">
                    <div className="uppercase tracking-wide text-[10px] text-muted-foreground">Approvers</div>
                    <div className="space-y-1.5">
                      {approverDetails.map((detail) => (
                        <div
                          key={detail.id}
                          className="flex items-start justify-between gap-3 rounded border border-muted px-2 py-1.5 bg-background/80"
                        >
                          <div>
                            <div className="text-[11px] font-semibold text-foreground">{detail.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              Step {detail.step}{detail.isRequired ? ' • Required' : ' • Optional'}
                            </div>
                            {detail.respondedAt && (
                              <div className="text-[10px] text-muted-foreground">
                                {dayjs(detail.respondedAt).format('MMM D, h:mm A')}
                              </div>
                            )}
                          </div>
                          <span className={`text-[11px] font-semibold capitalize ${detail.statusColor}`}>
                            {detail.status || 'pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {approval?.deadline_value && (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    {isApprovalActive && deadline ? (
                      (() => {
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
                    ) : deadlineDisplay ? (
                      <div>Deadline: <span className="font-medium">{deadlineDisplay}</span></div>
                    ) : null}
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
      );
    }
    
    // Show SLA if exists (and no approval)
    if (slaId) {
      return (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-opacity-10 flex-shrink-0" style={{
          backgroundColor: 'rgba(139, 92, 246, 0.1)'
        }}>
          <Clock className="w-3.5 h-3.5 text-purple-600" />
          <span className="text-[11px] font-medium text-purple-600">SLA</span>
        </div>
      );
    }
    
    return null;
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
          const taskRowId = Number(p.data?.id);
          const instances = taskApprovalInstances
            .filter((inst: any) => Number(inst.task_id) === taskRowId)
            .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));
          totalApprovers = instances.length;
          approvedCount = instances.filter((inst: any) => String(inst.status).toLowerCase() === 'approved').length;
          rejectedCount = instances.filter((inst: any) => String(inst.status).toLowerCase() === 'rejected').length;
          pendingCount = instances.filter((inst: any) => !inst.status || String(inst.status).toLowerCase() === 'pending').length;
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
        
        // Get tags for this task
        const taskId = Number(p.data?.id);
        const taskTagIds = taskTags
          ?.filter((tt: any) => tt.task_id === taskId)
          .map((tt: any) => Number(tt.tag_id)) || [];
        const taskTagsData = taskTagIds
          .map((tagId: number) => {
            const tag = tagMap?.[tagId];
            return tag && tag.name ? { ...tag, id: tagId } : null;
          })
          .filter((tag: any) => tag !== null);
        // Show all tags (they will wrap to 2 lines max)
        const remainingTagsCount = 0; // Removed limit - show all tags

        return (
          <div className="flex flex-col gap-1 py-1.5 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
              <CategoryIconSmall iconClass={cat?.icon} color={cat?.color} />
              <div className="font-medium text-[14px] leading-[1.4] cursor-default text-[#1a1a1a] dark:text-white min-w-0 flex-1 truncate">{name}</div>
              {/* Tags - inline with name, wrap naturally if needed */}
              {(taskTagsData && taskTagsData.length > 0) && (
                <>
                  {taskTagsData.map((tag: any, idx: number) => {
                    if (!tag || !tag.name) return null;
                    const bgColor = tag.color || '#6B7280';
                    const textColor = getContrastTextColor(bgColor);
                    return (
                      <div
                        key={tag.id || `tag-${idx}`}
                        className={`inline-flex items-center ${tagDisplayMode === 'icon' ? 'gap-0 px-1.5' : 'gap-1.5 px-2'} py-1 rounded text-xs font-medium leading-none flex-shrink-0`}
                        style={{
                          backgroundColor: bgColor,
                          color: textColor,
                        }}
                        title={tag.name}
                      >
                        <TagIconSmall iconClass={tag.icon} color={textColor} />
                        {tagDisplayMode === 'icon-text' && (
                          <span className="whitespace-nowrap">{tag.name}</span>
                        )}
                      </div>
                    );
                  })}
                  {remainingTagsCount > 0 && (
                    <div
                      className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-muted-foreground flex-shrink-0"
                      style={{
                        backgroundColor: '#F3F4F6',
                        border: '1px solid #E5E7EB',
                      }}
                      title={`${remainingTagsCount} more tag${remainingTagsCount !== 1 ? 's' : ''}`}
                    >
                      +{remainingTagsCount}
                    </div>
                  )}
                </>
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
      colId: 'config',
      headerName: 'Config',
      width: 100,
      minWidth: 80,
      maxWidth: 120,
      filter: false,
      sortable: false,
      cellRenderer: (p: any) => {
        const config = renderApprovalOrSLA(p);
        if (!config) {
          return (
            <div className="flex items-center h-full py-2">
            </div>
          );
        }
        return (
          <div className="flex items-center h-full py-1">
            {config}
          </div>
        );
      },
    },
    {
      colId: 'notes',
      headerName: '',
      width: 60,
      minWidth: 60,
      maxWidth: 60,
      filter: false,
      sortable: false,
      cellRenderer: (p: any) => {
        const taskId = p.data?.id;
        if (!taskId) return null;
        
        const notesCount = (taskNotes || []).filter((n: any) => Number(n.task_id) === Number(taskId)).length;
        const attachmentsCount = (taskAttachments || []).filter((a: any) => Number(a.task_id) === Number(taskId)).length;
        const total = notesCount + attachmentsCount;
        
        // Always render placeholder to maintain alignment if desired, or only when content
        // Matching the screenshot style (green badge)
        return (
          <div className="flex items-center justify-center h-full w-full">
             <div 
               className={`relative group cursor-pointer flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted transition-colors ${total === 0 ? 'opacity-30 hover:opacity-100' : ''}`}
               onClick={(e) => {
                e.stopPropagation(); // Prevent row selection/click
                const event = new CustomEvent('wh:openTaskNotes', { detail: { taskId, taskName: p.data?.name } });
                window.dispatchEvent(event);
             }}>
              <MessageSquare className={`w-4 h-4 ${total > 0 ? 'text-green-600 fill-green-600/10' : 'text-muted-foreground'}`} />
              {total > 0 && (
                <div className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-green-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border-2 border-background">
                  {total}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      field: 'status_id',
      headerName: 'Status',
      sortable: true,
      rowGroup: undefined,
      hide: !isVisible('status_id'),
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
      hide: groupField === 'spot_id' ? true : !isVisible('spot_id'),
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

  // Append dynamic custom-field columns (per-workspace)
  const customFieldCols: any[] = [];
  if (Array.isArray(workspaceCustomFields) && workspaceCustomFields.length > 0) {
    for (const cf of workspaceCustomFields as any[]) {
      const fieldId = Number((cf as any).fieldId);
      const field = (cf as any).field || {};
      const categoriesForField = (cf as any).categories || [];
      if (!Number.isFinite(fieldId)) continue;

      const colKey = `cf_${fieldId}`;
      // Only render if this custom field is selected in visibleColumns
      if (!isVisible(colKey)) continue;

      const headerName = (() => {
        const base = String(field.name || `Field #${fieldId}`);
        if (!categoriesForField || categoriesForField.length === 0) return base;
        const names = categoriesForField.map((c: any) => c?.name).filter(Boolean);
        if (names.length === 0) return base;
        if (names.length === 1) return `${base} (${names[0]})`;
        return `${base} (${names[0]} +${names.length - 1})`;
      })();

      customFieldCols.push({
        field: colKey,
        colId: colKey,
        headerName,
        sortable: false,
        filter: false,
        wrapText: true,
        autoHeight: true,
        minWidth: 160,
        flex: 2,
        valueGetter: (p: any) => {
          const taskId = Number(p.data?.id);
          if (!Number.isFinite(taskId) || !taskCustomFieldValueMap) return null;
          const key = `${taskId}:${fieldId}`;
          const row = taskCustomFieldValueMap.get(key);
          if (!row) return null;
          // Prefer typed value based on field_type if present
          const t = String(row.type || row.field_type || '').toLowerCase();
          if (t === 'number' || t === 'numeric') return row.value_numeric ?? row.value;
          if (t === 'date' || t === 'datetime') return row.value_date ?? row.value;
          if (t === 'json') return row.value_json ?? row.value;
          return row.value;
        },
        cellRenderer: (p: any) => {
          const v = p.value;
          if (v === null || v === undefined || v === '') {
            return (
              <div className="flex items-center h-full py-2">
                <span className="text-[12px] text-muted-foreground">—</span>
              </div>
            );
          }
          // Simple text rendering for now
          return (
            <div className="flex items-center h-full py-2">
              <span className="text-[12px] truncate max-w-full">{String(v)}</span>
            </div>
          );
        },
      });
    }
  }

  if (customFieldCols.length > 0) {
    (cols as any[]).push(...customFieldCols);
  }

  // Apply grouping to status or priority when selected
  if (groupField === 'status_id') {
    const c = cols.find((x: any) => x.field === 'status_id');
    if (c) { c.rowGroup = true; c.hide = true; }
  }
  if (groupField === 'priority_id') {
    const c = cols.find((x: any) => x.field === 'priority_id');
    if (c) { c.rowGroup = true; c.hide = true; }
  }

  // Apply visibility to non-group columns that don't already have an explicit hide set
  for (const col of cols as any[]) {
    const id = (col.colId as string) || (col.field as string) || '';
    if (id === 'name') continue;
    // Skip if grouping logic already forced hide
    if (col.rowGroup && col.hide === true) continue;
    if (!isVisible(id)) {
      col.hide = true;
    }
  }

  return cols;
}


