/**
 * Hook for building column definitions
 */

import { useMemo } from 'react';
import { buildWorkspaceColumns } from '../columns/index';
import { ColumnBuilderOptions } from '../columns/types';

export function useColumnDefs(opts: ColumnBuilderOptions & {
  getStatusIcon: (iconName?: string) => any;
  getAllowedNextStatuses: (task: any) => number[];
  handleChangeStatus: (task: any, toStatusId: number) => Promise<boolean>;
  getDoneStatusId: () => number | undefined;
  useClientSide: boolean;
  groupBy: 'none' | 'spot_id' | 'status_id' | 'priority_id';
  rowDensity: 'compact' | 'comfortable' | 'spacious';
  handleDeleteTask: (id: number) => void;
}) {
  return useMemo(() => buildWorkspaceColumns(opts), [
    opts.statusMap,
    opts.priorityMap,
    opts.spotMap,
    opts.userMap,
    opts.tagMap,
    opts.taskTags,
    opts.getStatusIcon,
    opts.formatDueDate,
    opts.getAllowedNextStatuses,
    opts.handleChangeStatus,
    opts.statusesLoaded,
    opts.prioritiesLoaded,
    opts.spotsLoaded,
    opts.usersLoaded,
    opts.filteredPriorities,
    opts.getUsersFromIds,
    opts.useClientSide,
    opts.groupBy,
    opts.categoryMap,
    opts.rowDensity,
    opts.tagDisplayMode,
    opts.approvalMap,
    opts.approvalApprovers,
    opts.taskApprovalInstances,
    opts.currentUserId,
    opts.slaMap,
    opts.slaMap,
    opts.visibleColumns,
    opts.workspaceCustomFields,
    opts.taskCustomFieldValueMap,
    opts.customFields,
    opts.taskNotes,
    opts.taskAttachments,
    opts.handleDeleteTask,
    opts.getDoneStatusId,
  ]);
}
