import { useMemo } from "react";
import { useSelector } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { Badge } from "@/components/ui/badge";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Team } from "@/store/types";

// Extended User type based on actual API data structure
interface UserData {
  id: number;
  name: string;
  email: string;
  team_id?: number | null;
  role_id?: number | null;
  organization_name?: string | null;
  is_admin?: boolean;
  has_active_subscription?: boolean;
  url_picture?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer,
  AvatarCellRenderer
} from "../components";

function Users() {
  // Redux state for related data
  const { value: teams } = useSelector((state: RootState) => state.teams) as { value: Team[] };
  
  // Use shared state management
  const {
    items: users,
    filteredItems,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    handleSearch,
    deleteItem,
    isSubmitting,
    formError,
    isDeleteDialogOpen,
    deletingItem: deletingUser,
    handleDelete,
    handleCloseDeleteDialog
  } = useSettingsState<UserData>({
    entityName: 'users',
    searchFields: ['name', 'email']
  });

  const columnDefs = useMemo<ColDef[]>(() => ([
    { 
      field: 'id', 
      headerName: 'ID',
      width: 80 
    },
    { 
      field: 'name', 
      headerName: 'Name',
      flex: 2,
      minWidth: 150, 
      cellRenderer: (params: ICellRendererParams) => (
        <AvatarCellRenderer name={params.data?.name || ''} />
      ) 
    },
    { 
      field: 'email', 
      headerName: 'Email',
      flex: 2,
      minWidth: 200 
    },
    { 
      field: 'team_id', 
      headerName: 'Team',
      width: 150,
      cellRenderer: (params: ICellRendererParams) => {
        const teamId = params.value;
        if (!teamId) return <span className="text-muted-foreground">No Team</span>;
        
        const team = teams.find((t: Team) => t.id === teamId);
        return team ? <Badge variant="secondary">{team.name}</Badge> : <span className="text-muted-foreground">Team {teamId}</span>;
      }
    },
    { 
      field: 'organization_name', 
      headerName: 'Organization',
      flex: 1,
      minWidth: 150 
    },
    { 
      field: 'is_admin', 
      headerName: 'Role',
      width: 120, 
      cellRenderer: (params: ICellRendererParams) => 
        params.value ? <Badge variant="default">Admin</Badge> : <Badge variant="outline">User</Badge> 
    },
    { 
      field: 'has_active_subscription', 
      headerName: 'Subscription',
      width: 130, 
      cellRenderer: (params: ICellRendererParams) => 
        params.value ? <Badge variant="default" className="bg-green-500">Active</Badge> : <Badge variant="destructive">Inactive</Badge> 
    },
    { 
      field: 'created_at', 
      headerName: 'Created',
      width: 140, 
      valueFormatter: (params: any) => params.value ? new Date(params.value).toLocaleDateString() : '' 
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      cellRenderer: createActionsCellRenderer({
        onDelete: handleDelete
      }),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ]), [teams, handleDelete]);

  // Render entity preview for delete dialog
  const renderUserPreview = (user: UserData) => (
    <div className="flex items-center space-x-3">
      <div className="w-8 h-8 min-w-[2rem] bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
        {user.name.charAt(0).toUpperCase()}
      </div>
      <div>
        <div className="font-medium">{user.name}</div>
        <div className="text-sm text-muted-foreground">{user.email}</div>
        <div className="flex items-center space-x-2 mt-1">
          {user.team_id && (
            <Badge variant="secondary" className="text-xs">
              {teams.find(t => t.id === user.team_id)?.name || `Team ${user.team_id}`}
            </Badge>
          )}
          <Badge variant={user.is_admin ? "default" : "outline"} className="text-xs">
            {user.is_admin ? "Admin" : "User"}
          </Badge>
          <Badge 
            variant={user.has_active_subscription ? "default" : "destructive"} 
            className="text-xs"
          >
            {user.has_active_subscription ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>
    </div>
  );

  return (
    <SettingsLayout
      title="Users"
      description="User accounts and permissions"
      icon={faUser}
      iconColor="#6366f1"
      search={{
        placeholder: "Search users...",
        value: searchQuery,
        onChange: (value: string) => {
          setSearchQuery(value);
          handleSearch(value);
        }
      }}
      loading={{
        isLoading: loading,
        message: "Loading users..."
      }}
      error={error ? {
        message: error,
        onRetry: () => window.location.reload()
      } : undefined}
      statistics={{
        title: "User Statistics",
        description: "Overview of users across your teams",
        items: [
          { label: "Total Users", value: users.length },
          { label: "Admins", value: users.filter((user: UserData) => user.is_admin).length },
          { 
            label: "Active Subscriptions", 
            value: users.length > 0 
              ? `${Math.round((users.filter((user: UserData) => user.has_active_subscription).length / users.length) * 100)}%`
              : "0%"
          }
        ]
      }}
    >
      <SettingsGrid
        rowData={filteredItems}
        columnDefs={columnDefs}
        noRowsMessage="No users found"
        height="500px"
      />

      {/* Delete User Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title="Delete User"
        description={
          deletingUser 
            ? `Are you sure you want to delete ${deletingUser.name} (${deletingUser.email})? This action cannot be undone.`
            : undefined
        }
        onConfirm={() => deletingUser ? deleteItem(deletingUser.id) : undefined}
        isSubmitting={isSubmitting}
        error={formError}
        entityName="user"
        entityData={deletingUser}
        renderEntityPreview={renderUserPreview}
      />
    </SettingsLayout>
  );
}

export default Users;