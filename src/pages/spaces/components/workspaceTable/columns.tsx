import dayjs from 'dayjs';
// import { Badge } from "@/components/ui/badge";
import HoverPopover from '@/pages/spaces/components/HoverPopover';
import StatusCell from '@/pages/spaces/components/StatusCell';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Flag, CheckCircle2, Clock, XCircle, MessageSquare, Check, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { memo, useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTags } from '@fortawesome/free-solid-svg-icons';
import { getContrastTextColor } from './columnUtils/color';
import { useIconDefinition } from './columnUtils/icon';
import { promptForComment } from './columnUtils/promptForComment';
import { TasksCache } from '@/store/indexedDB/TasksCache';


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
    density = 'comfortable',
    tagMap,
    taskTagsMap,
    tagDisplayMode = 'icon-text',
    visibleColumns,
    workspaceCustomFields,
    taskCustomFieldValueMap,
    customFields,
    categoryMap,
    taskNotes,
    taskAttachments,
    approvalApprovers,
    currentUserId,
    approvalMap = {},
    taskApprovalInstances = [],
    onDeleteTask,
    onLogTask,
    slaMap = {},
  } = opts;

  const appendCellClass = (existing: any, cls: string) => {
    if (!existing) return cls;
    if (typeof existing === 'string') return `${existing} ${cls}`;
    if (Array.isArray(existing)) return [...existing, cls];
    return existing;
  };

  // Precompute the latest note per task for quick lookup in cell renderers
  const latestNoteByTaskId = new Map<number, { text: string; ts: number }>();
  if (Array.isArray(taskNotes) && taskNotes.length > 0) {
    for (const note of taskNotes as any[]) {
      const taskId = Number((note as any)?.task_id);
      if (!Number.isFinite(taskId)) continue;
      const text = (note as any)?.note;
      if (!text) continue;
      const tsRaw = (note as any)?.updated_at || (note as any)?.created_at;
      const tsParsed = tsRaw ? new Date(tsRaw as any).getTime() : 0;
      const ts = Number.isFinite(tsParsed) ? tsParsed : 0;
      const prev = latestNoteByTaskId.get(taskId);
      if (!prev || ts >= prev.ts) {
        latestNoteByTaskId.set(taskId, { text: String(text), ts });
      }
    }
  }

  // Lightweight caches to avoid repeated computation across many identical values
  const priorityPaletteCache = new Map<number, { bg: string; text: string }>();
  const getPriorityPalette = (priorityId: number, name: string, color?: string) => {
    const cached = priorityPaletteCache.get(priorityId);
    if (cached) return cached;
    const lower = (name || '').toLowerCase();
    const palette =
      lower.includes('high')
        ? { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444' }
        : lower.includes('medium')
          ? { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B' }
          : lower.includes('low')
            ? { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981' }
            : { bg: `color-mix(in oklab, ${(color || '#6B7280')} 12%, #ffffff 88%)`, text: (color || '#6B7280') };
    priorityPaletteCache.set(priorityId, palette);
    return palette;
  };


  const userNameCache = new Map<number, string>();
  const getCachedUserName = (user: any): string => {
    const id = Number((user as any)?.id);
    if (!Number.isFinite(id)) return getUserDisplayName(user);
    const cached = userNameCache.get(id);
    if (cached) return cached;
    const name = getUserDisplayName(user);
    userNameCache.set(id, name);
    return name;
  };

  const visibilitySet: Set<string> | null = Array.isArray(visibleColumns)
    ? new Set<string>(visibleColumns as string[])
    : null;

  const isVisible = (id: string | undefined): boolean => {
    if (!visibilitySet) return true;
    if (!id) return true;
    // Always show key columns
    if (id === 'name' || id === 'notes' || id === 'id') return true;
    return visibilitySet.has(id);
  };

  const CategoryIconSmall = memo((props: { iconClass?: string; color?: string }) => {
    const iconColor = props.color || '#6b7280';
    const iconCls = (props.iconClass || '').trim();
    const iconDef = useIconDefinition(iconCls, null);
    
    if (!iconCls || !iconDef) return null;

    return (
      <div 
        className="w-6 h-6 min-w-[1.5rem] rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: iconColor }}
      >
        <FontAwesomeIcon 
          icon={iconDef} 
          style={{ color: '#ffffff', fontSize: '12px' }}
          className="text-white"
        />
      </div>
    );
  });
  
  CategoryIconSmall.displayName = 'CategoryIconSmall';

  // Header component for ID column - just the text, no checkbox
  const IdHeaderComponent = memo((params: any) => {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <span className="text-sm font-medium">ID</span>
      </div>
    );
  });
  
  IdHeaderComponent.displayName = 'IdHeaderComponent';

  // Tag icon component for inline use in tag badges
  const TagIconSmall = (props: { iconClass?: string | null; color?: string }) => {
    const iconCls = (props.iconClass || '').trim();
    const iconDef = useIconDefinition(iconCls, faTags);

    return (
      <FontAwesomeIcon 
        icon={iconDef || faTags} 
        className="w-3 h-3 flex-shrink-0"
        style={{ color: props.color || '#ffffff' }}
      />
    );
  };

  const getUserColorStyle = (color?: string | null) => {
    if (!color) return {};
    return {
      backgroundColor: color,
      color: getContrastTextColor(color),
    };
  };

  const UserInitial = ({ user }: { user: any }) => {
    const name: string = getUserDisplayName(user) || '';
    const initial = (name.trim().charAt(0) || '?').toUpperCase();
    const userColor = user?.color;
    
    // Check if user has a valid color (non-empty string that's not just whitespace)
    // Also handle cases where color might be '#000000' or similar dark colors
    const hasColor = !!userColor && 
                     typeof userColor === 'string' && 
                     userColor.trim() !== '' && 
                     userColor.trim() !== 'null' && 
                     userColor.trim() !== 'undefined';
    
    const colorStyle = hasColor ? getUserColorStyle(userColor) : {};

    // Debug once: surface the first few user colors used in cells
    try {
      if (!(window as any).__whUserColorLog) (window as any).__whUserColorLog = { count: 0, seen: new Set() as Set<any> };
      const logState = (window as any).__whUserColorLog as { count: number; seen: Set<any> };
      const uid = user?.id ?? user?.name;
      if (logState.count < 5 && uid != null && !logState.seen.has(uid)) {
        console.log('[wh:user-cell-color]', { id: user?.id, name: user?.name, color: userColor, hasColor, colorStyle });
        logState.count += 1;
        logState.seen.add(uid);
      }
    } catch { /* ignore */ }
    
    // Match settings behavior: stored color when present; primary fallback otherwise
    const fallbackClass = hasColor ? 'text-[11px] font-semibold' : 'text-[11px] font-semibold bg-primary text-primary-foreground';
    const fallbackStyle = hasColor ? colorStyle : undefined;

    return (
      <AvatarFallback
        className={fallbackClass}
        style={fallbackStyle}
      >
        {initial}
      </AvatarFallback>
    );
  };

  const formatSlaDuration = (seconds?: number | null) => {
    const secs = Number(seconds);
    if (!Number.isFinite(secs)) return null;
    const totalMinutes = Math.floor(secs / 60);
    const hrs = Math.floor(totalMinutes / 60);
    const remMins = totalMinutes % 60;
    if (hrs > 0 && remMins > 0) return `${hrs}h ${remMins}m`;
    if (hrs > 0) return `${hrs}h`;
    return `${remMins}m`;
  };

  const renderSlaPill = (slaId: any) => {
    const sla = slaMap?.[Number(slaId)];
    const responseLabel = formatSlaDuration(sla?.response_time);
    const resolutionLabel = formatSlaDuration(sla?.resolution_time);
    const priorityLabel = sla?.priority_id ? `Priority #${sla.priority_id}` : null;
    const pill = (
      <div 
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-opacity-10 flex-shrink-0 cursor-pointer"
        style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <Clock className="w-3.5 h-3.5 text-purple-600" />
        <span className="text-[11px] font-medium text-purple-600">SLA</span>
      </div>
    );

    if (!sla) return pill;

    return (
      <Popover>
        <PopoverTrigger asChild>
          {pill}
        </PopoverTrigger>
        <PopoverContent side="right" className="max-w-[320px] p-0">
          <div className="rounded-lg overflow-hidden border border-border/60 shadow-sm bg-card">
            <div className="bg-purple-600 text-white px-3 py-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <div className="text-sm font-semibold truncate">{sla.name || 'SLA'}</div>
            </div>
            <div className="p-3 space-y-2 text-[12px] text-foreground">
              {responseLabel && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-muted-foreground">Response:</span>
                  <span className="font-semibold">{responseLabel}</span>
                </div>
              )}
              {resolutionLabel && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-muted-foreground">Resolution:</span>
                  <span className="font-semibold">{resolutionLabel}</span>
                </div>
              )}
              {priorityLabel && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-muted-foreground">Priority:</span>
                  <span>{priorityLabel}</span>
                </div>
              )}
              {sla.description ? (
                <div className="text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                  {sla.description}
                </div>
              ) : null}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  // Helper function to render approval/SLA badge
  const renderApprovalOrSLA = (p: any) => {
    // Prefer node.data over p.data for more up-to-date information
    // node.data is updated when we call node.setData()
    const row = p?.node?.data || p?.data || {};
    const approvalId = row?.approval_id;
    const approvalStatus = row?.approval_status;
    
    // Debug log to verify cell renderer is getting updated data
    if (row?.id && (approvalStatus === 'approved' || approvalStatus === 'rejected')) {
      console.log('[CellRenderer] renderApprovalOrSLA called with:', {
        taskId: row.id,
        approvalStatus: approvalStatus,
        nodeDataApprovalStatus: p?.node?.data?.approval_status,
        pDataApprovalStatus: p?.data?.approval_status,
        usingNodeData: !!p?.node?.data
      });
    }
    const categoryId = row?.category_id;
    const category = categoryId ? categoryMap[Number(categoryId)] : null;
    const slaId = row?.sla_id ?? category?.sla_id;
    
    const approval = approvalId ? approvalMap[approvalId] : null;
    const hasApproval = !!approvalId;
    const normalizedApprovalStatus = (approvalStatus ?? '').toString().toLowerCase();
    const approvalVisible = hasApproval && normalizedApprovalStatus !== 'not_triggered';
    const slaPill = slaId ? renderSlaPill(slaId) : null;
    const approvalStatusLabel =
      normalizedApprovalStatus === 'approved' ? 'Approved' :
      normalizedApprovalStatus === 'rejected' ? 'Rejected' :
      normalizedApprovalStatus === 'cancelled' ? 'Cancelled' :
      normalizedApprovalStatus === 'pending' || normalizedApprovalStatus === '' ? 'Approval pending' :
      (normalizedApprovalStatus ? normalizedApprovalStatus.charAt(0).toUpperCase() + normalizedApprovalStatus.slice(1) : 'Approval pending');
    
    // Calculate approval progress
    
    let approverDetails: Array<{
      id: number | string;
      name: string;
      status: string;
      statusColor: string;
      isRequired: boolean;
      step: number;
      respondedAt?: string | null;
      comment?: string | null;
      approverUserId?: number | null;
    }> = [];
    
    if (approvalId && taskApprovalInstances.length > 0) {
      const taskRowId = Number(p.data?.id);
      const instances = taskApprovalInstances
        .filter((inst: any) => Number(inst.task_id) === taskRowId)
        .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));
      
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
          comment: inst.response_comment,
          approverUserId: inst.approver_user_id != null ? Number(inst.approver_user_id) : null,
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
            approverUserId: config.approver_type === 'user' && config.approver_id ? Number(config.approver_id) : null,
          };
        });
      }
    }

    const canAct = !!currentUserId && approverDetails.some((d) => {
      const uid = Number(d.approverUserId);
      const pendingLike = !d.status || d.status === 'pending' || d.status === 'not started';
      return Number.isFinite(uid) && uid === Number(currentUserId) && pendingLike;
    });
    const submitDecision = async (decision: 'approved' | 'rejected') => {
      let comment: string | null = null;
      if (decision === 'rejected') {
        comment = await promptForComment('Reject approval', 'A comment is required to reject this approval.');
        if (comment === null) return;
      }
      // Find the pending instance for the current user (best effort)
      const currentUid = Number(currentUserId);
      const myInstance = approverDetails.find((d) => Number(d.approverUserId) === currentUid);
      const approverUserIdToSend = myInstance?.approverUserId ?? (Number.isFinite(currentUid) ? currentUid : null);
      if (!approverUserIdToSend) {
        try {
          window.dispatchEvent(new CustomEvent('wh:notify', {
            detail: { type: 'error', message: 'No matching approver found for this task.' }
          }));
        } catch {}
        return;
      }
      try {
        const response = await api.post('/approvals/decide', {
          task_id: p.data?.id,
          approval_id: approvalId,
          approver_user_id: approverUserIdToSend,
          decision,
          comment,
          task_status_id: p.data?.status_id,
        });
        
        console.log('Approval decision response:', response.data);
        
        // Update row with response data immediately
        if (p.data && response.data?.data) {
          const responseData = response.data.data;
          const updatedTask = responseData.task;
          const updatedInstances = responseData.instances;
          
          console.log('Response data structure:', {
            hasTask: !!updatedTask,
            hasInstances: Array.isArray(updatedInstances),
            taskApprovalStatus: updatedTask?.approval_status,
            taskKeys: updatedTask ? Object.keys(updatedTask) : []
          });
          
          // Update all relevant fields from the server response
          if (updatedTask) {
            // Always update approval_status if present in response
            if (updatedTask.approval_status !== undefined && updatedTask.approval_status !== null) {
              p.data.approval_status = String(updatedTask.approval_status).toLowerCase();
              console.log('Updated approval_status from task:', p.data.approval_status);
            }
            if (updatedTask.approval_completed_at !== undefined) {
              p.data.approval_completed_at = updatedTask.approval_completed_at;
            }
            if (updatedTask.status_id !== undefined) {
              p.data.status_id = updatedTask.status_id;
            }
          }
          
          // Fallback: Calculate approval status from instances if not provided or still pending
          if ((!p.data.approval_status || p.data.approval_status === 'pending') && Array.isArray(updatedInstances) && updatedInstances.length > 0) {
            const hasReject = updatedInstances.some((inst: any) => 
              inst.status && String(inst.status).toLowerCase() === 'rejected'
            );
            const allApproved = updatedInstances.length > 0 && 
              updatedInstances.every((inst: any) => 
                inst.status && String(inst.status).toLowerCase() === 'approved'
              );
            
            if (hasReject) {
              p.data.approval_status = 'rejected';
            } else if (allApproved) {
              p.data.approval_status = 'approved';
              console.log('Calculated approval_status as approved from instances');
            } else {
              p.data.approval_status = 'pending';
            }
            
            console.log('Calculated approval status from instances:', {
              approval_status: p.data.approval_status,
              instances: updatedInstances.map((inst: any) => ({ id: inst.id, status: inst.status }))
            });
          }
          
          console.log('Final updated task data:', {
            taskId: p.data?.id,
            approval_status: p.data.approval_status,
            approval_completed_at: p.data.approval_completed_at,
            status_id: p.data.status_id
          });
          
          // Immediately update the node data to reflect changes
          const node = p.node;
          const taskId = p.data?.id;
          
          if (node && p.api && taskId) {
            try {
              // Merge server response data with existing node data to ensure we have all fields
              // Server response may have additional fields (like updated_at) that we want to preserve
              const updatedData = { 
                ...p.data,
                ...(updatedTask || {}), // Merge any additional fields from server response
                approval_status: p.data.approval_status,
                approval_completed_at: p.data.approval_completed_at,
                status_id: p.data.status_id
              };
              
              console.log('Updating node with data:', {
                taskId,
                oldApprovalStatus: node.data?.approval_status,
                newApprovalStatus: updatedData.approval_status
              });
              
              // CRITICAL: Update the node data FIRST
              // This must happen before any refresh calls
              node.setData(updatedData);
              
              // Also update p.data directly to ensure cell renderer sees the change
              Object.assign(p.data, updatedData);
              
              // Verify the update took
              console.log('Node data after setData:', {
                nodeApprovalStatus: node.data?.approval_status,
                pDataApprovalStatus: p.data?.approval_status,
                expectedStatus: updatedData.approval_status
              });
              
              // Update IndexedDB cache with the updated task data
              // This ensures that on page refresh, the correct approval_status is loaded from cache
              try {
                console.log('Updating IndexedDB cache with updated task data', {
                  taskId,
                  approval_status: updatedData.approval_status,
                  approval_completed_at: updatedData.approval_completed_at,
                  status_id: updatedData.status_id
                });
                await TasksCache.updateTask(taskId.toString(), updatedData as any);
                console.log('IndexedDB cache updated successfully');
              } catch (err) {
                console.warn('Failed to update IndexedDB cache:', err);
              }
              
              // Force immediate cell refresh
              // Note: applyTransaction only works with client-side row model, we use infinite row model
              try {
                // Refresh cells - re-run renderers for updated fields
                p.api.refreshCells({ 
                  rowNodes: [node], 
                  force: true,
                });
                
                // Also redraw the row to ensure visual update
                if (p.api.redrawRows) {
                  p.api.redrawRows({ rowNodes: [node] });
                }
              } catch (err) {
                console.warn('Failed to refresh cells:', err);
              }
              
              // Double-check in next frame
              requestAnimationFrame(() => {
                try {
                  // Verify both node and p.data have correct data
                  if (node.data?.approval_status !== updatedData.approval_status) {
                    console.warn('Node data mismatch, re-applying update');
                    node.setData(updatedData);
                  }
                  if (p.data?.approval_status !== updatedData.approval_status) {
                    console.warn('p.data mismatch, re-applying update');
                    Object.assign(p.data, updatedData);
                  }
                  
                  // Force re-render again
                  p.api.refreshCells({ 
                    rowNodes: [node], 
                    force: true,
                  });
                  
                  if (p.api.redrawRows) {
                    p.api.redrawRows({ rowNodes: [node] });
                  }
                } catch (err) {
                  console.warn('Failed to refresh cells in RAF:', err);
                }
              });
            } catch (err) {
              console.warn('Failed to update node data:', err);
            }
          }
        }
        
        // Dispatch events and trigger refresh
        try {
          window.dispatchEvent(new CustomEvent('wh:approvalDecision:success', {
            detail: {
              taskId: p.data?.id,
              approvalId,
              decision,
            }
          }));
          window.dispatchEvent(new CustomEvent('wh:notify', {
            detail: { type: 'success', message: `Decision ${decision} recorded and actions executed.` }
          }));
          
          // DON'T refresh cache immediately - it will overwrite our update with stale server data
          // The local node update should persist. Only refresh after server has had time to process.
          // The approval action execution might take a moment, so we delay the refresh significantly
          
          console.log('Skipping immediate cache refresh to preserve local update');
          
          // Mark this task as recently updated to prevent stale data overwrites
          const taskId = p.data?.id;
          if (taskId) {
            (window as any).__recentlyApprovedTasks = (window as any).__recentlyApprovedTasks || new Set();
            (window as any).__recentlyApprovedTasks.add(taskId);
            
            // Remove from set after 10 seconds
            setTimeout(() => {
              (window as any).__recentlyApprovedTasks?.delete(taskId);
            }, 10000);
          }
          
          // Delay cache refresh significantly to give server time to fully process:
          // 1. Approval decision recording
          // 2. Approval action execution (status changes, etc.)
          // 3. Database commits
          // Increased delay to 5 seconds to ensure server has processed everything
          setTimeout(() => {
            if (p.api) {
              try {
                console.log('Refreshing cache after delay - server should have updated data now');
                p.api.refreshInfiniteCache();
              } catch (err) {
                console.warn('Failed to refresh infinite cache:', err);
              }
            }
          }, 5000); // Wait 5 seconds for server to fully process
          
          // Also trigger full grid refresh event after even longer delay as backup
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('wh:refreshTasks'));
          }, 7000);
        } catch {}
      } catch (e) {
        console.error('Approval decision failed', e);
        try {
          const msg = (e as any)?.response?.data?.message || 'Failed to record approval decision';
          window.dispatchEvent(new CustomEvent('wh:approvalDecision:error', {
            detail: { taskId: p.data?.id, approvalId, decision, error: e }
          }));
          window.dispatchEvent(new CustomEvent('wh:notify', {
            detail: { type: 'error', message: msg }
          }));
        } catch {}
      }
    };

    // If approval metadata hasn't loaded yet, still show a minimal badge so users know an approval is pending
    if (approvalVisible && !approval) {
      const isPending = !normalizedApprovalStatus || normalizedApprovalStatus === 'pending';
      const isApproved = normalizedApprovalStatus === 'approved';
      const isRejected = normalizedApprovalStatus === 'rejected';

      return (
        <Popover>
          <PopoverTrigger asChild>
            <div 
              className="flex flex-wrap items-center gap-2 px-2.5 py-1 rounded-full border border-blue-100 bg-blue-50 text-blue-700 text-xs font-medium cursor-pointer text-left max-w-[200px]"
              onClick={(e) => e.stopPropagation()}
            >
              {isPending ? (
                <svg className="animate-spin w-3.5 h-3.5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : isApproved ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              ) : isRejected ? (
                <XCircle className="w-3.5 h-3.5 text-red-600" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              )}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="leading-snug whitespace-normal break-words flex-1 min-w-0">{isPending ? 'Approval pending' : approvalStatusLabel}</span>
                {slaPill}
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent side="right" className="max-w-[360px] p-0">
            <div className="rounded-lg overflow-hidden shadow-sm border border-border/60">
              <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-3 py-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-white" />
                <div className="text-sm font-semibold">Approval required</div>
              </div>
              <div className="p-3 space-y-2 text-xs text-muted-foreground bg-card">
                <div className="text-sm text-foreground font-semibold flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  Awaiting approval details
                </div>
                <div className="text-muted-foreground">This task cannot start until the approval is completed.</div>
                <div className="text-[11px] text-muted-foreground">No approvers loaded yet.</div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    // Show approval if exists (badge with animation when pending)
    if (approvalVisible) {
      return (
        <Popover>
          <PopoverTrigger asChild>
            <div 
              className={`flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium max-w-[240px] cursor-pointer transition-all hover:opacity-90 ${
                approvalStatus === 'approved' 
                  ? 'bg-green-100 text-green-700 border border-green-200' 
                  : approvalStatus === 'rejected'
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {approvalStatus === 'approved' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                  <span className="leading-snug whitespace-normal break-words flex-1 min-w-0">Approved</span>
                </>
              ) : approvalStatus === 'rejected' ? (
                <>
                  <XCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                  <span className="leading-snug whitespace-normal break-words flex-1 min-w-0">Rejected</span>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <svg className="animate-spin w-3.5 h-3.5 text-blue-600 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="leading-snug whitespace-normal break-words flex-1 min-w-0">Approval pending</span>
                    {slaPill}
                  </div>
                </>
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent side="right" className="w-[520px] p-0 shadow-2xl border-0">
            <div className="rounded-lg overflow-hidden bg-white border border-gray-200">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4 border-b border-blue-800/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm mt-0.5">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-semibold text-white truncate leading-tight">
                        {approval?.name || 'Approval Required'}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${
                          normalizedApprovalStatus === 'approved' ? 'bg-green-500/20 text-green-100' :
                          normalizedApprovalStatus === 'rejected' ? 'bg-red-500/20 text-red-100' :
                          'bg-white/20 text-blue-100'
                        }`}>
                          {approvalStatusLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 bg-white">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    Approval Progress
                  </h3>
                  
                  {approverDetails && approverDetails.length > 0 ? (
                    <div className="space-y-2.5">
                      {approverDetails.map((detail) => {
                        const showStep = approverDetails.length > 1;
                        const isPending = !detail.status || detail.status === 'pending' || detail.status === 'not started';
                        const isApproved = detail.status === 'approved';
                        const isRejected = detail.status === 'rejected';
                        
                        return (
                          <div 
                            key={detail.id} 
                            className="rounded-lg border border-gray-200 bg-gray-50/50 p-3.5 transition-colors hover:bg-gray-50 hover:border-gray-300"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-sm font-medium text-gray-900">{detail.name}</span>
                                  {showStep && (
                                    <span className="text-xs font-medium text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                                      Step {detail.step}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                  <span className={detail.isRequired ? 'font-medium text-blue-600' : 'text-gray-500'}>
                                    {detail.isRequired ? 'Required' : 'Optional'}
                                  </span>
                                  {detail.respondedAt && dayjs(detail.respondedAt).isValid() && (
                                    <>
                                      <span className="text-gray-400">•</span>
                                      <span>{dayjs(detail.respondedAt).format('MMM D, h:mm A')}</span>
                                    </>
                                  )}
                                </div>
                                {detail.comment && (
                                  <div className="mt-2.5 p-2.5 bg-white border border-gray-200 rounded-md">
                                    <div className="text-xs font-medium text-gray-700 mb-1">Comment</div>
                                    <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap break-words">
                                      {detail.comment}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className={`flex items-center justify-center px-3 py-1 rounded-md text-xs font-medium flex-shrink-0 ${
                                isApproved ? 'bg-green-100 text-green-700' :
                                isRejected ? 'bg-red-100 text-red-700' :
                                detail.status === 'skipped' ? 'bg-amber-100 text-amber-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {detail.status === 'not started' ? 'Not Started' : 
                                 detail.status === 'pending' ? 'Pending' :
                                 detail.status ? detail.status.charAt(0).toUpperCase() + detail.status.slice(1) : 'Pending'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-sm text-gray-500">No approvers configured yet</div>
                    </div>
                  )}
                </div>
                
                {canAct && (
                  <div className="pt-4 mt-4 border-t border-gray-200 flex items-center gap-2.5">
                    <button
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 active:scale-[0.98] transition-all duration-150 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                      onClick={(e) => { e.stopPropagation(); submitDecision('approved'); }}
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] transition-all duration-150 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                      onClick={(e) => { e.stopPropagation(); submitDecision('rejected'); }}
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      );
    }
    
    // Show SLA if exists (and no approval)
    if (slaId) {
      return renderSlaPill(slaId);
    }
    
    return null;
  };

  // groupByStatus can be toggled later if we add grouping by status

  const cols = ([
    {
      field: 'id',
      headerName: 'ID',
      width: 75,
      minWidth: 70,
      maxWidth: 85,
      sortable: true,
      filter: 'agNumberColumnFilter',
      cellClass: 'wh-id-cell',
      valueFormatter: (p: any) => (p?.value ?? ''),
      cellStyle: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        paddingRight: '4px',
      },
      suppressHeaderMenuButton: false,
      cellRenderer: (p: any) => {
        const id = p?.value;
        const taskId = Number(p?.data?.id);
        const hasValidId = Number.isFinite(taskId);
        const api = p?.api;
        const node = p?.node;
        const isSelected = node?.isSelected?.() ?? false;
        
        if (!hasValidId) {
          return (
            <div className="flex flex-col items-center justify-center gap-2 h-full w-full">
              <span className="flex items-center justify-center px-1.5 py-0.5 rounded-md bg-muted/60 border border-border text-[11px] font-mono text-muted-foreground">
                {id ?? ''}
              </span>
              <div className="flex items-center justify-center w-6 h-6">
                <div className="w-5 h-5 rounded-full border-2 border-muted bg-background opacity-50" />
              </div>
            </div>
          );
        }
        
        return (
          <div className="flex flex-col items-center justify-center gap-2 h-full w-full">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center px-1.5 py-0.5 rounded-md bg-muted/60 border border-border text-[11px] font-mono text-muted-foreground hover:bg-muted/80 cursor-pointer transition-colors"
                  aria-label="Task actions"
                >
                  {id ?? ''}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="right" sideOffset={4} className="w-44">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onLogTask?.(taskId); }}>
                  Log
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDeleteTask?.(taskId); }}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Custom circular checkbox - prevents row click */}
            <div 
              className="flex items-center justify-center w-6 h-6 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (node) {
                  node.setSelected(!isSelected);
                  requestAnimationFrame(() => {
                    api?.refreshCells?.({ rowNodes: [node], force: true });
                  });
                }
              }}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                isSelected 
                  ? 'bg-primary border-primary' 
                  : 'bg-background border-border hover:border-primary/50'
              }`}>
                {isSelected && (
                  <div className="w-2.5 h-2.5 rounded-full bg-white dark:bg-background" />
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      field: 'name',
      headerName: 'Name',
      flex: 3.8,
      filter: false,
      cellRenderer: (p: any) => {
        // Loading placeholder when row data isn't ready (infinite row model)
        if (!p.data) {
          return (
            <div className="flex flex-col gap-2 py-2 min-w-0">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-muted animate-pulse" />
                <div className="h-4 w-[40%] bg-muted animate-pulse rounded" />
              </div>
              <div className="h-3 w-[60%] bg-muted/70 animate-pulse rounded ml-8" />
            </div>
          );
        }
        const name = p.data?.name || '';
        const description = p.data?.description || '';
        const cat = categoryMap?.[Number(p.data?.category_id)];
        
        // Skip heavy approval progress calculations during render for performance
        
        // Get tags for this task
        const taskId = Number(p.data?.id);
        const latestComment = density === 'compact'
          ? ''
          : ((latestNoteByTaskId.get(taskId)?.text || '') as string).trim();
        const taskTagIds = (taskTagsMap && taskTagsMap.get(taskId)) || [];
        const taskTagsData = (taskTagIds || [])
          .map((tagId: number) => {
            const tag = tagMap?.[tagId];
            return tag && tag.name ? { ...tag, id: tagId } : null;
          })
          .filter((tag: any) => tag !== null);
        // Show all tags (they will wrap naturally; limit display work)

        const node = (
          <div className="flex flex-col gap-1.5 py-1.5 min-w-0">
            {/* Name row with category icon */}
            <div className="flex items-center gap-2.5 min-w-0">
              <CategoryIconSmall iconClass={cat?.icon} color={cat?.color} />
              <div className="font-semibold text-[15px] leading-[1.4] cursor-default text-foreground min-w-0 flex-1 truncate tracking-[0.01em]">{name}</div>
            </div>
            {/* Tags row - separate line below name for better visual separation */}
            {(taskTagsData && taskTagsData.length > 0) && (
              <div className="flex items-center gap-1.5 flex-wrap pl-[34px] min-w-0">
                {taskTagsData.map((tag: any, idx: number) => {
                  if (!tag || !tag.name) return null;
                  const bgColor = tag.color || '#6B7280';
                  const textColor = getContrastTextColor(bgColor);
                  return (
                    <div
                      key={tag.id || `tag-${idx}`}
                      className={`inline-flex items-center ${tagDisplayMode === 'icon' ? 'gap-0 px-1.5' : 'gap-1.5 px-2'} py-0.5 rounded-md text-[11px] font-medium leading-none flex-shrink-0 shadow-sm`}
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
              </div>
            )}
            {showDescriptions && description && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="wh-task-desc mt-0.5 pl-[34px] text-[12px] leading-relaxed text-muted-foreground/75"
                      style={{
                        whiteSpace: 'normal',
                        display: '-webkit-box',
                        WebkitLineClamp: density === 'spacious' ? 3 : 1,
                        WebkitBoxOrient: 'vertical' as any,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        opacity: 0.7,
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
            {density !== 'compact' && latestComment && (
              <div className="flex items-start gap-1.5 pl-[34px] text-[12px] text-muted-foreground">
                <MessageSquare className="w-3.5 h-3.5 mt-[1px]" />
                <span
                  className="leading-relaxed min-w-0"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical' as any,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {latestComment}
                </span>
              </div>
            )}
          </div>
        );
        const shouldShowHoverDescription = !!description && (density === 'compact' || density === 'comfortable');
        if (shouldShowHoverDescription) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {node}
                </TooltipTrigger>
                <TooltipContent 
                  side="bottom" 
                  align="start"
                  sideOffset={8}
                  collisionPadding={{ left: 300, right: 16, top: 16, bottom: 16 }}
                  avoidCollisions={true}
                  className="max-w-[520px] whitespace-pre-wrap text-base leading-relaxed z-[100]"
                  style={{ 
                    maxWidth: 'min(520px, calc(100vw - 340px))'
                  }}
                >
                  {description}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        return node;
      },
      minWidth: 320,
    },
    {
      colId: 'config',
      headerName: 'Config',
      width: 140,
      minWidth: 120,
      maxWidth: 180,
      filter: false,
      sortable: false,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      cellRenderer: (p: any) => {
        const config = renderApprovalOrSLA(p);
        if (!config) {
          return (
            <div className="flex items-center justify-center h-full w-full py-2">
            </div>
          );
        }
        return (
          <div className="flex items-center justify-center h-full w-full py-1">
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
        if (!p.data) {
          return (
            <div className="flex items-center h-full py-2">
              <div className="h-5 w-24 bg-muted animate-pulse rounded" />
            </div>
          );
        }
        const row = p.data;
        if (!statusesLoaded || !row) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        const meta: any = statusMap[p.value as number];
        if (!meta) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        const approvalRequired = !!row.approval_id;
        const normalizedApprovalStatus = String(row.approval_status || '').toLowerCase().trim();
        const approvalPending = approvalRequired && normalizedApprovalStatus === 'pending';
        const approvalRejected = approvalRequired && normalizedApprovalStatus === 'rejected';
        const allowedNext = getAllowedNextStatuses(row);
        const node = (approvalPending || approvalRejected) ? (
          <div
            className="flex items-center h-full py-2 opacity-50 cursor-not-allowed"
            title={approvalRejected ? "Status cannot be changed after approval rejection" : "Awaiting approval before starting"}
            style={{ pointerEvents: 'none' }}
          >
            <StatusCell
              value={p.value}
              statusMap={statusMap}
              getStatusIcon={getStatusIcon}
              allowedNext={[]}
              onChange={async () => false}
              taskId={row?.id}
            />
          </div>
        ) : (
          <StatusCell
            value={p.value}
            statusMap={statusMap}
            getStatusIcon={getStatusIcon}
            allowedNext={allowedNext}
            onChange={(to: number) => handleChangeStatus(row, to)}
            taskId={row?.id}
          />
        );
        return node;
      },
      onCellClicked: (params: any) => {
        // Prevent row click event from firing when clicking anywhere in the status column
        if (params.event) {
          params.event.stopPropagation();
          params.event.preventDefault();
        }
      },
      width: 200,
      minWidth: 180,
      maxWidth: 280,
    },
    {
      field: 'priority_id',
      headerName: 'Priority',
      sortable: true,
      filter: 'agSetColumnFilter',
      suppressHeaderMenuButton: true,
      suppressHeaderFilterButton: true,
      // Allow the priority pill to render without AG Grid's default ellipsis clipping
      cellStyle: {
        overflow: 'visible',
        textOverflow: 'clip',
        whiteSpace: 'nowrap',
      },
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
        if (!p.data) {
          return (
            <div className="flex items-center h-full py-1">
              <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
            </div>
          );
        }
        if (!prioritiesLoaded || p.value == null) return (<div className="flex items-center h-full py-1"><span className="opacity-0">.</span></div>);
        const meta: any = priorityMap[p.value as number];
        if (!meta) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        const name = meta.name;
        const palette = getPriorityPalette(Number(p.value), name, meta?.color);
        const isHighPriority = name.toLowerCase().includes('high');
        const pill = (
          <div className="inline-flex items-center h-full py-1.5 group/priority">
            <span
              className={`inline-flex items-center gap-2 rounded-[12px] px-3 py-1 text-[13px] font-medium leading-none whitespace-nowrap transition-all duration-200 hover:shadow-md ${
                isHighPriority ? 'animate-pulse-subtle' : ''
              }`}
              style={{ background: palette.bg, color: palette.text }}
            >
              <Flag className={`h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 group-hover/priority:scale-110`} style={{ color: palette.text, opacity: 0.9 }} />
              <span>{name}</span>
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
      filter: 'agSetColumnFilter',
      filterValueGetter: (p: any) => {
        const ids = p.data?.user_ids;
        if (!Array.isArray(ids)) return null;
        return ids
          .map((id: any) => Number(id))
          .filter((n: number) => Number.isFinite(n));
      },
      filterParams: {
        values: (params: any) => {
          const ids = Object.keys(userMap || {})
            .map((k: any) => Number(k))
            .filter((n: number) => Number.isFinite(n));
          params.success(ids);
        },
        suppressMiniFilter: false,
        valueFormatter: (p: any) => {
          const user = userMap[p.value as number];
          return getUserDisplayName(user) || user?.name || `#${p.value}`;
        },
      },
      cellRenderer: (p: any) => {
        if (!p.data) {
          return (
            <div className="flex items-center h-full py-1 gap-2">
              <div className="flex items-center -space-x-1.5">
                <div className="h-6 w-6 rounded-full bg-muted animate-pulse border" />
                <div className="h-6 w-6 rounded-full bg-muted animate-pulse border" />
                <div className="h-6 w-6 rounded-full bg-muted animate-pulse border" />
              </div>
            </div>
          );
        }
        if (!usersLoaded) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        const userIds = p.data?.user_ids;
        if (userIds == null) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        const users = getUsersFromIds(userIds, userMap) || [];
        if (users.length === 0) return (
          <div className="flex items-center h-full py-1">
          </div>
        );
        const displayUsers = users.slice(0, 3);
        const remainingCount = users.length - displayUsers.length;
        const node = (
          <div className="flex items-center h-full py-1 gap-2">
            <div className="flex items-center -space-x-1.5">
              {displayUsers.map((user: any) => (
                <HoverPopover key={user.id} content={(
                  <div className="flex flex-col items-center gap-3">
                  <Avatar
                    className="h-16 w-16 border-2 border-background"
                  >
                    <UserInitial user={user} />
                  </Avatar>
                    <span className="text-base font-medium text-popover-foreground text-center">{getCachedUserName(user)}</span>
                  </div>
                )}>
                  <Avatar
                    className="h-6 w-6 border transition-colors cursor-pointer"
                    title={getCachedUserName(user)}
                    style={{ borderColor: '#e5e7eb' }}
                  >
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
        return node;
      },
      minWidth: 140,
      maxWidth: 200,
    },
    {
      field: 'tag_ids',
      headerName: 'Tags (filter)',
      hide: true,
      filter: 'agSetColumnFilter',
      filterValueGetter: (p: any) => {
        const taskId = Number(p.data?.id);
        if (!Number.isFinite(taskId)) return [];
        const ids = (taskTagsMap && taskTagsMap.get(taskId)) || [];
        return (ids || []).map((id: any) => Number(id)).filter((n: number) => Number.isFinite(n));
      },
      filterParams: {
        values: (params: any) => {
          const ids = Object.keys(tagMap || {})
            .map((k: any) => Number(k))
            .filter((n: number) => Number.isFinite(n));
          params.success(ids);
        },
        suppressMiniFilter: false,
        valueFormatter: (p: any) => {
          const tag = tagMap?.[p.value as number];
          return tag?.name || `#${p.value}`;
        },
      },
      width: 120,
      minWidth: 100,
      maxWidth: 140,
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
        if (!p.data) {
          return (
            <div className="flex items-center h-full py-1">
              <div className="h-3 w-24 bg-muted animate-pulse rounded" />
            </div>
          );
        }
        if (!spotsLoaded) return (<div className="flex items-center h-full py-1"><span className="opacity-0">.</span></div>);
        if (p.value == null) return (<div className="flex items-center h-full py-2"><span className="text-[12px] text-muted-foreground"></span></div>);
        const meta: any = spotMap[p.value as number];
        if (!meta) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        const name = meta.name;
        const tag = (
          <div className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className="truncate max-w-[160px]">{name}</span>
          </div>
        );
        const node = (
          <div className="flex items-center h-full py-1">{tag}</div>
        );
        return node;
      },
      flex: 2,
      minWidth: 180,
    },
    {
      field: 'updated_at',
      colId: 'created_at',
      headerName: 'Last modified',
      sortable: true,
      filter: false,
      // Explicitly use valueGetter to ensure we read from the correct field and avoid conflicts with custom fields
      valueGetter: (p: any) => {
        // Always read from updated_at field (last modified), never from custom fields
        return p.data?.updated_at || p.data?.created_at;
      },
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
        if (!p.data) {
          return (
            <div className="flex items-center h-full py-2">
              <div className="h-3 w-20 bg-muted animate-pulse rounded" />
            </div>
          );
        }
        // Explicitly read from updated_at field (last modified), not from p.value which might be corrupted
        const updatedAt = p.data?.updated_at || p.data?.created_at;
        if (!updatedAt) {
          return (
            <div className="flex items-center h-full py-2">
              <span className="text-[12px] text-muted-foreground">—</span>
            </div>
          );
        }
        const d = dayjs(updatedAt);
        const inner = (
          <div className="flex items-center h-full py-2">
            <span className="inline-flex items-center text-muted-foreground">
              <span className="text-[12px]">{d.fromNow()}</span>
            </span>
          </div>
        );
        const node = (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>{inner}</TooltipTrigger>
              <TooltipContent side="top">{d.format('MMM D, YYYY, h:mm A')} • {d.fromNow()}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
        return node;
      },
      width: 120,
      minWidth: 100,
      maxWidth: 160,
    },
  ]);

  // Helper functions for custom field columns
  const createCustomFieldValueGetter = (fieldId: number, field: any, taskCustomFieldValueMap: any) => {
    return (p: any) => {
      const taskId = Number(p.data?.id);
      if (!Number.isFinite(taskId) || !taskCustomFieldValueMap) return null;
      const key = `${taskId}:${fieldId}`;
      const row = taskCustomFieldValueMap.get(key);
      if (!row) return null;
      const fieldType = String(row.type || row.field_type || field.type || '').toLowerCase();
      if (fieldType === 'number' || fieldType === 'numeric') {
        if (row.value_numeric != null) return row.value_numeric;
        if (row.value != null) return Number(row.value);
      }
      if (fieldType === 'date' || fieldType === 'datetime') {
        if (row.value_date != null) return row.value_date;
        if (row.value != null) return row.value;
      }
      if (fieldType === 'json') {
        if (row.value_json != null) return row.value_json;
        if (row.value != null) return row.value;
      }
      if (row.value_numeric != null) return row.value_numeric;
      if (row.value_date != null) return row.value_date;
      if (row.value_json != null) return row.value_json;
      if (row.value_text != null) return row.value_text;
      if (row.value != null) return row.value;
      return null;
    };
  };

  const createCustomFieldCellRenderer = () => {
    return (p: any) => {
      const v = p.value;
      if (v === null || v === undefined || v === '') {
        return (
          <div className="flex items-center h-full py-2">
            <span className="text-[12px] text-muted-foreground">—</span>
          </div>
        );
      }
      if (typeof v === 'number') {
        return (
          <div className="flex items-center h-full py-2">
            <span className="text-[12px] truncate max-w-full">{v.toLocaleString()}</span>
          </div>
        );
      }
      return (
        <div className="flex items-center h-full py-2">
          <span className="text-[12px] truncate max-w-full">{String(v)}</span>
        </div>
      );
    };
  };

  // Append dynamic custom-field columns (per-workspace)
  const customFieldCols: any[] = [];
  const processedFieldIds = new Set<number>();
  
  // First, process fields from workspaceCustomFields (preferred source with category info)
  if (Array.isArray(workspaceCustomFields) && workspaceCustomFields.length > 0) {
    for (const cf of workspaceCustomFields as any[]) {
      const fieldId = Number((cf as any).fieldId);
      const field = (cf as any).field || {};
      const categoriesForField = (cf as any).categories || [];
      if (!Number.isFinite(fieldId)) continue;

      const colKey = `cf_${fieldId}`;
      // Only render if this custom field is selected in visibleColumns
      if (!isVisible(colKey)) continue;

      processedFieldIds.add(fieldId);

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
        minWidth: 160,
        flex: 2,
        valueGetter: createCustomFieldValueGetter(fieldId, field, taskCustomFieldValueMap),
        cellRenderer: createCustomFieldCellRenderer(),
      });
    }
  }
  
  // Also check taskCustomFieldValueMap for fields with values that might not be in workspaceCustomFields
  // This ensures columns persist even when workspaceCustomFields is temporarily empty
  // BUT only create columns for fields that are actually assigned to categories in the current workspace
  if (taskCustomFieldValueMap && taskCustomFieldValueMap.size > 0 && Array.isArray(customFields) && customFields.length > 0 && workspaceCustomFields) {
    // Build a set of field IDs that are actually assigned to workspace categories
    const allowedFieldIds = new Set<number>();
    for (const cf of workspaceCustomFields as any[]) {
      const fieldId = Number((cf as any).fieldId);
      if (Number.isFinite(fieldId)) {
        allowedFieldIds.add(fieldId);
      }
    }
    
    const fieldIdsWithValues = new Set<number>();
    // Extract all field IDs that have values
    for (const [key] of taskCustomFieldValueMap) {
      const parts = String(key).split(':');
      if (parts.length === 2) {
        const fieldId = Number(parts[1]);
        if (Number.isFinite(fieldId)) {
          fieldIdsWithValues.add(fieldId);
        }
      }
    }
    
    // Create columns for fields with values that are visible but not yet processed
    // AND that are actually assigned to workspace categories
    for (const fieldId of fieldIdsWithValues) {
      if (processedFieldIds.has(fieldId)) continue; // Already processed
      
      // Only create column if field is assigned to a category in this workspace
      if (!allowedFieldIds.has(fieldId)) continue; // Skip fields not assigned to workspace categories
      
      const colKey = `cf_${fieldId}`;
      // Only render if this custom field is selected in visibleColumns
      if (!isVisible(colKey)) continue;
      
      // Find field metadata
      const field = (customFields as any[]).find((f: any) => Number(f.id) === fieldId);
      if (!field) continue; // Skip if we can't find field metadata
      
      // Use field name only (category info not available in fallback case)
      const headerName = String(field.name || `Field #${fieldId}`);
      
      customFieldCols.push({
        field: colKey,
        colId: colKey,
        headerName,
        sortable: false,
        filter: false,
        minWidth: 160,
        flex: 2,
        valueGetter: createCustomFieldValueGetter(fieldId, field, taskCustomFieldValueMap),
        cellRenderer: createCustomFieldCellRenderer(),
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

  // Apply compact styling to secondary columns + visibility handling
  for (const col of cols as any[]) {
    const id = (col.colId as string) || (col.field as string) || '';
    if (id && !['name', 'priority_id', 'user_ids'].includes(id)) {
      col.cellClass = appendCellClass(col.cellClass, 'wh-compact-col');
    }
    if (id === 'name') continue;
    // Skip if grouping logic already forced hide
    if (col.rowGroup && col.hide === true) continue;
    if (!isVisible(id)) {
      col.hide = true;
    }
  }

  return cols;
}


