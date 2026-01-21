/**
 * Hook for handling status changes
 */

import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store/store';
import { updateTaskAsync } from '@/store/reducers/tasksSlice';
import toast from 'react-hot-toast';
import { useLanguage } from '@/providers/LanguageProvider';
import { celebrateTaskCompletion } from '@/utils/confetti';
import { computeApprovalStatusForTask } from '../utils/approvalStatus';

type StatusMeta = { name: string; color?: string; icon?: string; action?: string; celebration_enabled?: boolean };
type Category = { id: number; celebration_effect?: string | null };

export function useStatusChange(
  statusMap?: Record<number, StatusMeta>, 
  getDoneStatusId?: () => number | undefined,
  categories?: Category[],
  taskApprovalInstances?: any[],
  approvalMap?: Record<number, any>
) {
  const { t } = useLanguage();
  const dispatch = useDispatch<AppDispatch>();

  return useMemo(() => {
    return async (task: any, toStatusId: number): Promise<boolean> => {
      if (!task || Number(task.status_id) === Number(toStatusId)) return true;
      const needsApproval = !!task?.approval_id;
      const derived = computeApprovalStatusForTask({
        taskId: Number(task?.id),
        approvalId: task?.approval_id,
        approval: task?.approval_id ? approvalMap?.[Number(task.approval_id)] : null,
        taskApprovalInstances,
      });
      const isPendingApproval = needsApproval && derived === 'pending';
      const isRejectedApproval = needsApproval && derived === 'rejected';
      if (isPendingApproval || isRejectedApproval) {
        try {
          window.dispatchEvent(new CustomEvent('wh:notify', {
            detail: {
              type: 'warning',
              title: 'Approval required',
              message: isRejectedApproval
                ? 'Status cannot be changed because the approval was rejected.'
                : 'This task cannot start until the approval is completed.',
            }
          }));
        } catch {
          console.warn('Task status change blocked: approval pending or rejected');
        }
        return false;
      }
      try {
        await dispatch(updateTaskAsync({ id: Number(task.id), updates: { status_id: Number(toStatusId) } })).unwrap();
        
        // Check if the new status is a completed/done status and trigger confetti
        let isDoneStatus = false;
        
        // First check: use getDoneStatusId if available (most reliable)
        if (getDoneStatusId) {
          const doneStatusId = getDoneStatusId();
          if (doneStatusId !== undefined && Number(toStatusId) === doneStatusId) {
            isDoneStatus = true;
          }
        }
        
        // Second check: use statusMap detection (fallback)
        if (!isDoneStatus && statusMap) {
          const newStatusMeta = statusMap[Number(toStatusId)];
          if (newStatusMeta) {
            const action = String(newStatusMeta.action || '').toUpperCase();
            const nameLower = String(newStatusMeta.name || '').toLowerCase();
            // Check for DONE, FINISHED actions, or name includes done/complete/finished
            isDoneStatus = action === 'DONE' || action === 'FINISHED' || 
                          nameLower.includes('done') || nameLower.includes('complete') || nameLower.includes('finished');
          }
        }
        
        // Check if celebration is enabled for this status
        const newStatusMeta = statusMap?.[Number(toStatusId)];
        const celebrationEnabled = newStatusMeta?.celebration_enabled !== false; // Default to true if not set
        
        console.log('[Confetti Debug] Status change:', {
          toStatusId,
          statusName: newStatusMeta?.name,
          action: newStatusMeta?.action,
          isDoneStatus,
          celebrationEnabled,
          doneStatusId: getDoneStatusId?.()
        });
        
        if (isDoneStatus && celebrationEnabled) {
          console.log('[Confetti Debug] Triggering confetti animation');
          // Get category celebration effect if available
          const taskCategory = categories?.find(cat => cat.id === task?.category_id);
          const categoryCelebrationEffect = taskCategory?.celebration_effect;
          celebrateTaskCompletion(categoryCelebrationEffect);
        }
        
        return true;
      } catch (e: any) {
        console.warn('Status change failed', e);
        // 403 errors are handled by API interceptor - don't show duplicate toast
        const status = e?.response?.status || e?.status;
        if (status === 403) {
          console.log('403 error caught, already handled by API interceptor');
          return false;
        }
        
        // Only show toast for non-403 errors
        const errorMessage = e?.message || e?.response?.data?.message || t('errors.noPermissionChangeStatus', 'Failed to change task status');
        toast.error(errorMessage, { duration: 5000 });
        return false;
      }
    };
  }, [dispatch, statusMap, getDoneStatusId, categories, taskApprovalInstances, approvalMap, t]);
}
