export type DerivedApprovalStatus = 'pending' | 'approved' | 'rejected';

function normStatus(s: any): string {
  return (s ?? '').toString().toLowerCase().trim();
}

/**
 * Pivot-only approval computation.
 *
 * - If a task has an approval configured (approvalId truthy) we consider it at least "pending".
 * - Instances drive the status:
 *   - any required instance rejected => rejected
 *   - otherwise compute completion based on approval config (defaults to "all required")
 */
export function computeApprovalStatusForTask(opts: {
  taskId: number;
  approvalId?: number | null;
  approval?: any;
  taskApprovalInstances?: any[];
}): DerivedApprovalStatus | null {
  const { taskId, approvalId, approval, taskApprovalInstances } = opts;
  if (!approvalId) return null;

  const instances = (taskApprovalInstances || []).filter(
    (i: any) => Number(i?.task_id) === Number(taskId)
  );

  // If we have an approval_id but no instances yet, treat as pending (not started).
  if (instances.length === 0) return 'pending';

  const required = instances.filter((i: any) => i?.is_required !== false);
  const requiredSet = required.length > 0 ? required : instances;

  const hasReject = requiredSet.some((i: any) => normStatus(i?.status) === 'rejected');
  if (hasReject) return 'rejected';

  const approvedCount = requiredSet.filter((i: any) => normStatus(i?.status) === 'approved').length;
  const totalRequired = requiredSet.length;

  const approvalType = normStatus(approval?.approval_type || 'all');
  const requireAll = approval?.require_all !== false;
  const minimumApprovals = Number.isFinite(Number(approval?.minimum_approvals))
    ? Number(approval.minimum_approvals)
    : totalRequired;

  const isComplete = (() => {
    if (totalRequired <= 0) return false;
    switch (approvalType) {
      case 'single':
        return approvedCount >= 1;
      case 'majority':
        return approvedCount >= Math.max(1, Math.ceil(totalRequired / 2));
      case 'sequential':
        return approvedCount >= totalRequired;
      case 'all':
      default:
        return requireAll ? approvedCount >= totalRequired : approvedCount >= Math.max(1, minimumApprovals);
    }
  })();

  return isComplete ? 'approved' : 'pending';
}

