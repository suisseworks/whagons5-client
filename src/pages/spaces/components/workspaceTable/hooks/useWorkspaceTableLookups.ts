import { useMemo } from 'react';
import {
  createCategoryToGroup,
  createFilteredPriorities,
  createPriorityMap,
  createSpotMap,
  createStatusMap,
  createTagMap,
  createTransitionsByGroupFrom,
  createUserMap,
} from '../utils/mappers';

export interface WorkspaceTableLookupsParams {
  statuses: any[];
  priorities: any[];
  spots: any[];
  users: any[];
  categories: any[];
  templates: any[];
  forms: any[];
  formVersions: any[];
  taskForms: any[];
  statusTransitions: any[];
  slas: any[];
  tags: any[];
  taskTags: any[];
  customFields: any[];
  categoryCustomFields: any[];
  taskCustomFieldValues: any[];
  approvals: any[];
  taskApprovalInstances: any[];
  roles: any[];
  defaultCategoryId: number | null;
  workspaceNumericId: number | null;
  isAllWorkspaces: boolean;
}

export const useWorkspaceTableLookups = (p: WorkspaceTableLookupsParams) => {
  const slaMap = useMemo(() => {
    const map: Record<number, any> = {};
    (p.slas || []).forEach((s: any) => {
      if (s?.id != null) map[Number(s.id)] = s;
    });
    return map;
  }, [p.slas]);

  const statusMap = useMemo(() => createStatusMap(p.statuses), [p.statuses]);
  const categoryToGroup = useMemo(() => createCategoryToGroup(p.categories), [p.categories]);
  const transitionsByGroupFrom = useMemo(() => createTransitionsByGroupFrom(p.statusTransitions), [p.statusTransitions]);
  const priorityMap = useMemo(() => createPriorityMap(p.priorities), [p.priorities]);
  const spotMap = useMemo(() => createSpotMap(p.spots), [p.spots]);
  const userMap = useMemo(() => createUserMap(p.users), [p.users]);
  const filteredPriorities = useMemo(
    () => createFilteredPriorities(p.priorities, p.defaultCategoryId),
    [p.priorities, p.defaultCategoryId]
  );
  const tagMap = useMemo(() => createTagMap(p.tags), [p.tags]);

  const templateMap = useMemo(() => {
    const m: Record<number, any> = {};
    for (const tpl of p.templates || []) {
      const id = Number((tpl as any)?.id);
      if (!Number.isFinite(id)) continue;
      m[id] = tpl;
    }
    return m;
  }, [p.templates]);

  const formMap = useMemo(() => {
    const m: Record<number, any> = {};
    for (const f of p.forms || []) {
      const id = Number((f as any)?.id);
      if (!Number.isFinite(id)) continue;
      m[id] = f;
    }
    return m;
  }, [p.forms]);

  const formVersionMap = useMemo(() => {
    const m: Record<number, any> = {};
    for (const v of p.formVersions || []) {
      const id = Number((v as any)?.id);
      if (!Number.isFinite(id)) continue;
      m[id] = v;
    }
    return m;
  }, [p.formVersions]);

  // Map task_id -> TaskForm (for form fill status)
  const taskFormsMap = useMemo(() => {
    const m = new Map<number, any>();
    for (const tf of p.taskForms || []) {
      const taskId = Number((tf as any)?.task_id);
      if (!Number.isFinite(taskId)) continue;
      // If multiple forms per task exist, keep the most recent one
      const existing = m.get(taskId);
      if (!existing || (tf as any).updated_at > existing.updated_at) {
        m.set(taskId, tf);
      }
    }
    return m;
  }, [p.taskForms]);

  const taskTagsMap = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const tt of p.taskTags || []) {
      const taskId = Number((tt as any).task_id);
      const tagId = Number((tt as any).tag_id);
      if (!Number.isFinite(taskId) || !Number.isFinite(tagId)) continue;
      const arr = m.get(taskId);
      if (arr) arr.push(tagId);
      else m.set(taskId, [tagId]);
    }
    return m;
  }, [p.taskTags]);

  const categoryMap = useMemo(() => {
    const m: Record<number, any> = {};
    for (const c of p.categories || []) {
      const id = Number((c as any).id);
      if (!Number.isFinite(id)) continue;
      m[id] = { id, name: (c as any).name, color: (c as any).color, icon: (c as any).icon };
    }
    return m;
  }, [p.categories]);

  const workspaceCustomFields = useMemo(() => {
    if (!p.categories || p.categories.length === 0 || !p.customFields || p.customFields.length === 0) return [] as any[];

    const allowedCategoryIds = new Set<number>();
    for (const c of p.categories as any[]) {
      const cid = Number((c as any).id);
      const wsId = Number((c as any).workspace_id);
      if (!Number.isFinite(cid)) continue;
      if (p.isAllWorkspaces || p.workspaceNumericId == null || wsId === p.workspaceNumericId) {
        allowedCategoryIds.add(cid);
      }
    }

    if (allowedCategoryIds.size === 0) return [] as any[];

    const byId: Record<number, { field: any; categories: any[] }> = {};

    for (const link of (p.categoryCustomFields || []) as any[]) {
      const catId = Number((link as any).category_id);
      const fieldId = Number((link as any).field_id);
      if (!allowedCategoryIds.has(catId) || !Number.isFinite(fieldId)) continue;
      const field = (p.customFields as any[]).find((f: any) => Number(f.id) === fieldId);
      if (!field) continue;
      const cat = categoryMap[catId];
      if (!byId[fieldId]) byId[fieldId] = { field, categories: [] };
      if (cat) byId[fieldId].categories.push(cat);
    }

    return Object.entries(byId).map(([fid, data]) => ({
      fieldId: Number(fid),
      field: (data as any).field,
      categories: (data as any).categories,
    }));
  }, [
    p.categories,
    p.customFields,
    p.categoryCustomFields,
    categoryMap,
    p.workspaceNumericId,
    p.isAllWorkspaces,
  ]);

  const taskCustomFieldValueMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const v of (p.taskCustomFieldValues || []) as any[]) {
      const taskId = Number((v as any).task_id);
      const fieldId = Number((v as any).field_id ?? (v as any).custom_field_id);
      if (!Number.isFinite(taskId) || !Number.isFinite(fieldId)) continue;
      m.set(`${taskId}:${fieldId}`, v);
    }
    return m;
  }, [p.taskCustomFieldValues]);

  const approvalMap = useMemo(() => {
    const m: Record<number, any> = {};
    for (const a of p.approvals || []) {
      const id = Number((a as any).id);
      if (Number.isFinite(id)) m[id] = a;
    }
    return m;
  }, [p.approvals]);

  const stableTaskApprovalInstances = useMemo(() => p.taskApprovalInstances, [p.taskApprovalInstances]);

  const roleMap = useMemo(() => {
    const m: Record<number, any> = {};
    for (const r of p.roles || []) {
      const id = Number((r as any).id);
      if (Number.isFinite(id)) m[id] = r;
    }
    return m;
  }, [p.roles]);

  return {
    slaMap,
    statusMap,
    categoryToGroup,
    transitionsByGroupFrom,
    priorityMap,
    spotMap,
    userMap,
    filteredPriorities,
    tagMap,
    templateMap,
    formMap,
    formVersionMap,
    taskFormsMap,
    taskTagsMap,
    categoryMap,
    workspaceCustomFields,
    taskCustomFieldValueMap,
    approvalMap,
    stableTaskApprovalInstances,
    roleMap,
  };
};

