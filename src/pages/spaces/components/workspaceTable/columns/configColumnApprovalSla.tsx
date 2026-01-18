/**
 * Config column definition: Approval and SLA badges
 */

import dayjs from 'dayjs';
import { CheckCircle2, Clock, XCircle, Check, X } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import api from '@/api/whagonsApi';
import { promptForComment } from '../columnUtils/promptForComment';
import { ColumnBuilderOptions } from './types';

function formatSlaDuration(seconds?: number | null) {
  const secs = Number(seconds);
  if (!Number.isFinite(secs)) return null;
  const totalMinutes = Math.floor(secs / 60);
  const hrs = Math.floor(totalMinutes / 60);
  const remMins = totalMinutes % 60;
  if (hrs > 0 && remMins > 0) return `${hrs}h ${remMins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${remMins}m`;
}

function renderSlaPill(slaId: any, slaMap: Record<number, any>) {
  const sla = slaMap?.[Number(slaId)];
  const responseLabel = formatSlaDuration(sla?.response_time);
  const resolutionLabel = formatSlaDuration(sla?.resolution_time);
  const priorityLabel = sla?.priority_id ? `Priority #${sla.priority_id}` : null;
  const pill = (
    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-opacity-10 flex-shrink-0 cursor-pointer"
      style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)' }}>
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
}

function buildApproverDetails(
  approvalId: number,
  taskId: number,
  taskApprovalInstances: any[],
  approvalApprovers: any[],
  userMap: Record<number, any>,
  getUserDisplayName: (user: any) => string
) {
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
    const instances = taskApprovalInstances
      .filter((inst: any) => Number(inst.task_id) === taskId)
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

  return approverDetails;
}

function renderApprovalOrSLA(p: any, opts: ColumnBuilderOptions) {
  const {
    categoryMap,
    approvalMap,
    taskApprovalInstances,
    approvalApprovers,
    userMap,
    getUserDisplayName,
    currentUserId,
    slaMap,
  } = opts;

  const row = p?.data || {};
  const approvalId = row?.approval_id;
  const approvalStatus = row?.approval_status;
  const categoryId = row?.category_id;
  const category = categoryId ? categoryMap[Number(categoryId)] : null;
  const slaId = row?.sla_id ?? category?.sla_id;
  
  const approval = approvalId ? approvalMap[approvalId] : null;
  const hasApproval = !!approvalId;
  const normalizedApprovalStatus = (approvalStatus ?? '').toString().toLowerCase();
  const approvalVisible = hasApproval && normalizedApprovalStatus !== 'not_triggered';
  const slaPill = slaId ? renderSlaPill(slaId, slaMap) : null;
  const approvalStatusLabel =
    normalizedApprovalStatus === 'approved' ? 'Approved' :
    normalizedApprovalStatus === 'rejected' ? 'Rejected' :
    normalizedApprovalStatus === 'cancelled' ? 'Cancelled' :
    normalizedApprovalStatus === 'pending' || normalizedApprovalStatus === '' ? 'Approval pending' :
    (normalizedApprovalStatus ? normalizedApprovalStatus.charAt(0).toUpperCase() + normalizedApprovalStatus.slice(1) : 'Approval pending');
  
  const taskRowId = Number(p.data?.id);
  const approverDetails = buildApproverDetails(
    approvalId,
    taskRowId,
    taskApprovalInstances,
    approvalApprovers,
    userMap,
    getUserDisplayName
  );

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
      await api.post('/approvals/decide', {
        task_id: p.data?.id,
        approval_id: approvalId,
        approver_user_id: approverUserIdToSend,
        decision,
        comment,
        task_status_id: p.data?.status_id,
      });
      if (p.data) {
        p.data.approval_status = decision;
        p.data.approval_completed_at = new Date().toISOString();
        try { p.api?.refreshCells({ force: true }); } catch {}
      }
      try {
        window.dispatchEvent(new CustomEvent('wh:approvalDecision:success', {
          detail: { taskId: p.data?.id, approvalId, decision }
        }));
        window.dispatchEvent(new CustomEvent('wh:notify', {
          detail: { type: 'success', message: `Decision ${decision} recorded.` }
        }));
      } catch {}
    } catch (e) {
      console.warn('approval decision failed', e);
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

  // If approval metadata hasn't loaded yet, show minimal badge
  if (approvalVisible && !approval) {
    const isPending = !normalizedApprovalStatus || normalizedApprovalStatus === 'pending';
    const isApproved = normalizedApprovalStatus === 'approved';
    const isRejected = normalizedApprovalStatus === 'rejected';

    return (
      <Popover>
        <PopoverTrigger asChild>
          <div className={`flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer text-left max-w-[200px] border transition-all hover:opacity-90 ${
            isApproved 
              ? 'bg-green-100 text-green-700 border-green-200' 
              : isRejected
              ? 'bg-red-100 text-red-700 border-red-200'
              : 'bg-blue-50 text-blue-700 border-blue-200'
          }`}>
            {isPending ? (
              <svg className="animate-spin w-3.5 h-3.5 text-blue-600 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : isApproved ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
            ) : isRejected ? (
              <XCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            )}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="leading-snug whitespace-normal break-words flex-1 min-w-0">{isPending ? 'Approval pending' : approvalStatusLabel}</span>
              {slaPill}
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent side="right" className="w-[400px] p-0 shadow-2xl border-0">
          <div className="rounded-lg overflow-hidden bg-white border border-gray-200">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4 border-b border-blue-800/20">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <div className="text-sm font-semibold text-white">Approval required</div>
              </div>
            </div>
            <div className="p-5 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-sm font-semibold text-gray-900">Awaiting approval details</span>
              </div>
              <p className="text-sm text-gray-600 mb-1">This task cannot start until the approval is completed.</p>
              <p className="text-xs text-gray-500">No approvers loaded yet.</p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Show approval if exists
  if (approvalVisible) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <div className={`flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium max-w-[240px] cursor-pointer transition-all hover:opacity-90 ${
            approvalStatus === 'approved' 
              ? 'bg-green-100 text-green-700 border border-green-200' 
              : approvalStatus === 'rejected'
              ? 'bg-red-100 text-red-700 border border-red-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
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
    return renderSlaPill(slaId, slaMap);
  }
  
  return null;
}

export function createConfigColumn(opts: ColumnBuilderOptions) {
  return {
    colId: 'config',
    headerName: 'Config',
    width: 140,
    minWidth: 120,
    maxWidth: 180,
    filter: false,
    sortable: false,
    cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
    cellRenderer: (p: any) => {
      const config = renderApprovalOrSLA(p, opts);
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
  };
}
