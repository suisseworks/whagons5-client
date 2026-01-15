import { useSelector } from 'react-redux';
import { useMemo } from 'react';
import { RootState } from '@/store/store';
import { useAuth } from '@/providers/AuthProvider';

export function useTaskDialogData() {
  const { value: categories = [] } = useSelector((s: RootState) => (s as any).categories || { value: [] });
  const { value: priorities = [] } = useSelector((s: RootState) => (s as any).priorities || { value: [] });
  const { value: categoryPriorityAssignments = [] } = useSelector((s: RootState) => (s as any).categoryPriorities || { value: [] });
  const { value: statuses = [] } = useSelector((s: RootState) => (s as any).statuses || { value: [] });
  const { value: spots = [] } = useSelector((s: RootState) => (s as any).spots || { value: [] });
  const { value: users = [] } = useSelector((s: RootState) => (s as any).users || { value: [] });
  const { value: teams = [] } = useSelector((s: RootState) => (s as any).teams || { value: [] });
  const { value: spotTypes = [] } = useSelector((s: RootState) => (s as any).spotTypes || { value: [] });
  const { value: workspaces = [] } = useSelector((s: RootState) => (s as any).workspaces || { value: [] });
  const { value: slas = [] } = useSelector((s: RootState) => (s as any).slas || { value: [] });
  const { value: approvals = [] } = useSelector((s: RootState) => (s as any).approvals || { value: [] });
  const { value: templates = [] } = useSelector((s: RootState) => (s as any).templates || { value: [] });
  const { value: tags = [] } = useSelector((s: RootState) => (s as any).tags || { value: [] });
  const { value: taskTags = [] } = useSelector((s: RootState) => (s as any).taskTags || { value: [] });
  const { value: customFields = [] } = useSelector((s: RootState) => (s as any).customFields || { value: [] });
  const { value: categoryCustomFields = [] } = useSelector((s: RootState) => (s as any).categoryCustomFields || { value: [] });
  const { value: taskCustomFieldValues = [] } = useSelector((s: RootState) => (s as any).taskCustomFieldValues || { value: [] });
  const { value: userTeams = [] } = useSelector((s: RootState) => (s as any).userTeams || { value: [] });
  
  const { user } = useAuth();

  const userTeamIds = useMemo(() => {
    if (!user?.id) return [];
    return (userTeams as any[])
      .filter((ut: any) => Number(ut.user_id) === Number(user.id))
      .map((ut: any) => Number(ut.team_id))
      .filter((id: number) => Number.isFinite(id));
  }, [user, userTeams]);

  const approvalMap = useMemo(() => {
    const map: Record<number, any> = {};
    for (const a of approvals || []) {
      const id = Number((a as any)?.id);
      if (Number.isFinite(id)) map[id] = a;
    }
    return map;
  }, [approvals]);

  const taskCustomFieldValueMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const row of taskCustomFieldValues || []) {
      const tId = Number((row as any)?.task_id ?? (row as any)?.taskId);
      const fId = Number((row as any)?.field_id ?? (row as any)?.custom_field_id ?? (row as any)?.fieldId);
      if (!Number.isFinite(tId) || !Number.isFinite(fId)) continue;
      m.set(`${tId}:${fId}`, row);
    }
    return m;
  }, [taskCustomFieldValues]);

  return {
    categories,
    priorities,
    categoryPriorityAssignments,
    statuses,
    spots,
    users,
    teams,
    spotTypes,
    workspaces,
    slas,
    approvals,
    templates,
    tags,
    taskTags,
    customFields,
    categoryCustomFields,
    taskCustomFieldValues,
    userTeams,
    user,
    userTeamIds,
    approvalMap,
    taskCustomFieldValueMap,
  };
}
