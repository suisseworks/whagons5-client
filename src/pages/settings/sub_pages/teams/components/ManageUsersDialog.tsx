import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Plus, Trash } from "lucide-react";
import { SettingsDialog, TextField, SelectField } from "../../../components";
import { Team, Role } from "@/store/types";

interface UserAssignment {
  id?: number;
  userId: string;
  roleId: string;
  key: string;
}

interface ManageUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team | null;
  userAssignments: UserAssignment[];
  users: any[];
  roles: Role[];
  userSearchTerm: string;
  onUserSearchTermChange: (term: string) => void;
  onAddUserAssignment: () => void;
  onUpdateUserAssignment: (key: string, patch: Partial<{ userId: string; roleId: string }>) => void;
  onRemoveUserAssignment: (key: string) => void;
  onSave: (e: React.FormEvent) => void;
  isSaving: boolean;
  error: string | null;
  translate: (key: string, fallback: string) => string;
}

export function ManageUsersDialog({
  open,
  onOpenChange,
  team,
  userAssignments,
  users,
  roles,
  userSearchTerm,
  onUserSearchTermChange,
  onAddUserAssignment,
  onUpdateUserAssignment,
  onRemoveUserAssignment,
  onSave,
  isSaving,
  error,
  translate
}: ManageUsersDialogProps) {
  const tt = (key: string, fallback: string) => translate(`dialogs.manageUsers.${key}`, fallback);

  const visibleAssignments = userSearchTerm.trim().toLowerCase()
    ? userAssignments.filter((assignment) => {
        const user = (users || []).find((u: any) => String(u.id) === assignment.userId);
        if (user) {
          const nameMatch = (user.name || '').toLowerCase().includes(userSearchTerm.trim().toLowerCase());
          const emailMatch = (user.email || '').toLowerCase().includes(userSearchTerm.trim().toLowerCase());
          if (nameMatch || emailMatch) return true;
        }
        return false;
      })
    : userAssignments;

  const teamRoles = roles.filter((r) => r.scope === 'TEAM');

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      type="custom"
      title={tt('title', 'Manage team users')}
      description={tt('description', 'Assign or remove users and set their role for this team.')}
      onSubmit={onSave}
      isSubmitting={isSaving}
      submitText={tt('save', 'Save')}
      submitDisabled={!team || isSaving}
      cancelText={tt('close', 'Close')}
      contentClassName="max-w-3xl"
      error={error || undefined}
    >
      {!team ? (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {tt('noTeam', 'Select a team to manage users.')}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-muted/60 rounded-md px-3 py-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                {team.name?.charAt(0)?.toUpperCase?.() || 'T'}
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-semibold text-sm">{team.name}</span>
                <span className="text-xs text-muted-foreground">
                  <FontAwesomeIcon icon={faUser} className="w-3 h-3 mr-1" />
                  {userAssignments.length} {tt('count', 'users')}
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddUserAssignment}
              disabled={!((users || []).some((u: any) => !userAssignments.find((a) => a.userId === String(u.id))))}
            >
              <Plus className="h-4 w-4 mr-1" />
              {tt('add', 'Add user')}
            </Button>
          </div>

          {userAssignments.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              {tt('empty', 'No users assigned. Add one to get started.')}
            </div>
          ) : (
            <>
              <TextField
                id="user-search"
                label={tt('search', 'Buscar usuario')}
                value={userSearchTerm}
                onChange={onUserSearchTermChange}
                placeholder={tt('searchPlaceholder', 'Escribe para filtrar...')}
              />
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {userAssignments.length > 0 && visibleAssignments.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    {tt('noMatches', 'No hay usuarios que coincidan con la búsqueda.')}
                  </div>
                ) : (
                  visibleAssignments.map((assignment) => {
                    const usedUserIds = userAssignments
                      .filter((a) => a.key !== assignment.key)
                      .map((a) => a.userId);
                    const userOptions = (users || [])
                      .filter((u: any) => assignment.userId === String(u.id) || !usedUserIds.includes(String(u.id)))
                      .filter((u: any) => {
                        const q = userSearchTerm.trim().toLowerCase();
                        if (!q) return true;
                        return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                      })
                      .map((u: any) => ({ value: String(u.id), label: u.name || u.email || `User ${u.id}` }));
                    const roleOptions = teamRoles.map((r) => ({ value: String(r.id), label: r.name }));
                    const hasCurrentUser = assignment.userId && userOptions.some((opt: { value: string }) => opt.value === assignment.userId);
                    const hasCurrentRole = assignment.roleId && roleOptions.some((opt) => opt.value === assignment.roleId);
                    return (
                      <div key={assignment.key} className="grid grid-cols-12 gap-3 items-end border rounded-md p-3">
                        <div className="col-span-5">
                          <SelectField
                            id={`user-${assignment.key}`}
                            label={tt('user', 'User')}
                            value={assignment.userId}
                            onChange={(value) => onUpdateUserAssignment(assignment.key, { userId: value })}
                            options={hasCurrentUser || !assignment.userId ? userOptions : [{ value: assignment.userId, label: tt('unknownUser', `User ${assignment.userId}`) }, ...userOptions]}
                            placeholder={tt('selectUser', 'Select a user')}
                            searchable
                            searchPlaceholder={tt('searchPlaceholder', 'Escribe para filtrar...')}
                            required
                          />
                        </div>
                        <div className="col-span-5">
                          <SelectField
                            id={`role-${assignment.key}`}
                            label={tt('role', 'Role')}
                            value={assignment.roleId}
                            onChange={(value) => onUpdateUserAssignment(assignment.key, { roleId: value })}
                            options={hasCurrentRole || !assignment.roleId ? roleOptions : [{ value: assignment.roleId, label: tt('unknownRole', `Role ${assignment.roleId}`) }, ...roleOptions]}
                            placeholder={tt('selectRole', 'Select a role')}
                            required
                          />
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onRemoveUserAssignment(assignment.key)}
                            aria-label={tt('remove', 'Remove')}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      )}
    </SettingsDialog>
  );
}
