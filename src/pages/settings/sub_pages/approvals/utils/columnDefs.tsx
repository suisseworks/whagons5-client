import { useMemo } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBolt, faInfoCircle, faUsers } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { createActionsCellRenderer } from "../../../components";
import type { Approval } from "@/store/types";
import { NameCell } from "../components/NameCell";
import { formatTemplate } from "./conditions";
import type { TranslateFn } from "../types";

type Params = {
  ta: TranslateFn;
  renderDeadline: (type: string, value?: string | null) => string;
  getTriggerTypeLabel: (type?: string | null) => string;
  approverCountByApproval: Map<number, number>;
  openManageApprovers: (approval: Approval) => void;
  openManageActions: (approval: Approval) => void;
  openSummary: (approval: Approval) => void;
};

export const useApprovalsColumnDefs = ({
  ta,
  renderDeadline,
  getTriggerTypeLabel,
  approverCountByApproval,
  openManageApprovers,
  openManageActions,
  openSummary,
}: Params) => {
  return useMemo<ColDef[]>(() => {
    const columnLabels = {
      approval: ta("grid.columns.approval", "Approval"),
      requirement: ta("grid.columns.requirement", "Requirement"),
      approvalType: ta("grid.columns.approvalType", "Approval Type"),
      trigger: ta("grid.columns.trigger", "Trigger"),
      deadline: ta("grid.columns.deadline", "Deadline"),
      actions: ta("grid.columns.actions", "Manage"),
    };
    const requirementAllLabel = ta("grid.requirement.all", "All approvers");
    const requirementMinimumTemplate = ta("grid.requirement.minimum", "Minimum {count}");
    const requirementMinimumFallback = ta("grid.requirement.minimumFallback", "Minimum N/A");
    const sequentialLabel = ta("grid.values.sequential", "Sequential");
    const parallelLabel = ta("grid.values.parallel", "Parallel");
    const manageApproversLabel = ta("actions.manageApprovers", "Approvers");
    const manageApproversWithCount = ta("actions.manageApproversWithCount", "Approvers ({count})");
    const manageActionsLabel = ta("actions.manageActions", "Actions");

    return [
      {
        field: "drag",
        headerName: "",
        width: 52,
        suppressMovable: true,
        rowDrag: true,
      },
      {
        field: "name",
        headerName: columnLabels.approval,
        flex: 1.2,
        minWidth: 220,
        cellRenderer: NameCell,
      },
      {
        field: "summary",
        headerName: "",
        width: 70,
        suppressMovable: true,
        cellRenderer: (p: ICellRendererParams) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            data-grid-stop-row-click="true"
            onPointerDown={(e) => {
              // Prevent AG Grid from treating this as a row click (which would open Edit)
              e.preventDefault();
              e.stopPropagation();
              // Radix/AG Grid can listen above React; stop the native event too
              (e.nativeEvent as any)?.stopImmediatePropagation?.();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              (e.nativeEvent as any)?.stopImmediatePropagation?.();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              (e.nativeEvent as any)?.stopImmediatePropagation?.();
              openSummary(p?.data as Approval);
            }}
            title={ta("actions.summary", "Summary")}
            aria-label={ta("actions.summary", "Summary")}
          >
            <FontAwesomeIcon icon={faInfoCircle} className="w-4 h-4 text-muted-foreground" />
          </Button>
        ),
      },
      {
        field: "require_all",
        headerName: columnLabels.requirement,
        flex: 1,
        minWidth: 150,
        cellRenderer: (p: ICellRendererParams) => {
          const requireAll = !!p?.data?.require_all;
          const min = p?.data?.minimum_approvals as number | null | undefined;
          return requireAll
            ? requirementAllLabel
            : min
              ? formatTemplate(requirementMinimumTemplate, { count: min })
              : requirementMinimumFallback;
        },
      },
      {
        field: "approval_type",
        headerName: columnLabels.approvalType,
        width: 130,
        cellRenderer: (p: ICellRendererParams) => {
          const type = String(p?.data?.approval_type || "").toUpperCase();
          return type === "PARALLEL" ? parallelLabel : sequentialLabel;
        },
      },
      {
        field: "trigger_type",
        headerName: columnLabels.trigger,
        width: 140,
        cellRenderer: (p: ICellRendererParams) => getTriggerTypeLabel(p?.data?.trigger_type),
      },
      {
        field: "deadline_type",
        headerName: columnLabels.deadline,
        flex: 1,
        minWidth: 140,
        cellRenderer: (p: ICellRendererParams) => renderDeadline(p?.data?.deadline_type, p?.data?.deadline_value),
      },
      {
        field: "actions",
        headerName: columnLabels.actions,
        width: 280,
        cellRenderer: createActionsCellRenderer({
          // Edit is handled via row click, Delete is in edit modal
          customActions: [
            {
              icon: faUsers,
              label: (row: any) => {
                const count = approverCountByApproval.get(Number(row?.id)) || 0;
                return count > 0 ? formatTemplate(manageApproversWithCount, { count }) : manageApproversLabel;
              },
              variant: "outline",
              onClick: (row: any) => openManageApprovers(row as Approval),
              className: "p-1 h-7 relative flex items-center justify-center gap-1 min-w-[120px]",
            },
            {
              icon: faBolt,
              label: manageActionsLabel,
              variant: "outline",
              onClick: (row: any) => openManageActions(row as Approval),
              className: (row: any) => {
                const hasActions =
                  (row?.on_approved_actions && Array.isArray(row.on_approved_actions) && row.on_approved_actions.length > 0) ||
                  (row?.on_rejected_actions && Array.isArray(row.on_rejected_actions) && row.on_rejected_actions.length > 0);
                return `p-1 h-7 relative flex items-center justify-center gap-1 min-w-[90px] ${
                  hasActions ? "text-green-600 dark:text-green-500" : ""
                }`;
              },
            },
          ],
        }),
        sortable: false,
        filter: false,
        resizable: false,
        pinned: "right",
      },
    ];
  }, [approverCountByApproval, getTriggerTypeLabel, openManageActions, openManageApprovers, openSummary, renderDeadline, ta]);
};

