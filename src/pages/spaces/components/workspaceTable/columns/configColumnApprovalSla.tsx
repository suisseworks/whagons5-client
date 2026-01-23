/**
 * Config column definition: Approval and SLA badges
 */

import React, { useState } from 'react';
import dayjs from 'dayjs';
import { CheckCircle2, Clock, XCircle, X, Check, User, ChevronRight } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { actionsApi } from "@/api/whagonsActionsApi";
import { promptForComment } from '../columnUtils/promptForComment';
import { ColumnBuilderOptions } from './types';
import { computeApprovalStatusForTask } from '../utils/approvalStatus';

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
        <div className="flex flex-col">
          <div className="bg-purple-600 dark:bg-purple-700 text-white px-3 py-2 flex items-center gap-2 border-b">
            <Clock className="w-4 h-4" />
            <div className="text-sm font-semibold truncate">{sla.name || 'SLA'}</div>
          </div>
          <div className="p-3 space-y-2 text-[12px]">
            {responseLabel && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-muted-foreground">Response:</span>
                <Badge variant="secondary">{responseLabel}</Badge>
              </div>
            )}
            {resolutionLabel && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-muted-foreground">Resolution:</span>
                <Badge variant="secondary">{resolutionLabel}</Badge>
              </div>
            )}
            {priorityLabel && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-muted-foreground">Priority:</span>
                <Badge variant="outline">{priorityLabel}</Badge>
              </div>
            )}
            {sla.description ? (
              <div className="text-muted-foreground leading-relaxed whitespace-pre-wrap break-words pt-2">
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
  userMap: Record<string | number, any>,
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

// Component for approval popup with controlled state
function ApprovalPopup({
  approval,
  approvalStatus,
  normalizedApprovalStatus,
  approvalStatusLabel,
  approverDetails,
  canAct,
  slaPill,
  submitDecision,
}: {
  approval: any;
  approvalStatus: any;
  normalizedApprovalStatus: string;
  approvalStatusLabel: string;
  approverDetails: Array<any>;
  canAct: boolean;
  slaPill: React.ReactNode;
  submitDecision: (decision: 'approved' | 'rejected', onSuccess?: () => void) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const handleSubmitDecision = async (decision: 'approved' | 'rejected') => {
    await submitDecision(decision, () => {
      setOpen(false);
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
      <PopoverContent
        side="right"
        className="w-[420px] p-0 overflow-hidden rounded-lg bg-popover text-popover-foreground border border-border shadow-md"
      >
        <div className="flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border bg-muted/40">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">
                  {approval?.name || 'Approval Required'}
                </div>
                <div className="mt-1">
                  <Badge
                    variant="secondary"
                    className={[
                      'gap-1.5',
                      normalizedApprovalStatus === 'approved'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : normalizedApprovalStatus === 'rejected'
                          ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
                    ].join(' ')}
                  >
                    {normalizedApprovalStatus === 'approved' ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : normalizedApprovalStatus === 'rejected' ? (
                      <XCircle className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {approvalStatusLabel}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Approvers */}
          <div className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Approval Progress
            </div>

            {approverDetails && approverDetails.length > 0 ? (
              <div className="space-y-2">
                {approverDetails.map((detail) => {
                  const isApproved = detail.status === 'approved';
                  const isRejected = detail.status === 'rejected';
                  const isSkipped = detail.status === 'skipped';
                  const isPendingLike = !detail.status || detail.status === 'pending' || detail.status === 'not started';

                  const statusLabel =
                    detail.status === 'not started' ? 'Not started' :
                    detail.status === 'pending' ? 'Pending' :
                    detail.status ? detail.status.charAt(0).toUpperCase() + detail.status.slice(1) : 'Pending';

                  return (
                    <div
                      key={detail.id}
                      className="rounded-md border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background">
                          {isApproved ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          ) : isRejected ? (
                            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                          ) : isSkipped ? (
                            <ChevronRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <User className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium truncate">{detail.name}</div>
                            {approverDetails.length > 1 && (
                              <Badge variant="outline" className="h-5 text-[10px] px-1.5">
                                Step {detail.step}
                              </Badge>
                            )}
                            {detail.isRequired ? (
                              <Badge variant="secondary" className="h-5 text-[10px] px-1.5">
                                Required
                              </Badge>
                            ) : null}
                          </div>

                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span
                              className={
                                isApproved ? 'text-emerald-600 dark:text-emerald-400'
                                  : isRejected ? 'text-red-600 dark:text-red-400'
                                    : isSkipped ? 'text-amber-700 dark:text-amber-400'
                                      : isPendingLike ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'
                              }
                            >
                              {statusLabel}
                            </span>
                            {detail.respondedAt && dayjs(detail.respondedAt).isValid() ? (
                              <>
                                <span className="text-muted-foreground/60">•</span>
                                <span>{dayjs(detail.respondedAt).format('MMM D, h:mm A')}</span>
                              </>
                            ) : null}
                          </div>

                          {detail.comment ? (
                            <div className="mt-2 rounded-md border border-border bg-background/60 p-2 text-xs text-muted-foreground">
                              <div className="font-medium text-foreground mb-1">Comment</div>
                              <div className="whitespace-pre-wrap break-words leading-relaxed">{detail.comment}</div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                No approvers configured yet.
              </div>
            )}
          </div>

          {/* Actions */}
          {canAct && (
            <div className="p-4 pt-0">
              <div className="flex items-center gap-2">
                <Button
                  className="flex-1"
                  onClick={(e) => { e.stopPropagation(); handleSubmitDecision('approved'); }}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={(e) => { e.stopPropagation(); handleSubmitDecision('rejected'); }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
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
    statusMap,
    getDoneStatusId,
  } = opts;

  const row = p?.data || {};
  const approvalId = row?.approval_id;
  const categoryId = row?.category_id;
  const category = categoryId ? categoryMap[Number(categoryId)] : null;
  const slaId = row?.sla_id ?? category?.sla_id;
  
  const approval = approvalId ? approvalMap[approvalId] : null;
  const hasApproval = !!approvalId;
  const taskRowId = Number(p.data?.id);
  const derivedStatus = computeApprovalStatusForTask({
    taskId: taskRowId,
    approvalId,
    approval,
    taskApprovalInstances,
  });
  const approvalStatus = derivedStatus || 'pending';
  const normalizedApprovalStatus = approvalStatus.toString().toLowerCase();
  const approvalVisible = hasApproval;
  const slaPill = slaId ? renderSlaPill(slaId, slaMap) : null;
  const approvalStatusLabel =
    normalizedApprovalStatus === 'approved' ? 'Approved' :
    normalizedApprovalStatus === 'rejected' ? 'Rejected' :
    normalizedApprovalStatus === 'cancelled' ? 'Cancelled' :
    normalizedApprovalStatus === 'pending' || normalizedApprovalStatus === '' ? 'Approval pending' :
    (normalizedApprovalStatus ? normalizedApprovalStatus.charAt(0).toUpperCase() + normalizedApprovalStatus.slice(1) : 'Approval pending');
  
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

  const submitDecision = async (decision: 'approved' | 'rejected', onSuccess?: () => void) => {
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
      await actionsApi.post('/approvals/decide', {
        task_id: p.data?.id,
        approval_id: approvalId,
        approver_user_id: approverUserIdToSend,
        decision,
        comment,
        task_status_id: p.data?.status_id,
      });
      try { p.api?.refreshCells({ force: true }); } catch {}
      try {
        window.dispatchEvent(new CustomEvent('wh:approvalDecision:success', {
          detail: { taskId: p.data?.id, approvalId, decision }
        }));
        window.dispatchEvent(new CustomEvent('wh:notify', {
          detail: { type: 'success', message: `Decision ${decision} recorded.` }
        }));
      } catch {}
      // Call onSuccess callback to close popover
      onSuccess?.();
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
        <PopoverContent
          side="right"
          className="w-[340px] p-0 overflow-hidden rounded-lg bg-popover text-popover-foreground border border-border shadow-md"
        >
          <div className="flex flex-col">
            <div className="p-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">Approval Required</div>
                  <Badge
                    variant="secondary"
                    className="mt-1 w-fit"
                  >
                    Loading…
                  </Badge>
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">Loading approver details…</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Task blocked until approved</div>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Show approval if exists
  if (approvalVisible) {
    return (
      <ApprovalPopup
        approval={approval}
        approvalStatus={approvalStatus}
        normalizedApprovalStatus={normalizedApprovalStatus}
        approvalStatusLabel={approvalStatusLabel}
        approverDetails={approverDetails}
        canAct={canAct}
        slaPill={slaPill}
        submitDecision={submitDecision}
      />
    );
  }
  
  // Show SLA if exists (and no approval)
  if (slaId) {
    return renderSlaPill(slaId, slaMap);
  }
  
  return null;
}

export function createConfigColumn(opts: ColumnBuilderOptions) {
  const t = opts.t || ((key: string, fallback?: string) => fallback || key);
  
  return {
    colId: 'config',
    headerName: t('workspace.columns.config', 'Config'),
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
    onCellClicked: (params: any) => {
      // Prevent row click event from firing when clicking anywhere in the config column
      // The PopoverTrigger components inside will handle their own clicks
      if (params.event) {
        params.event.stopPropagation();
        // Don't preventDefault - allow PopoverTrigger to handle clicks
      }
    },
  };
}
