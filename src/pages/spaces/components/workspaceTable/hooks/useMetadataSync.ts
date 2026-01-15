/**
 * Hook for syncing metadata and refreshing grid cells
 */

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store/store';
import { genericActions } from '@/store/genericSlices';

export function useMetadataSync(opts: {
  gridRef: React.RefObject<any>;
  reduxState: any;
  metadataLoadedFlags: any;
  taskTags: any[];
  tagMap: Record<number, any>;
  taskNotes: any[];
  taskAttachments: any[];
  approvalApprovers: any[];
  stableTaskApprovalInstances: any[];
  approvalMap: Record<number, any>;
  priorityMap: Record<number, any>;
  spotMap: Record<number, any>;
  taskCustomFieldValues: any[];
}) {
  const dispatch = useDispatch<AppDispatch>();
  const {
    gridRef,
    reduxState,
    metadataLoadedFlags,
    taskTags,
    tagMap,
    taskNotes,
    taskAttachments,
    approvalApprovers,
    stableTaskApprovalInstances,
    approvalMap,
    priorityMap,
    spotMap,
    taskCustomFieldValues,
  } = opts;

  // Ensure user metadata is hydrated so owner avatars reflect configured colors
  useEffect(() => {
    dispatch((genericActions as any).users.getFromIndexedDB());
    dispatch((genericActions as any).users.fetchFromAPI?.());
  }, [dispatch]);

  // Load taskTags, tags, notes, attachments, custom field values on mount
  useEffect(() => {
    dispatch(genericActions.taskTags.getFromIndexedDB());
    dispatch(genericActions.tags.getFromIndexedDB());
    dispatch(genericActions.taskNotes.getFromIndexedDB());
    dispatch(genericActions.taskAttachments.getFromIndexedDB());
    dispatch(genericActions.approvalApprovers.getFromIndexedDB());
    dispatch(genericActions.taskApprovalInstances.getFromIndexedDB());
    dispatch(genericActions.taskCustomFieldValues.getFromIndexedDB());
    dispatch(genericActions.taskCustomFieldValues.fetchFromAPI());
  }, [dispatch]);

  // Keep grid cells in sync with hydrated metadata (batched to avoid many small effects)
  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;

    const cols = new Set<string>();
    cols.add('status_id');

    if ((taskTags && taskTags.length > 0) || (tagMap && Object.keys(tagMap).length > 0)) {
      cols.add('name');
    }

    if (
      (taskNotes && taskNotes.length > 0) ||
      (taskAttachments && taskAttachments.length > 0) ||
      (approvalApprovers && approvalApprovers.length > 0) ||
      (stableTaskApprovalInstances && stableTaskApprovalInstances.length > 0) ||
      (approvalMap && Object.keys(approvalMap).length > 0)
    ) {
      cols.add('config');
      cols.add('notes');
    }

    if (metadataLoadedFlags.usersLoaded) cols.add('user_ids');
    if (priorityMap && Object.keys(priorityMap).length > 0) cols.add('priority_id');
    if (spotMap && Object.keys(spotMap).length > 0) cols.add('spot_id');

    if (taskCustomFieldValues && taskCustomFieldValues.length > 0) {
      const allColumns = api.getAllColumns?.() || [];
      for (const col of allColumns) {
        const id = col?.getColId?.();
        if (typeof id === 'string' && id.startsWith('cf_')) cols.add(id);
      }
    }

    if (cols.size === 0) return;

    const schedule = (cb: () => void) => {
      try {
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(cb);
        else setTimeout(cb, 0);
      } catch {
        setTimeout(cb, 0);
      }
    };

    schedule(() => {
      try {
        api.refreshCells({ columns: Array.from(cols), force: true, suppressFlash: true });
      } catch {
        // ignore
      }
    });
  }, [
    gridRef,
    taskTags,
    tagMap,
    taskNotes,
    taskAttachments,
    approvalMap,
    approvalApprovers,
    stableTaskApprovalInstances,
    metadataLoadedFlags.usersLoaded,
    priorityMap,
    spotMap,
    taskCustomFieldValues,
  ]);
}
