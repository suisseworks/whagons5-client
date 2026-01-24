import { useMemo } from "react";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { Team, Sla, Approval, StatusTransitionGroup } from "@/store/types";
import { CategoryNameCellRenderer, EnabledCellRenderer, CategoryActionsCellRenderer } from "../components";

interface UseCategoryColumnDefsProps {
  teams: Team[];
  slas: Sla[];
  approvals: Approval[];
  statusTransitionGroups: StatusTransitionGroup[];
  assignmentCountByCategory: Record<number, number>;
  onManageFields: (category: any) => void;
  translate: (key: string, fallback: string) => string;
}

export const useCategoryColumnDefs = ({
  teams,
  slas,
  approvals,
  statusTransitionGroups,
  assignmentCountByCategory,
  onManageFields,
  translate: tc
}: UseCategoryColumnDefsProps) => {
  return useMemo<ColDef[]>(() => [
    { 
      field: 'name', 
      headerName: tc('grid.columns.categoryName', 'Category Name'),
      flex: 4,
      minWidth: 350,
      cellRenderer: CategoryNameCellRenderer
    },
    {
      field: 'team_id',
      headerName: tc('grid.columns.team', 'Team'),
      flex: 1.5,
      minWidth: 200,
      cellRenderer: (params: ICellRendererParams) => {
        const teamId = params.value;

        if (!teamId) {
          return <span className="text-muted-foreground">{tc('grid.values.noTeam', 'No Team')}</span>;
        }

        const team = teams.find((t: any) => t.id === teamId);

        return (
          <div className="flex items-center space-x-2">
            <div 
              className="w-6 h-6 min-w-[1.5rem] text-white rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
              style={{ backgroundColor: team?.color ?? '#6B7280' }}
            >
              {team?.name ? team.name.charAt(0).toUpperCase() : 'T'}
            </div>
            <span>{team?.name || `Team ${teamId}`}</span>
          </div>
        );
      },
      sortable: true,
      filter: true
    },
    {
      field: 'sla_id',
      headerName: tc('grid.columns.sla', 'SLA'),
      flex: 1.2,
      minWidth: 180,
      cellRenderer: (params: ICellRendererParams) => {
        const slaId = params.value as number | null | undefined;
        if (!slaId) {
          return '' as any;
        }
        const sla = slas.find((s: Sla) => s.id === Number(slaId));
        return <span>{sla?.name || `SLA ${slaId}`}</span>;
      },
      sortable: true,
      filter: true
    },
    {
      field: 'approval_id',
      headerName: tc('grid.columns.approval', 'Approval'),
      flex: 1.2,
      minWidth: 180,
      cellRenderer: (params: ICellRendererParams) => {
        const approvalId = params.value as number | null | undefined;
        if (!approvalId) {
          return '' as any;
        }
        const approval = approvals.find((a: Approval) => a.id === Number(approvalId));
        return <span>{approval?.name || `Approval ${approvalId}`}</span>;
      },
      sortable: true,
      filter: true
    },
    {
      field: 'status_transition_group_id',
      headerName: tc('grid.columns.statusTransitionGroup', 'Status Transition Group'),
      flex: 1.5,
      minWidth: 200,
      cellRenderer: (params: ICellRendererParams) => {
        const groupId = params.value as number | null | undefined;
        if (!groupId) {
          return <span className="text-muted-foreground">{tc('grid.values.unassigned', 'Unassigned')}</span>;
        }
        const group = statusTransitionGroups.find((g: any) => g.id === Number(groupId));
        return <span>{group?.name || `Group ${groupId}`}</span>;
      },
      sortable: true,
      filter: true
    },
    {
      field: 'enabled',
      headerName: tc('grid.columns.status', 'Status'),
      flex: 0.8,
      minWidth: 120,
      cellRenderer: EnabledCellRenderer,
      sortable: true,
      filter: true
    },
    {
      headerName: tc('grid.columns.actions', 'Actions'),
      colId: 'actions',
      minWidth: 240,
      suppressSizeToFit: true,
      cellRenderer: CategoryActionsCellRenderer,
      cellRendererParams: {
        onManageFields: onManageFields,
        getFieldCount: (id: number) => assignmentCountByCategory[Number(id)] || 0
      },
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ], [teams, slas, approvals, statusTransitionGroups, assignmentCountByCategory, onManageFields, tc]);
};
