import { useEffect, startTransition } from 'react';
import { normalizeDefaultUserIds } from '../utils/fieldHelpers';
import { getAssignedUserIdsFromTaskUsers } from '../../workspaceTable/utils/userUtils';

export function useFormInitialization(params: any) {
  const {
    open,
    mode,
    task,
    taskTags,
    taskUsers,
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
    setStartTime,
    setDueDate,
    setDueTime,
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
      
      // Extract date and time from start_date
      if (task.start_date) {
        const startDateObj = new Date(task.start_date);
        setStartDate(startDateObj.toISOString().split('T')[0]);
        setStartTime(startDateObj.toISOString().split('T')[1].substring(0, 5)); // HH:MM
      } else {
        setStartDate('');
        setStartTime('');
      }
      
      // Extract date and time from due_date
      if (task.due_date) {
        const dueDateObj = new Date(task.due_date);
        setDueDate(dueDateObj.toISOString().split('T')[0]);
        setDueTime(dueDateObj.toISOString().split('T')[1].substring(0, 5)); // HH:MM
      } else {
        setDueDate('');
        setDueTime('');
      }
      
      // Get assigned user IDs from taskUsers table
      const assignedUserIds = getAssignedUserIdsFromTaskUsers(task.id, taskUsers || []);
      setSelectedUserIds(assignedUserIds);
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
      let initialStartDate = '';
      let initialStartTime = '';
      let initialDueDate = '';
      let initialDueTime = '';
      
      if (task?.start_date) {
        const startDateObj = new Date(task.start_date);
        initialStartDate = startDateObj.toISOString().split('T')[0];
        initialStartTime = startDateObj.toISOString().split('T')[1].substring(0, 5); // HH:MM
      }
      
      if (task?.due_date) {
        const dueDateObj = new Date(task.due_date);
        initialDueDate = dueDateObj.toISOString().split('T')[0];
        initialDueTime = dueDateObj.toISOString().split('T')[1].substring(0, 5); // HH:MM
      }
      
      const initialUserIds = task?.user_ids && Array.isArray(task.user_ids) 
        ? task.user_ids.map((id: any) => Number(id)).filter((n: any) => Number.isFinite(n))
        : [];
      
      console.log('[useFormInitialization] Create mode - initial data:', {
        startDate: initialStartDate,
        startTime: initialStartTime,
        userIds: initialUserIds,
        dueDate: initialDueDate,
        dueTime: initialDueTime,
        hasTaskProp: !!task,
        taskData: task,
        rawUserIds: task?.user_ids,
      });
      
      setStartDate(initialStartDate);
      setStartTime(initialStartTime);
      
      // CRITICAL: Set user IDs from scheduler click IMMEDIATELY
      if (initialUserIds.length > 0) {
        console.log('[useFormInitialization] Setting initial user_ids from scheduler:', initialUserIds);
        setSelectedUserIds(initialUserIds);
      }
      
      setDueDate(initialDueDate);
      setDueTime(initialDueTime);
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
        if (initialUserIds.length === 0) {
          const defaultsUsers = normalizeDefaultUserIds(firstTemplate.default_user_ids);
          console.log('[useFormInitialization] No initial users, using template defaults:', defaultsUsers);
          setSelectedUserIds(defaultsUsers);
        } else {
          console.log('[useFormInitialization] Keeping initial users from task prop:', initialUserIds);
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
      setStartDate('');
      setStartTime('');
      setDueDate('');
      setDueTime('');
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
  }, [open, mode, task?.id, taskTags, taskUsers, workspaceTemplates, workspaceCategories]);
}
