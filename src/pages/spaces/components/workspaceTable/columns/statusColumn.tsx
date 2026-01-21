/**
 * Status column definition with status cell renderer and approval blocking
 */

import StatusCell from '@/pages/spaces/components/StatusCell';
import { ColumnBuilderOptions } from './types';
import { computeApprovalStatusForTask } from '../utils/approvalStatus';

export function createStatusColumn(opts: ColumnBuilderOptions) {
  const {
    statusMap,
    statusesLoaded,
    getStatusIcon,
    getAllowedNextStatuses,
    handleChangeStatus,
    groupField,
    visibleColumns,
  } = opts;

  const visibilitySet: Set<string> | null = Array.isArray(visibleColumns)
    ? new Set<string>(visibleColumns as string[])
    : null;

  const isVisible = (id: string | undefined): boolean => {
    if (!visibilitySet) return true;
    if (!id) return true;
    if (id === 'name' || id === 'notes' || id === 'id') return true;
    return visibilitySet.has(id);
  };

  return {
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
      const derived = computeApprovalStatusForTask({
        taskId: Number(row?.id),
        approvalId: row?.approval_id,
        approval: row?.approval_id ? (opts as any).approvalMap?.[Number(row.approval_id)] : null,
        taskApprovalInstances: (opts as any).taskApprovalInstances,
      });
      const approvalPending = approvalRequired && derived === 'pending';
      const approvalRejected = approvalRequired && derived === 'rejected';
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
    width: 170,
    minWidth: 160,
    maxWidth: 220,
  };
}
