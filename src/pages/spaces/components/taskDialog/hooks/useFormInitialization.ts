import { useEffect, startTransition, useRef } from 'react';
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

  // Track the last task object we initialized with (by reference and key fields)
  const lastInitializedTaskRef = useRef<{ id: number | string | null; hash: string | null }>({ id: null, hash: null });

  useEffect(() => {
    if (!open) {
      formInitializedRef.current = false;
      lastInitializedTaskRef.current = { id: null, hash: null };
      return;
    }
    
    // In edit mode, reset initialization if task changed (ID changed or task object reference changed)
    // This ensures we re-initialize when full task data loads after initial incomplete data
    if (mode === 'edit' && task) {
      const currentTaskId = task.id ? String(task.id) : null;
      // Create a simple hash of key fields to detect if task data changed
      const taskHash = task.id 
        ? `${task.id}-${task.category_id || 'null'}-${task.priority_id || 'null'}-${task.status_id || 'null'}-${task.name || 'null'}`
        : null;
      
      const last = lastInitializedTaskRef.current;
      // Reset if ID changed OR if same ID but task data seems different (more complete)
      if (currentTaskId && (last.id !== currentTaskId || (last.id === currentTaskId && last.hash !== taskHash))) {
        formInitializedRef.current = false;
      }
    }
    
    if (formInitializedRef.current) return;
    
    // Use setTimeout to defer initialization slightly so Sheet can start animating first
    const timer = setTimeout(() => {
      formInitializedRef.current = true;
      if (mode === 'edit' && task?.id) {
        const taskHash = `${task.id}-${task.category_id || 'null'}-${task.priority_id || 'null'}-${task.status_id || 'null'}-${task.name || 'null'}`;
        lastInitializedTaskRef.current = { id: String(task.id), hash: taskHash };
      }

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
      
      // Extract date and time from start_date (avoid timezone conversion)
      if (task.start_date) {
        if (typeof task.start_date === 'string') {
          const [datePart, timePart] = task.start_date.split('T');
          setStartDate(datePart);
          setStartTime(timePart?.substring(0, 5) || '');
        } else {
          const startDateObj = new Date(task.start_date);
          const year = startDateObj.getFullYear();
          const month = String(startDateObj.getMonth() + 1).padStart(2, '0');
          const day = String(startDateObj.getDate()).padStart(2, '0');
          setStartDate(`${year}-${month}-${day}`);
          setStartTime(`${String(startDateObj.getHours()).padStart(2, '0')}:${String(startDateObj.getMinutes()).padStart(2, '0')}`);
        }
      } else {
        setStartDate('');
        setStartTime('');
      }
      
      // Extract date and time from due_date (avoid timezone conversion)
      if (task.due_date) {
        if (typeof task.due_date === 'string') {
          const [datePart, timePart] = task.due_date.split('T');
          setDueDate(datePart);
          setDueTime(timePart?.substring(0, 5) || '');
        } else {
          const dueDateObj = new Date(task.due_date);
          const year = dueDateObj.getFullYear();
          const month = String(dueDateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dueDateObj.getDate()).padStart(2, '0');
          setDueDate(`${year}-${month}-${day}`);
          setDueTime(`${String(dueDateObj.getHours()).padStart(2, '0')}:${String(dueDateObj.getMinutes()).padStart(2, '0')}`);
        }
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
        // Parse as string directly to avoid timezone conversion
        if (typeof task.start_date === 'string') {
          const [datePart, timePart] = task.start_date.split('T');
          initialStartDate = datePart;
          initialStartTime = timePart?.substring(0, 5) || '';
        } else {
          const startDateObj = new Date(task.start_date);
          const year = startDateObj.getFullYear();
          const month = String(startDateObj.getMonth() + 1).padStart(2, '0');
          const day = String(startDateObj.getDate()).padStart(2, '0');
          initialStartDate = `${year}-${month}-${day}`;
          initialStartTime = `${String(startDateObj.getHours()).padStart(2, '0')}:${String(startDateObj.getMinutes()).padStart(2, '0')}`;
        }
      }
      
      if (task?.due_date) {
        // Parse as string directly to avoid timezone conversion
        if (typeof task.due_date === 'string') {
          const [datePart, timePart] = task.due_date.split('T');
          initialDueDate = datePart;
          initialDueTime = timePart?.substring(0, 5) || '';
        } else {
          const dueDateObj = new Date(task.due_date);
          const year = dueDateObj.getFullYear();
          const month = String(dueDateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dueDateObj.getDate()).padStart(2, '0');
          initialDueDate = `${year}-${month}-${day}`;
          initialDueTime = `${String(dueDateObj.getHours()).padStart(2, '0')}:${String(dueDateObj.getMinutes()).padStart(2, '0')}`;
        }
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
      
      // Don't auto-select first template - let user search and select
      setTemplateId(null);
      setName('');
      const defaultCategory = workspaceCategories[0];
      setCategoryId(defaultCategory ? defaultCategory.id : null);
      setPriorityId(null);
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
