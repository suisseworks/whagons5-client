import { actionsApi } from '@/api/whagonsActionsApi';
import { genericCaches } from '@/store/genericSlices';
import { TasksCache } from '@/store/indexedDB/TasksCache';
import { syncReduxForTable } from '@/store/indexedDB/CacheRegistry';

export type ApprovalDecision = 'approved' | 'rejected';

export interface DecideApprovalPayload {
  task_id: number;
  approval_id?: number | null;
  approver_user_id?: number | null;
  decision: ApprovalDecision;
  comment?: string | null;
  task_status_id?: number | null;
}

type DecideApprovalResponseData = {
  task?: any;
  instances?: any[];
  approval_status?: string;
  approval_completed_at?: string | null;
};

/**
 * Record an approval decision (server-side action endpoint) and eagerly sync local caches.
 *
 * Why this exists:
 * - `/approvals/decide` mutates multiple tables (instances, decisions, maybe tasks via actions).
 * - Generic slice CRUD thunks only cover `/task-approval-instances` etc.
 * - We still want immediate UI updates even if realtime isn't connected yet.
 */
export async function decideApprovalAndSync(payload: DecideApprovalPayload): Promise<DecideApprovalResponseData> {
  const resp = await actionsApi.post('/approvals/decide', payload);
  const data: DecideApprovalResponseData = resp?.data?.data ?? {};

  // 1) Update task approval instances in IndexedDB
  const instances = Array.isArray(data?.instances) ? data.instances : [];
  if (instances.length > 0) {
    // Note: GenericCache.update() is upsert-like (DB.put), so this works for inserts too.
    await Promise.all(
      instances
        .filter((r) => r && (r.id !== undefined && r.id !== null))
        .map((r) => genericCaches.taskApprovalInstances.update(r.id, r))
    );
    await syncReduxForTable('wh_task_approval_instances');
  }

  // 2) If server actions updated the task (status change, etc), update TasksCache too
  if (data?.task && (data.task.id !== undefined && data.task.id !== null)) {
    await TasksCache.updateTask(String(data.task.id), data.task);
    await syncReduxForTable('wh_tasks');
  }

  return data;
}

