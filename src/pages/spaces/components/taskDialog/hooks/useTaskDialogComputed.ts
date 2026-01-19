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
    statusTransitions,
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
    
    console.log('[useTaskDialogComputed] Templates filtering:', {
      mode,
      totalTemplates: templates.length,
      currentWorkspace: currentWorkspaceData,
      workspaceId,
      allCategories: categories.map((c: any) => ({ id: c.id, name: c.name, workspace_id: c.workspace_id })),
      allTemplates: templates.map((t: any) => ({ 
        id: t.id, 
        name: t.name, 
        category_id: t.category_id,
        enabled: t.enabled,
        is_private: t.is_private
      })),
    });
    
    if (mode === 'create-all') {
      filtered = templates.filter((template: any) => {
        if (template?.enabled === false) return false;
        const cat = categories.find((c: any) => c.id === template.category_id);
        if (!cat) return false;
        const ws = workspaces.find((w: any) => w.id === cat.workspace_id);
        return ws?.type === "DEFAULT";
      });
    } else {
      if (!currentWorkspaceData) {
        console.log('[useTaskDialogComputed] No currentWorkspaceData');
        return [];
      }
      if (currentWorkspaceData.type !== "DEFAULT") {
        console.log('[useTaskDialogComputed] Workspace is not DEFAULT type:', currentWorkspaceData.type);
        return [];
      }
      
      filtered = templates.filter((template: any) => {
        if (template?.enabled === false) return false;
        const cat = categories.find((c: any) => c.id === template.category_id);
        const match = cat && cat.workspace_id === currentWorkspaceData.id;
        console.log('[useTaskDialogComputed] Template:', template.name, {
          categoryId: template.category_id,
          categoryName: cat?.name,
          categoryWorkspaceId: cat?.workspace_id,
          currentWorkspaceId: currentWorkspaceData.id,
          match
        });
        return match;
      });
    }

    const finalFiltered = filtered.filter((template: any) => {
      if (!template.is_private) return true;
      const cat = categories.find((c: any) => c.id === template.category_id);
      if (!cat) return false;
      const categoryTeamId = Number(cat.team_id);
      return userTeamIds.includes(categoryTeamId);
    });
    
    console.log('[useTaskDialogComputed] Final templates:', finalFiltered.length, finalFiltered.map((t: any) => t.name));
    
    return finalFiltered;
  }, [templates, currentWorkspaceData, mode, categories, workspaces, userTeamIds, workspaceId]);

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

  const currentCategory = useMemo(() => {
    return categories.find((c: any) => c.id === categoryId);
  }, [categories, categoryId]);

  const categoryInitialStatusId = useMemo(() => {
    if (mode === 'edit') return null;

    const groupId = Number(currentCategory?.status_transition_group_id);
    const groupTransitions = Number.isFinite(groupId)
      ? (statusTransitions || []).filter((t: any) => Number(t?.status_transition_group_id) === groupId)
      : [];

    if (groupTransitions.length > 0) {
      const initialTransition = groupTransitions.find((t: any) => t?.initial === true || t?.initial === 1 || t?.initial === '1');
      const candidate = initialTransition ?? groupTransitions[0];
      const fromId = Number(candidate?.from_status);
      const toId = Number(candidate?.to_status);
      const initialStatusId = Number.isFinite(fromId) ? fromId : (Number.isFinite(toId) ? toId : null);

      if (initialStatusId != null) {
        const statusName = statuses.find((s: any) => Number(s?.id) === initialStatusId)?.name;
        console.log('[categoryInitialStatusId] Using group initial status:', {
          groupId,
          statusId: initialStatusId,
          statusName,
          initialTransitionId: candidate?.id,
        });
        return initialStatusId;
      }
    }

    // Fallback to status with initial flag or first status
    const initial = (statuses || []).find((s: any) => s.initial === true);
    const fallbackId = (initial || statuses[0])?.id || null;
    console.log('[categoryInitialStatusId] Using fallback status:', {
      fallbackId,
      statusName: statuses.find((s: any) => s.id === fallbackId)?.name,
      reason: groupTransitions.length === 0 ? 'No transitions found' : 'No valid initial status'
    });
    return fallbackId;
  }, [statuses, mode, currentCategory, statusTransitions]);

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
