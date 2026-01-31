import { useMemo } from "react";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { Button } from "@/components/ui/button";
import { StatusIcon } from "@/pages/settings/components/StatusIcon";
import { Team } from "@/store/types";
import { TeamNameCellRenderer } from "../components";

interface UseTeamColumnDefsProps {
  teams: Team[];
  users: any[];
  teamIdToName: Map<number, string>;
  userIdToName: Map<number, string>;
  handleOpenUsersDialog: (team: Team) => void;
  translate: (key: string, fallback: string) => string;
}

export function useTeamColumnDefs({
  teams,
  users,
  teamIdToName,
  userIdToName,
  handleOpenUsersDialog,
  translate
}: UseTeamColumnDefsProps) {
  return useMemo<ColDef[]>(() => [
    { 
      field: 'name', 
      headerName: translate('grid.columns.teamName', 'Team Name'),
      flex: 1.5,
      minWidth: 220,
      maxWidth: 420,
      cellRenderer: TeamNameCellRenderer
    },
    {
      field: 'parent_team_id',
      headerName: translate('grid.columns.parentTeam', 'Parent Team'),
      flex: 1,
      minWidth: 160,
      valueGetter: (p) => p.data?.parent_team_id ?? null,
      cellRenderer: (p: ICellRendererParams) => {
        const id = p?.data?.parent_team_id as number | null | undefined;
        return id ? (teamIdToName.get(id) || `#${id}`) : '-';
      }
    },
    {
      field: 'icon',
      headerName: translate('grid.columns.icon', 'Icon'),
      width: 90,
      cellRenderer: (p: ICellRendererParams) => {
        const iconStr: string = p?.data?.icon || 'fas fa-circle';
        const color = p?.data?.color || '#6B7280';
        return (
          <div className="flex items-center h-full">
            <StatusIcon icon={iconStr} color={color} />
          </div>
        );
      },
      sortable: false,
      filter: false
    },
    {
      field: 'team_lead_id',
      headerName: translate('grid.columns.teamLead', 'Team Lead'),
      flex: 1,
      minWidth: 180,
      valueGetter: (p) => p.data?.team_lead_id ?? null,
      cellRenderer: (p: ICellRendererParams) => {
        const id = p?.data?.team_lead_id as number | null | undefined;
        if (!id) return '-';
        return userIdToName.get(id) || `User #${id}`;
      }
    },
    {
      field: 'is_active',
      headerName: translate('grid.columns.active', 'Active'),
      width: 100,
      valueGetter: (p) => !!p.data?.is_active,
      cellRenderer: (p: ICellRendererParams) => (p?.data?.is_active ? translate('grid.values.yes', 'Yes') : translate('grid.values.no', 'No'))
    },
    {
      field: 'actions',
      headerName: translate('grid.columns.actions', 'Actions'),
      width: 170,
      cellRenderer: (p: ICellRendererParams) => (
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            data-grid-stop-row-click="true"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
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
              handleOpenUsersDialog(p.data);
            }}
          >
            {translate('grid.actions.manageUsers', 'Users')}
          </Button>
        </div>
      ),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ], [teamIdToName, userIdToName, handleOpenUsersDialog, translate]);
}
