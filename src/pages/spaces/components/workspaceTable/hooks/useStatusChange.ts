/**
 * Hook for handling status changes
 */

import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store/store';
import { updateTaskAsync } from '@/store/reducers/tasksSlice';
import toast from 'react-hot-toast';
import { useLanguage } from '@/providers/LanguageProvider';

export function useStatusChange() {
  const { t } = useLanguage();
  const dispatch = useDispatch<AppDispatch>();

  return useMemo(() => {
    return async (task: any, toStatusId: number): Promise<boolean> => {
      if (!task || Number(task.status_id) === Number(toStatusId)) return true;
      const needsApproval = !!task?.approval_id;
      const normalizedApprovalStatus = String(task?.approval_status || '').toLowerCase().trim();
      const isPendingApproval = needsApproval && normalizedApprovalStatus === 'pending';
      const isRejectedApproval = needsApproval && normalizedApprovalStatus === 'rejected';
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
        return true;
      } catch (e: any) {
        console.warn('Status change failed', e);
        const errorMessage = e?.message || e?.response?.data?.message || t('errors.noPermissionChangeStatus', 'Failed to change task status');
        const isPermissionError = e?.response?.status === 403 || errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('unauthorized');
        if (isPermissionError) {
          toast.error(t('errors.noPermissionChangeStatus', 'You do not have permission to change task status.'), { duration: 5000 });
        } else {
          toast.error(errorMessage, { duration: 5000 });
        }
        return false;
      }
    };
  }, [dispatch]);
}
