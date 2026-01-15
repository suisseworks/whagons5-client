import { useMemo } from 'react';

export function useTaskDialogComputed(params: any) {
  const computeStart = performance.now();
  const {
    mode,
    propWorkspaceId,
    task,
    templates,
    templateId,
    categories,
    workspaces,
    priorities,
    categoryId,
    categoryPriorityAssignments,
    userTeamIds,
    currentWorkspace,
    approvalId,
    selectedTemplate,
    statuses,
  } = params;

  // Derive workspace ID from template (for create-all mode)
  const derivedWorkspaceId = useMemo(() => {
    if (mode !== 'create-all' || !templateId) return null;
    const template = templates.find((t: any) => 
      t.id === templateId || Number(t.id) === Number(templateId) || String(t.id) === String(templateId)
    );
    if (!template?.category_id) return null;
    const cat = categories.find((c: any) => 
      c.id === template.category_id || Number(c.id) === Number(template.category_id) || String(c.id) === String(template.category_id)
    );
    return cat?.workspace_id || null;
  }, [mode, templates, templateId, categories]);

  // Determine workspace ID based on mode
  const workspaceId = useMemo(() => {
    if (mode === 'create' && propWorkspaceId) return propWorkspaceId;
    if (mode === 'edit' && task?.workspace_id) return Number(task.workspace_id);
    if (mode === 'create-all' && derivedWorkspaceId) return derivedWorkspaceId;
    return null;
  }, [mode, propWorkspaceId, task?.workspace_id, derivedWorkspaceId]);

  const currentWorkspaceData = useMemo(() => {
    if (!workspaceId) return null;
    return workspaces.find((w: any) => w.id === workspaceId);
  }, [workspaces, workspaceId]);

  const workspaceCategories = useMemo(() => {
    if (!workspaceId) return [];
    return categories.filter((c: any) => c.workspace_id === workspaceId);
  }, [categories, workspaceId]);

  const categoryPriorityIdsForCategory = useMemo(() => {
    const ids = new Set<number>();
    if (!categoryId) return ids;
    const catIdNum = Number(categoryId);
    for (const row of categoryPriorityAssignments || []) {
      const rowCatId = Number(row?.category_id ?? row?.categoryId);
      const rowPriorityId = Number(row?.priority_id ?? row?.priorityId);
      if (Number.isFinite(rowCatId) && Number.isFinite(rowPriorityId) && rowCatId === catIdNum) {
        ids.add(rowPriorityId);
      }
    }
    return ids;
  }, [categoryPriorityAssignments, categoryId]);

  const categoryPriorities = useMemo(() => {
    const catIdNum = categoryId != null ? Number(categoryId) : null;
    const matchesCategory = (p: any) => {
      const catVal = p?.category_id ?? p?.categoryId;
      const catValNum = catVal == null ? null : Number(catVal);
      return catIdNum != null && catValNum === catIdNum;
    };
    const matchesViaAssignment = (p: any) => {
      const pid = Number(p?.id ?? p?.priority_id ?? p?.priorityId);
      return Number.isFinite(pid) && categoryPriorityIdsForCategory.has(pid);
    };
    const globalPriorities = () =>
      priorities.filter((p: any) => {
        const catVal = p?.category_id ?? p?.categoryId;
        return catVal === null || catVal === undefined;
      });

    if (catIdNum == null) {
      if (mode === 'create' || mode === 'create-all') {
        return globalPriorities();
      }
      return [];
    }

    const matched = priorities.filter((p: any) => matchesCategory(p) || matchesViaAssignment(p));
    if (matched.length > 0) return matched;
    return globalPriorities();
  }, [priorities, categoryId, mode, categoryPriorityIdsForCategory]);

  const workspaceTemplates = useMemo(() => {
    let filtered = templates;
    
    if (mode === 'create-all') {
      filtered = templates.filter((template: any) => {
        if (template?.enabled === false) return false;
        const cat = categories.find((c: any) => c.id === template.category_id);
        if (!cat) return false;
        const ws = workspaces.find((w: any) => w.id === cat.workspace_id);
        return ws?.type === "DEFAULT";
      });
    } else {
      if (!currentWorkspaceData || currentWorkspaceData.type !== "DEFAULT") return [];
      filtered = templates.filter((template: any) => {
        if (template?.enabled === false) return false;
        return template.category_id === currentWorkspaceData.category_id;
      });
    }

    return filtered.filter((template: any) => {
      if (!template.is_private) return true;
      const cat = categories.find((c: any) => c.id === template.category_id);
      if (!cat) return false;
      const categoryTeamId = Number(cat.team_id);
      return userTeamIds.includes(categoryTeamId);
    });
  }, [templates, currentWorkspaceData, mode, categories, workspaces, userTeamIds]);

  const selectedTemplateData = useMemo(() => {
    if (!templateId) return null;
    return templates.find((t: any) => 
      t.id === templateId || Number(t.id) === Number(templateId) || String(t.id) === String(templateId)
    ) || null;
  }, [templateId, templates]);

  const selectedApprovalId = useMemo(() => {
    if (approvalId != null) return Number(approvalId);
    if (selectedTemplate?.approval_id != null) return Number(selectedTemplate.approval_id);
    return null;
  }, [approvalId, selectedTemplate]);

  const categoryInitialStatusId = useMemo(() => {
    if (mode === 'edit') return null;
    const initial = (statuses || []).find((s: any) => s.initial === true);
    return (initial || statuses[0])?.id || null;
  }, [statuses, mode]);

  const currentCategory = useMemo(() => {
    return categories.find((c: any) => c.id === categoryId);
  }, [categories, categoryId]);

  const derivedTeamId = useMemo(() => {
    if (!categoryId) return null;
    const cat = workspaceCategories.find((c: any) => c.id === categoryId);
    return cat?.team_id || null;
  }, [workspaceCategories, categoryId]);

  const isReportingCategory = useMemo(() => {
    if (!categoryId || !currentCategory) return false;
    const categoryTeamId = Number(currentCategory.team_id);
    return !userTeamIds.includes(categoryTeamId);
  }, [categoryId, currentCategory, userTeamIds]);

  const spotsApplicable = useMemo(() => {
    if (!selectedTemplate) return true;
    const spotsNotApplicableValue = selectedTemplate.spots_not_applicable;
    const spotsNotApplicable = 
      spotsNotApplicableValue === true || 
      spotsNotApplicableValue === 'true' || 
      spotsNotApplicableValue === 1 || 
      spotsNotApplicableValue === '1';
    return !spotsNotApplicable;
  }, [selectedTemplate]);

  // Removed performance logging from hook - causes infinite loops
  // Logging is handled in parent component

  return {
    workspaceId,
    currentWorkspace: currentWorkspaceData,
    workspaceCategories,
    categoryPriorities,
    workspaceTemplates,
    selectedTemplate: selectedTemplateData,
    selectedApprovalId,
    categoryInitialStatusId,
    currentCategory,
    derivedTeamId,
    isReportingCategory,
    spotsApplicable,
  };
}
