import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store/store';
import { addTaskAsync, updateTaskAsync } from '@/store/reducers/tasksSlice';
import { genericActions } from '@/store/genericSlices';
import toast from 'react-hot-toast';
import { useLanguage } from '@/providers/LanguageProvider';

export function useTaskSubmit(params: any) {
  const { t } = useLanguage();
  const {
    mode,
    canSubmit,
    categoryId,
    derivedTeamId,
    userId,
    statusId,
    task,
    categoryInitialStatusId,
    name,
    description,
    priorityId,
    templateId,
    slaId,
    approvalId,
    dueDate,
    selectedUserIds,
    spotsApplicable,
    spotId,
    workspaceId,
    selectedTemplate,
    selectedTagIds,
    taskTagIds,
    taskTags,
    setIsSubmitting,
    onOpenChange,
    syncTaskCustomFields,
  } = params;

  const dispatch = useDispatch<AppDispatch>();

  const handleSubmit = async () => {
    if (!canSubmit || !categoryId || !derivedTeamId || !userId) return;
    if (mode === 'edit' && (!statusId || !task?.id)) return;
    if ((mode === 'create' || mode === 'create-all') && !categoryInitialStatusId) return;

    try {
      setIsSubmitting(true);
      
      if (mode === 'edit') {
        const updates: any = {
          name: name.trim(),
          description: description.trim() || null,
          category_id: categoryId,
          team_id: derivedTeamId,
          priority_id: priorityId ?? 0,
          template_id: templateId,
          sla_id: slaId,
          approval_id: approvalId,
          due_date: dueDate || null,
          user_ids: (Array.isArray(selectedUserIds) && selectedUserIds.length > 0)
            ? selectedUserIds.map((id) => parseInt(String(id), 10)).filter((n) => Number.isFinite(n))
            : [],
        };
        
        if (spotsApplicable) {
          updates.spot_id = spotId;
        }

        await dispatch(updateTaskAsync({ id: Number(task.id), updates })).unwrap();
        
        const currentTagIds = new Set(taskTagIds);
        const newTagIds = new Set(selectedTagIds);
        const tagsToAdd = selectedTagIds.filter((tagId: number) => !currentTagIds.has(tagId));
        const tagsToRemove = taskTagIds.filter((tagId: number) => !newTagIds.has(tagId));
        
        for (const tagId of tagsToAdd) {
          await dispatch(genericActions.taskTags.addAsync({
            task_id: Number(task.id),
            tag_id: tagId,
            user_id: userId,
          })).unwrap();
        }
        
        for (const tagId of tagsToRemove) {
          const taskTag = taskTags.find((tt: any) => 
            tt.task_id === Number(task.id) && tt.tag_id === tagId
          );
          if (taskTag) {
            await dispatch(genericActions.taskTags.removeAsync(taskTag.id)).unwrap();
          }
        }

        await syncTaskCustomFields(Number(task.id));
      } else {
        const payload: any = {
          name: name.trim(),
          description: description.trim() || null,
          workspace_id: workspaceId!,
          category_id: categoryId,
          team_id: derivedTeamId,
          template_id: templateId,
          status_id: categoryInitialStatusId,
          priority_id: priorityId ?? 0,
          sla_id: slaId,
          approval_id: approvalId,
          start_date: null, // Will be set from formState.startDate in TaskDialogContent
          due_date: dueDate || null,
          expected_duration: (() => {
            const v = selectedTemplate?.expected_duration ?? selectedTemplate?.default_duration ?? 0;
            return Number.isFinite(v) ? v : 0;
          })(),
          response_date: null,
          resolution_date: null,
          work_duration: 0,
          pause_duration: 0,
          user_ids: (Array.isArray(selectedUserIds) && selectedUserIds.length > 0)
            ? selectedUserIds.map((id) => parseInt(String(id), 10)).filter((n) => Number.isFinite(n))
            : [],
        };
        
        if (spotsApplicable) {
          payload.spot_id = spotId;
        }

        const result = await dispatch(addTaskAsync(payload)).unwrap();
        const newTaskId = result?.id;
        
        if (mode === 'create' && newTaskId && selectedTagIds.length > 0) {
          for (const tagId of selectedTagIds) {
            await dispatch(genericActions.taskTags.addAsync({
              task_id: Number(newTaskId),
              tag_id: tagId,
              user_id: userId,
            })).unwrap();
          }
        }

        if (newTaskId) {
          await syncTaskCustomFields(Number(newTaskId));
        }
      }
      
      onOpenChange(false);
    } catch (e: any) {
      const errorMessage = e?.message || e?.toString() || 'Failed to create task';
      const status = e?.response?.status || e?.status;
      
      // 403 errors are now handled by API interceptor, only show other errors
      if (status !== 403) {
        toast.error(errorMessage, { duration: 5000 });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return { handleSubmit };
}
