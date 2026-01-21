import { useEffect, startTransition } from 'react';
import { normalizeDefaultUserIds } from '../utils/fieldHelpers';

export function useFormInitialization(params: any) {
  const {
    open,
    mode,
    task,
    taskTags,
    workspaceTemplates,
    workspaceCategories,
    formInitializedRef,
    setName,
    setDescription,
    setCategoryId,
    setPriorityId,
    setSpotId,
    setStatusId,
    setTemplateId,
    setStartDate,
    setDueDate,
    setSelectedUserIds,
    setSlaId,
    setApprovalId,
    setIsSubmitting,
    setActiveTab,
    setShowDescription,
    setSelectedTagIds,
  } = params;

  useEffect(() => {
    if (!open) {
      formInitializedRef.current = false;
      return;
    }
    if (formInitializedRef.current) return;
    
    // Use setTimeout to defer initialization slightly so Sheet can start animating first
    const timer = setTimeout(() => {
      formInitializedRef.current = true;

      // Batch all state updates in a transition to not block render
      startTransition(() => {
        if (mode === 'edit' && task) {
      setName(task.name || '');
      setDescription(task.description || '');
      setCategoryId(task.category_id ? Number(task.category_id) : null);
      setPriorityId(task.priority_id ? Number(task.priority_id) : null);
      setSpotId(task.spot_id ? Number(task.spot_id) : null);
      setStatusId(task.status_id ? Number(task.status_id) : null);
      setTemplateId(task.template_id ? Number(task.template_id) : null);
      setStartDate(task.start_date ? new Date(task.start_date).toISOString().split('T')[0] : '');
      setDueDate(task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '');
      setSelectedUserIds(Array.isArray(task.user_ids) ? task.user_ids.map((id: any) => Number(id)).filter((n: any) => Number.isFinite(n)) : []);
      setSlaId(task.sla_id ? Number(task.sla_id) : null);
      setApprovalId(task.approval_id ? Number(task.approval_id) : null);
      setIsSubmitting(false);
      setActiveTab('basic');
      setShowDescription(!!task.description);
      const currentTaskTagIds = taskTags
        .filter((tt: any) => tt.task_id === Number(task.id))
        .map((tt: any) => Number(tt.tag_id));
      setSelectedTagIds(currentTaskTagIds);
    } else if (mode === 'create') {
      setDescription('');
      setSpotId(null);
      // Use initial values from task prop if provided (e.g., from scheduler)
      setStartDate(task?.start_date ? new Date(task.start_date).toISOString().split('T')[0] : '');
      setSelectedUserIds(task?.user_ids && Array.isArray(task.user_ids) 
        ? task.user_ids.map((id: any) => Number(id)).filter((n: any) => Number.isFinite(n))
        : []);
      setDueDate(task?.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '');
      setIsSubmitting(false);
      setSlaId(null);
      setApprovalId(null);
      setActiveTab('basic');
      setShowDescription(false);
      setSelectedTagIds([]);
      
      const firstTemplate = workspaceTemplates[0];
      if (firstTemplate) {
        setTemplateId(firstTemplate.id);
        setCategoryId(firstTemplate.category_id || null);
        const tplPriority = firstTemplate.priority_id ?? firstTemplate.default_priority ?? null;
        setPriorityId(tplPriority);
        setName(firstTemplate.name || '');
        setSlaId(firstTemplate.sla_id || null);
        setApprovalId(firstTemplate.approval_id || null);
        const spotsNotApplicable = firstTemplate.spots_not_applicable === true || firstTemplate.spots_not_applicable === 'true';
        if (spotsNotApplicable) {
          setSpotId(null);
        } else if (firstTemplate.default_spot_id) {
          setSpotId(firstTemplate.default_spot_id);
        }
        // Only use template default users if no initial users provided
        if (!task?.user_ids || !Array.isArray(task.user_ids) || task.user_ids.length === 0) {
          const defaultsUsers = normalizeDefaultUserIds(firstTemplate.default_user_ids);
          setSelectedUserIds(defaultsUsers);
        }
      } else {
        setTemplateId(null);
        setName('');
        const defaultCategory = workspaceCategories[0];
        setCategoryId(defaultCategory ? defaultCategory.id : null);
        setPriorityId(null);
      }
    } else if (mode === 'create-all') {
      setDescription('');
      setSpotId(null);
      setSelectedUserIds([]);
      setDueDate('');
      setIsSubmitting(false);
      setSlaId(null);
      setApprovalId(null);
      setActiveTab('basic');
      setShowDescription(false);
      setSelectedTagIds([]);
      setCategoryId(null);
      setName('');
      setTemplateId(null);
      setPriorityId(null);
      }
      });
    }, 0); // Minimal delay - just enough to let Sheet start rendering
    
    return () => clearTimeout(timer);
  }, [open, mode, task?.id, taskTags, workspaceTemplates, workspaceCategories]);
}
