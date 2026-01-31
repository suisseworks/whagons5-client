import { useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/store/store";
import { Team, UserTeam, Role } from "@/store/types";
import { genericActions } from "@/store/genericSlices";

interface UserAssignment {
  id?: number;
  userId: string;
  roleId: string;
  key: string;
}

export function useTeamUserAssignments(
  userTeams: UserTeam[],
  users: any[],
  roles: Role[],
  translate: (key: string, fallback: string) => string
) {
  const dispatch = useDispatch<AppDispatch>();
  const [isUsersDialogOpen, setIsUsersDialogOpen] = useState(false);
  const [usersDialogTeam, setUsersDialogTeam] = useState<Team | null>(null);
  const [userAssignments, setUserAssignments] = useState<UserAssignment[]>([]);
  const [isSavingUsers, setIsSavingUsers] = useState(false);
  const [usersFormError, setUsersFormError] = useState<string | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  const getRoleId = (ut: UserTeam | any) => {
    const val = ut?.role_id ?? ut?.roleId ?? ut?.role?.id;
    return val == null ? null : Number(val);
  };

  const handleOpenUsersDialog = useCallback((team: Team) => {
    setUsersDialogTeam(team);
    const related = userTeams.filter((ut) => ut.team_id === team.id);
    const assignments = related.map((ut) => ({
      id: ut.id,
      userId: String(ut.user_id),
      roleId: getRoleId(ut) != null ? String(getRoleId(ut)) : '',
      key: `existing-${ut.id}`
    }));
    setUserAssignments(assignments);
    setUsersFormError(null);
    setIsUsersDialogOpen(true);
  }, [userTeams]);

  const handleCloseUsersDialog = useCallback(() => {
    setIsUsersDialogOpen(false);
    setUsersDialogTeam(null);
    setUserAssignments([]);
    setIsSavingUsers(false);
    setUsersFormError(null);
  }, []);

  const addUserAssignment = useCallback(() => {
    const used = new Set(userAssignments.map((a) => a.userId));
    const firstAvailable = (users || []).find((u: any) => !used.has(String(u.id)));
    if (!firstAvailable) {
      setUsersFormError(translate('dialogs.manageUsers.noAvailableUsers', 'No more users available to add.'));
      return;
    }
    setUserAssignments((prev) => [
      ...prev,
      {
        userId: firstAvailable ? String(firstAvailable.id) : '',
        roleId: '',
        key: `new-${Date.now()}-${Math.random().toString(16).slice(2)}`
      }
    ]);
  }, [userAssignments, users, translate]);

  const updateUserAssignment = useCallback((key: string, patch: Partial<{ userId: string; roleId: string }>) => {
    setUserAssignments((prev) =>
      prev.map((a) => (a.key === key ? { ...a, ...patch } : a))
    );
  }, []);

  const removeUserAssignment = useCallback((key: string) => {
    setUserAssignments((prev) => prev.filter((a) => a.key !== key));
  }, []);

  const handleSaveUsers = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usersDialogTeam) return;
    setIsSavingUsers(true);
    setUsersFormError(null);
    try {
      const existing = userTeams.filter((ut) => ut.team_id === usersDialogTeam.id);
      const isEmpty = userAssignments.length === 0;
      const current = isEmpty
        ? []
        : userAssignments.map((a) => ({
            ...a,
            userIdNum: Number(a.userId),
            roleIdNum: a.roleId ? Number(a.roleId) : null
          }));

      if (!isEmpty) {
        if (current.some((c) => !c.userId || Number.isNaN(c.userIdNum))) {
          setUsersFormError(translate('dialogs.manageUsers.errors.userRequired', 'Selecciona un usuario para cada fila.'));
          setIsSavingUsers(false);
          return;
        }
        if (current.some((c) => c.roleId == null || c.roleId === '' || Number.isNaN(c.roleIdNum ?? NaN))) {
          setUsersFormError(translate('dialogs.manageUsers.errors.roleRequired', 'Selecciona un rol para cada usuario.'));
          setIsSavingUsers(false);
          return;
        }
        const duplicate = current.find((c, idx) => current.findIndex((d) => d.userIdNum === c.userIdNum) !== idx);
        if (duplicate) {
          setUsersFormError(translate('dialogs.manageUsers.errors.duplicateUser', 'No puedes repetir el mismo usuario.'));
          setIsSavingUsers(false);
          return;
        }
      }

      const toAdd = current.filter((c) => c.id == null);
      const toUpdate = current.filter((c) => {
        const match = existing.find((ex) => ex.id === c.id);
        if (!match) return false;
        return match.user_id !== c.userIdNum || getRoleId(match) !== c.roleIdNum;
      });
      const toRemove = existing.filter((ex) => !current.some((c) => c.id === ex.id));

      for (const add of toAdd) {
        await dispatch((genericActions as any).userTeams.addAsync({
          user_id: add.userIdNum,
          team_id: usersDialogTeam.id,
          role_id: add.roleIdNum
        })).unwrap();
      }

      for (const upd of toUpdate) {
        await dispatch((genericActions as any).userTeams.updateAsync({
          id: upd.id,
          updates: {
            user_id: upd.userIdNum,
            team_id: usersDialogTeam.id,
            role_id: upd.roleIdNum
          }
        })).unwrap();
      }

      for (const del of toRemove) {
        await dispatch((genericActions as any).userTeams.removeAsync(del.id)).unwrap();
      }

      dispatch((genericActions as any).userTeams.getFromIndexedDB?.());
      handleCloseUsersDialog();
    } catch (err: any) {
      setUsersFormError(err?.message || translate('dialogs.manageUsers.errors.generic', 'Error updating team users'));
    } finally {
      setIsSavingUsers(false);
    }
  }, [usersDialogTeam, userAssignments, userTeams, dispatch, handleCloseUsersDialog, translate]);

  return {
    isUsersDialogOpen,
    setIsUsersDialogOpen,
    usersDialogTeam,
    userAssignments,
    isSavingUsers,
    usersFormError,
    userSearchTerm,
    setUserSearchTerm,
    handleOpenUsersDialog,
    handleCloseUsersDialog,
    addUserAssignment,
    updateUserAssignment,
    removeUserAssignment,
    handleSaveUsers
  };
}
