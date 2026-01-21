import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDispatch } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { Button } from '@/components/ui/button';
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/animated/Tabs';
import { genericActions } from '@/store/genericSlices';
import { AppDispatch } from '@/store/store';
import { useLanguage } from '@/providers/LanguageProvider';

import { useTaskDialogData } from './hooks/useTaskDialogData';
import { useTaskFormState } from './hooks/useTaskFormState';
import { useTaskDialogComputed } from './hooks/useTaskDialogComputed';
import { useFormInitialization } from './hooks/useFormInitialization';
import { useCustomFieldSync } from './hooks/useCustomFieldSync';
import { useShareHandlers } from './hooks/useShareHandlers';
import { useIconDefinition } from '../workspaceTable/columnUtils/icon';

import { BasicTab, CustomFieldsTab, AdditionalTab, ShareTab } from './components';

import {
  deserializeCustomFieldValue,
  isCustomFieldValueFilled,
  parseDefaultCustomFieldValue,
} from './utils/customFieldSerialization';
import { normalizeDefaultUserIds } from './utils/fieldHelpers';
import type { TaskDialogProps } from './types';
import { celebrateTaskCompletion } from '@/utils/confetti';
import { createStatusMap } from '../workspaceTable/utils/mappers';

type Props = TaskDialogProps & {
  clickTime?: number;
  perfEnabled?: boolean;
};

// Heavy content component - only mounts after Sheet has rendered
// All heavy hooks are contained here and don't run during the initial Sheet render.
export default function TaskDialogContent({
  open,
  onOpenChange,
  mode,
  workspaceId: propWorkspaceId,
  task,
  clickTime,
  perfEnabled = false,
}: Props) {
  const { t } = useLanguage();
  const dispatch = useDispatch<AppDispatch>();

  const perfRef = useRef<{ marks: Record<string, number> }>({ marks: {} });
  const markOnce = (name: string, start: number, end: number) => {
    if (!perfEnabled) return;
    if (perfRef.current.marks[name] !== undefined) return;
    perfRef.current.marks[name] = end - start;
  };

  useEffect(() => {
    if (!perfEnabled || clickTime == null) return;
    const mountTime = performance.now();
    // eslint-disable-next-line no-console
    console.log(`[PERF] TaskDialog: click→content-mount ${(mountTime - clickTime).toFixed(2)}ms`);
  }, [perfEnabled, clickTime]);

  // Data and state hooks - must be unconditional (React rules)
  const t0 = perfEnabled ? performance.now() : 0;
  const data = useTaskDialogData();
  const t1 = perfEnabled ? performance.now() : 0;
  markOnce('useTaskDialogData', t0, t1);

  const t2 = perfEnabled ? performance.now() : 0;
  const formState = useTaskFormState();
  const t3 = perfEnabled ? performance.now() : 0;
  markOnce('useTaskFormState', t2, t3);
  const { categoryId, templateId, priorityId, activeTab, setActiveTab, formInitializedRef } = formState;

  const [customFieldValues, setCustomFieldValues] = useState<Record<number, any>>({});
  const customFieldValuesRef = useRef<Record<number, any>>({});
  const lastCustomFieldCategoryRef = useRef<number | null>(null);

  // Use deferred values to mark heavy data as non-urgent - allows animation to start first
  const t4 = perfEnabled ? performance.now() : 0;
  const deferredTemplates = useDeferredValue(open ? data.templates : []);
  const deferredCategories = useDeferredValue(open ? data.categories : []);
  const deferredWorkspaces = useDeferredValue(open ? data.workspaces : []);
  const deferredPriorities = useDeferredValue(open ? data.priorities : []);
  const deferredStatuses = useDeferredValue(open ? data.statuses : []);
  const deferredCategoryPriorityAssignments = useDeferredValue(open ? data.categoryPriorityAssignments : []);
  const t5 = perfEnabled ? performance.now() : 0;
  markOnce('useDeferredValue', t4, t5);

  const t6 = perfEnabled ? performance.now() : 0;
  const computed = useTaskDialogComputed({
    mode,
    propWorkspaceId,
    task,
    templates: deferredTemplates,
    templateId,
    categories: deferredCategories,
    workspaces: deferredWorkspaces,
    priorities: deferredPriorities,
    categoryId,
    categoryPriorityAssignments: deferredCategoryPriorityAssignments,
    userTeamIds: data.userTeamIds,
    currentWorkspace: null,
    approvalId: formState.approvalId,
    selectedTemplate: null,
    statuses: deferredStatuses,
    statusTransitions: data.statusTransitions,
  });
  const t7 = perfEnabled ? performance.now() : 0;
  markOnce('useTaskDialogComputed', t6, t7);

  const categoryIconDef = useIconDefinition(open ? (computed.currentCategory?.icon as any) : null, null);

  const t8 = perfEnabled ? performance.now() : 0;
  const selectedApproval = useMemo(() => {
    if (computed.selectedApprovalId == null) return null;
    return data.approvalMap[computed.selectedApprovalId] || null;
  }, [computed.selectedApprovalId, data.approvalMap]);
  const t9 = perfEnabled ? performance.now() : 0;
  markOnce('selectedApproval-memo', t8, t9);

  const t10 = perfEnabled ? performance.now() : 0;
  const workspaceUsers = useMemo(() => {
    if (!open || !computed.workspaceId) return [];
    const filtered = data.users.filter((u: any) => !u.workspace_id || u.workspace_id === computed.workspaceId);
    const seen = new Set();
    return filtered.filter((u: any) => {
      const id = u.id || String(u.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [open, data.users, computed.workspaceId]);
  const t11 = perfEnabled ? performance.now() : 0;
  markOnce('workspaceUsers-memo', t10, t11);

  const t12 = perfEnabled ? performance.now() : 0;
  const workspaceSpots = useMemo(() => {
    if (!open || !computed.workspaceId) return [];
    const typeById = new Map(data.spotTypes.map((st: any) => [st.id, st]));
    return data.spots.filter((s: any) => {
      const st: any = typeById.get(s.spot_type_id);
      return !st?.workspace_id || st.workspace_id === computed.workspaceId;
    });
  }, [open, data.spots, data.spotTypes, computed.workspaceId]);
  const t13 = perfEnabled ? performance.now() : 0;
  markOnce('workspaceSpots-memo', t12, t13);

  const t14 = perfEnabled ? performance.now() : 0;
  const taskTagIds = useMemo(() => {
    if (mode !== 'edit' || !task?.id) return [];
    return data.taskTags.filter((tt: any) => tt.task_id === Number(task.id)).map((tt: any) => Number(tt.tag_id));
  }, [data.taskTags, task?.id, mode]);
  const t15 = perfEnabled ? performance.now() : 0;
  markOnce('taskTagIds-memo', t14, t15);

  const t16 = perfEnabled ? performance.now() : 0;
  const categoryFields = useMemo(() => {
    if (!open || !categoryId) return [];
    const fieldById = new Map(
      data.customFields
        .map((f: any) => [Number(f?.id), f] as [number, any])
        .filter(([id]: [number, any]) => Number.isFinite(id))
    );
    return data.categoryCustomFields
      .filter((ccf: any) => Number(ccf?.category_id ?? ccf?.categoryId) === Number(categoryId))
      .sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0))
      .map((assignment: any) => ({
        assignment,
        field: fieldById.get(Number(assignment?.field_id ?? assignment?.custom_field_id ?? assignment?.fieldId)),
      }))
      .filter((row: any) => !!row.field);
  }, [open, categoryId, data.categoryCustomFields, data.customFields]);
  const t17 = perfEnabled ? performance.now() : 0;
  markOnce('categoryFields-memo', t16, t17);

  const t18 = perfEnabled ? performance.now() : 0;
  const customFieldRequirementMissing = useMemo(() => {
    return categoryFields.some(({ assignment, field }: any) => {
      if (!assignment?.is_required) return false;
      const fid = Number(field?.id);
      return !isCustomFieldValueFilled(field, customFieldValues[fid]);
    });
  }, [categoryFields, customFieldValues]);
  const t19 = perfEnabled ? performance.now() : 0;
  markOnce('customFieldRequirement-memo', t18, t19);

  const t20 = perfEnabled ? performance.now() : 0;
  const canSubmit = useMemo(() => {
    const base =
      formState.name.trim().length > 0 &&
      computed.workspaceId &&
      categoryId &&
      computed.derivedTeamId &&
      !customFieldRequirementMissing;
    if (mode === 'edit') {
      return base && formState.statusId && (priorityId || computed.categoryPriorities.length === 0) && task?.id;
    }
    return base && computed.categoryInitialStatusId && (priorityId || computed.categoryPriorities.length === 0);
  }, [
    formState.name,
    computed.workspaceId,
    categoryId,
    computed.derivedTeamId,
    formState.statusId,
    computed.categoryInitialStatusId,
    priorityId,
    computed.categoryPriorities.length,
    task?.id,
    mode,
    customFieldRequirementMissing,
  ]);
  const t21 = perfEnabled ? performance.now() : 0;
  markOnce('canSubmit-memo', t20, t21);

  // Form initialization
  const t22 = perfEnabled ? performance.now() : 0;
  useFormInitialization({
    open,
    mode,
    task,
    taskTags: data.taskTags,
    taskUsers: data.taskUsers,
    workspaceTemplates: computed.workspaceTemplates,
    workspaceCategories: computed.workspaceCategories,
    formInitializedRef,
    setName: formState.setName,
    setDescription: formState.setDescription,
    setCategoryId: formState.setCategoryId,
    setPriorityId: formState.setPriorityId,
    setSpotId: formState.setSpotId,
    setStatusId: formState.setStatusId,
    setTemplateId: formState.setTemplateId,
    setStartDate: formState.setStartDate,
    setDueDate: formState.setDueDate,
    setSelectedUserIds: formState.setSelectedUserIds,
    setSlaId: formState.setSlaId,
    setApprovalId: formState.setApprovalId,
    setIsSubmitting: formState.setIsSubmitting,
    setActiveTab: formState.setActiveTab,
    setShowDescription: formState.setShowDescription,
    setSelectedTagIds: formState.setSelectedTagIds,
  });
  const t23 = perfEnabled ? performance.now() : 0;
  markOnce('useFormInitialization', t22, t23);

  const t24 = perfEnabled ? performance.now() : 0;
  const { syncTaskCustomFields } = useCustomFieldSync({
    categoryFields,
    customFieldValues,
    taskCustomFieldValues: data.taskCustomFieldValues,
  });
  const t25 = perfEnabled ? performance.now() : 0;
  markOnce('useCustomFieldSync', t24, t25);

  const t26 = perfEnabled ? performance.now() : 0;
  const { handleShare, handleShareChange } = useShareHandlers({
    task,
    shareTeamId: formState.shareTeamId,
    sharePermission: formState.sharePermission,
    shareUserId: formState.shareUserId,
    shareTargetType: formState.shareTargetType,
    setShareBusy: formState.setShareBusy,
    setShareError: formState.setShareError,
    setShareSuccess: formState.setShareSuccess,
    setShareTeamId: formState.setShareTeamId,
    setShareUserId: formState.setShareUserId,
    setSharesRefreshKey: formState.setSharesRefreshKey,
  });
  const t27 = perfEnabled ? performance.now() : 0;
  markOnce('useShareHandlers', t26, t27);

  const handleSubmit = async () => {
    if (!canSubmit || !categoryId || !computed.derivedTeamId || !data.user?.id) return;
    if (mode === 'edit' && (!formState.statusId || !task?.id)) return;
    if ((mode === 'create' || mode === 'create-all') && !computed.categoryInitialStatusId) return;

    try {
      formState.setIsSubmitting(true);

      if (mode === 'edit') {
        const updates: any = {
          name: formState.name.trim(),
          description: formState.description.trim() || null,
          category_id: categoryId,
          team_id: computed.derivedTeamId,
          priority_id: priorityId ?? 0,
          template_id: templateId,
          sla_id: formState.slaId,
          approval_id: formState.approvalId,
          start_date: formState.startDate || null,
          due_date: formState.dueDate || null,
          user_ids:
            Array.isArray(formState.selectedUserIds) && formState.selectedUserIds.length > 0
              ? formState.selectedUserIds
                  .map((id) => parseInt(String(id), 10))
                  .filter((n) => Number.isFinite(n))
              : [],
        };
        if (computed.spotsApplicable) updates.spot_id = formState.spotId;

        await dispatch((await import('@/store/reducers/tasksSlice')).updateTaskAsync({ id: Number(task.id), updates })).unwrap();

        // Check if the task was marked as completed and trigger confetti
        if (updates.status_id) {
          const newStatusMeta = statusMap[Number(updates.status_id)];
          if (newStatusMeta) {
            const action = String(newStatusMeta.action || '').toUpperCase();
            const nameLower = String(newStatusMeta.name || '').toLowerCase();
            // Check for DONE, FINISHED actions, or name includes done/complete/finished
            const isDoneStatus = action === 'DONE' || action === 'FINISHED' || 
                                nameLower.includes('done') || nameLower.includes('complete') || nameLower.includes('finished');
            
            // Check if celebration is enabled for this status
            const celebrationEnabled = (newStatusMeta as any).celebration_enabled !== false; // Default to true if not set
            
            if (isDoneStatus && celebrationEnabled) {
              // Get category celebration effect if available
              const taskCategory = data.categories.find(cat => cat.id === (task?.category_id || categoryId));
              const categoryCelebrationEffect = taskCategory?.celebration_effect;
              celebrateTaskCompletion(categoryCelebrationEffect);
            }
          }
        }

        const currentTagIds = new Set(taskTagIds);
        const newTagIds = new Set(formState.selectedTagIds);
        for (const tagId of formState.selectedTagIds.filter((tagId: number) => !currentTagIds.has(tagId))) {
          await dispatch(genericActions.taskTags.addAsync({ task_id: Number(task.id), tag_id: tagId, user_id: data.user.id })).unwrap();
        }
        for (const tagId of taskTagIds.filter((tagId: number) => !newTagIds.has(tagId))) {
          const taskTag = data.taskTags.find((tt: any) => tt.task_id === Number(task.id) && tt.tag_id === tagId);
          if (taskTag) await dispatch(genericActions.taskTags.removeAsync(taskTag.id)).unwrap();
        }
        await syncTaskCustomFields(Number(task.id));
      } else {
        const payload: any = {
          name: formState.name.trim(),
          description: formState.description.trim() || null,
          workspace_id: computed.workspaceId!,
          category_id: categoryId,
          team_id: computed.derivedTeamId,
          template_id: templateId,
          status_id: computed.categoryInitialStatusId,
          priority_id: priorityId ?? 0,
          sla_id: formState.slaId,
          approval_id: formState.approvalId,
          start_date: formState.startDate || null,
          due_date: formState.dueDate || null,
          expected_duration: Number.isFinite(computed.selectedTemplate?.expected_duration)
            ? computed.selectedTemplate.expected_duration
            : 0,
          response_date: null,
          resolution_date: null,
          work_duration: 0,
          pause_duration: 0,
          user_ids: formState.selectedUserIds.filter((n) => Number.isFinite(n)),
        };
        if (computed.spotsApplicable) payload.spot_id = formState.spotId;

        const result = await dispatch((await import('@/store/reducers/tasksSlice')).addTaskAsync(payload)).unwrap();
        const newTaskId = result?.id;

        if (mode === 'create' && newTaskId && formState.selectedTagIds.length > 0) {
          for (const tagId of formState.selectedTagIds) {
            await dispatch(genericActions.taskTags.addAsync({ task_id: Number(newTaskId), tag_id: tagId, user_id: data.user.id })).unwrap();
          }
        }
        if (newTaskId) await syncTaskCustomFields(Number(newTaskId));
      }

      onOpenChange(false);
    } catch (e: any) {
      const errorMessage = e?.message || 'Failed to save task';
      const status = e?.response?.status;
      const toast = (await import('react-hot-toast')).default;
      // 403 errors are now handled by API interceptor, only show other errors
      if (status !== 403) {
        toast.error(errorMessage, { duration: 5000 });
      }
    } finally {
      formState.setIsSubmitting(false);
    }
  };

  // Initialize custom field values
  useEffect(() => {
    customFieldValuesRef.current = customFieldValues;
  }, [customFieldValues]);

  useEffect(() => {
    if (!open) {
      setCustomFieldValues({});
      lastCustomFieldCategoryRef.current = null;
      return;
    }

    const timer = setTimeout(() => {
      startTransition(() => {
        if (!categoryId || categoryFields.length === 0) {
          setCustomFieldValues({});
          lastCustomFieldCategoryRef.current = categoryId ?? null;
          return;
        }

        const sameCategory = lastCustomFieldCategoryRef.current === categoryId;
        const prevValues = customFieldValuesRef.current;
        const next: Record<number, any> = {};

        for (const { assignment, field } of categoryFields) {
          const fieldId = Number(field?.id);
          if (!Number.isFinite(fieldId)) continue;

          const existing =
            mode === 'edit' && task?.id ? data.taskCustomFieldValueMap.get(`${task.id}:${fieldId}`) : null;
          if (existing) {
            next[fieldId] = deserializeCustomFieldValue(existing, field);
          } else if (sameCategory && prevValues[fieldId] !== undefined) {
            next[fieldId] = prevValues[fieldId];
          } else {
            next[fieldId] = parseDefaultCustomFieldValue(
              assignment?.default_value ?? assignment?.defaultValue,
              field
            );
          }
        }

        setCustomFieldValues(next);
        lastCustomFieldCategoryRef.current = categoryId;
      });
    }, open ? 50 : 0);

    return () => clearTimeout(timer);
  }, [open, categoryId, categoryFields, mode, task?.id, data.taskCustomFieldValueMap]);

  useEffect(() => {
    if (computed.selectedTemplate && (mode === 'create' || mode === 'create-all')) {
      const t = computed.selectedTemplate;
      formState.setCategoryId(t.category_id || categoryId);
      const tplPriority = t.priority_id ?? t.default_priority;
      if (tplPriority) {
        formState.setPriorityId(tplPriority);
      } else {
        const lowPriority = computed.categoryPriorities.find((p: any) => p.name?.toLowerCase() === 'low');
        formState.setPriorityId(lowPriority?.id || null);
      }
      formState.setName(t.name || '');
      formState.setSlaId(t.sla_id || null);
      formState.setApprovalId(t.approval_id || null);
      const spotsNotApplicable = t.spots_not_applicable === true || t.spots_not_applicable === 'true';
      if (spotsNotApplicable) {
        formState.setSpotId(null);
      } else if (t.default_spot_id) {
        formState.setSpotId(t.default_spot_id);
      }
      const defaultsUsers = normalizeDefaultUserIds(t.default_user_ids);
      formState.setSelectedUserIds(defaultsUsers.length > 0 ? defaultsUsers : []);
    }
  }, [computed.selectedTemplate, computed.categoryPriorities, categoryId, mode]);

  useEffect(() => {
    if ((mode === 'create' || mode === 'create-all') && categoryId && !priorityId) {
      const lowPriority = computed.categoryPriorities.find((p: any) => p.name?.toLowerCase() === 'low');
      formState.setPriorityId(lowPriority?.id || computed.categoryPriorities[0]?.id || null);
    }
    if (!categoryId && (mode === 'create' || mode === 'create-all')) formState.setPriorityId(null);
  }, [categoryId, computed.categoryPriorities, priorityId, mode]);

  useEffect(() => {
    if (activeTab === 'customFields' && categoryFields.length === 0) setActiveTab('basic');
  }, [activeTab, categoryFields.length, setActiveTab]);

  const handleCustomFieldValueChange = (fieldId: number, value: any) => {
    setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  if (mode === 'edit' && !task) return null;

  useEffect(() => {
    if (!perfEnabled || clickTime == null) return;
    const now = performance.now();
    // eslint-disable-next-line no-console
    console.log(`[PERF] TaskDialog: click→content-ready ${(now - clickTime).toFixed(2)}ms`, perfRef.current.marks);
  }, [perfEnabled, clickTime]);

  return (
    <>
      <SheetHeader className="relative px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b border-border/40 overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-transparent flex-shrink-0">
        <div className={`flex items-center gap-3 flex-1 min-w-0 ${mode === 'edit' ? 'mb-2' : ''}`}>
          <SheetTitle className="text-xl sm:text-2xl font-semibold font-[600] text-foreground flex-shrink-0">
            {mode === 'edit' ? t('task.editTask', 'Edit Task') : t('task.createNewTask', 'Create New Task')}
          </SheetTitle>
          {categoryId && categoryIconDef && (
            <FontAwesomeIcon
              icon={categoryIconDef}
              style={{ color: computed.currentCategory?.color }}
              className="w-5 h-5 flex-shrink-0"
            />
          )}
          {categoryId && computed.currentCategory && (
            <span className="text-sm text-muted-foreground font-medium whitespace-nowrap truncate">
              {computed.currentCategory.name}
            </span>
          )}
        </div>
        <SheetDescription className="sr-only">
          {mode === 'edit'
            ? 'Edit task details including name, description, status, priority, and more.'
            : 'Create a new task with details like name, description, status, priority, and assignments.'}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col flex-1 min-h-0 overflow-auto">
        <div className="px-4 sm:px-6 pt-2 sm:pt-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="inline-flex h-auto p-0 pr-6 bg-transparent border-b border-border/40 rounded-none gap-0 w-full overflow-x-auto">
              <TabsTrigger
                value="basic"
                className="px-0 py-3 mr-4 sm:mr-8 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none transition-all duration-150 ease-in-out"
              >
                {t('taskDialog.basicDetails', 'Basic Details')}
              </TabsTrigger>
              {categoryFields.length > 0 && (
                <TabsTrigger
                  value="customFields"
                  className="px-0 py-3 mr-4 sm:mr-8 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none transition-all duration-150 ease-in-out"
                >
                  {t('taskDialog.fields', 'Fields')}
                  {customFieldRequirementMissing && (
                    <span className="ml-2 text-[11px] text-red-500 font-semibold align-middle">●</span>
                  )}
                </TabsTrigger>
              )}
              <TabsTrigger
                value="additional"
                className="px-0 py-3 mr-4 sm:mr-8 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none transition-all duration-150 ease-in-out"
              >
                {t('taskDialog.additionalInfo', 'Additional Info')}
              </TabsTrigger>
              {mode === 'edit' && (
                <TabsTrigger
                  value="share"
                  className="px-0 py-3 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none transition-all duration-150 ease-in-out"
                >
                  {t('taskDialog.share', 'Share')}
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="basic" className="mt-0 pt-4 sm:pt-6 pb-6 data-[state=inactive]:hidden">
              <BasicTab
                {...{
                  mode,
                  workspaceTemplates: computed.workspaceTemplates,
                  workspaceCategories: computed.workspaceCategories,
                  categories: data.categories,
                  categoryId,
                  setCategoryId: formState.setCategoryId,
                  name: formState.name,
                  setName: formState.setName,
                  templateId,
                  setTemplateId: formState.setTemplateId,
                  currentWorkspace: computed.currentWorkspace,
                  selectedApprovalId: computed.selectedApprovalId,
                  selectedApproval,
                  isReportingCategory: computed.isReportingCategory,
                  currentCategory: computed.currentCategory,
                  showDescription: formState.showDescription,
                  setShowDescription: formState.setShowDescription,
                  description: formState.description,
                  setDescription: formState.setDescription,
                  spotsApplicable: computed.spotsApplicable,
                  selectedTemplate: computed.selectedTemplate,
                  workspaceSpots,
                  spotId: formState.spotId,
                  setSpotId: formState.setSpotId,
                  workspaceUsers,
                  selectedUserIds: formState.selectedUserIds,
                  setSelectedUserIds: formState.setSelectedUserIds,
                  categoryPriorities: computed.categoryPriorities,
                  priorityId,
                  setPriorityId: formState.setPriorityId,
                }}
              />
            </TabsContent>

            {categoryFields.length > 0 && (
              <TabsContent value="customFields" className="mt-0 pt-4 sm:pt-6 pb-6 data-[state=inactive]:hidden">
                <CustomFieldsTab
                  categoryId={categoryId}
                  categoryFields={categoryFields}
                  customFieldValues={customFieldValues}
                  handleCustomFieldValueChange={handleCustomFieldValueChange}
                />
              </TabsContent>
            )}

            <TabsContent value="additional" className="mt-0 pt-4 sm:pt-6 pb-6 data-[state=inactive]:hidden">
              <AdditionalTab
                mode={mode}
                tags={data.tags}
                selectedTagIds={formState.selectedTagIds}
                setSelectedTagIds={formState.setSelectedTagIds}
                slas={data.slas}
                slaId={formState.slaId}
                setSlaId={formState.setSlaId}
                approvals={data.approvals}
                approvalId={formState.approvalId}
                setApprovalId={formState.setApprovalId}
                startDate={formState.startDate}
                setStartDate={formState.setStartDate}
                dueDate={formState.dueDate}
                setDueDate={formState.setDueDate}
              />
            </TabsContent>

            {mode === 'edit' && (
              <TabsContent value="share" className="mt-0 pt-4 sm:pt-6 pb-6 data-[state=inactive]:hidden">
                <ShareTab
                  task={task}
                  sharesRefreshKey={formState.sharesRefreshKey}
                  handleShareChange={handleShareChange}
                  shareTargetType={formState.shareTargetType}
                  setShareTargetType={formState.setShareTargetType}
                  setShareUserId={formState.setShareUserId}
                  setShareTeamId={formState.setShareTeamId}
                  shareUserId={formState.shareUserId}
                  users={data.users}
                  user={data.user}
                  shareTeamId={formState.shareTeamId}
                  teams={data.teams}
                  sharePermission={formState.sharePermission}
                  setSharePermission={formState.setSharePermission}
                  handleShare={handleShare}
                  shareBusy={formState.shareBusy}
                  shareError={formState.shareError}
                  shareSuccess={formState.shareSuccess}
                />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-border/40 px-4 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-6 bg-background">
        <div className={`flex ${mode === 'create-all' ? 'flex-col sm:flex-row items-stretch sm:items-center' : 'items-center'} justify-end gap-3`}>
          <Button
            variant={mode === 'create-all' ? 'ghost' : 'outline'}
            onClick={() => onOpenChange(false)}
            disabled={formState.isSubmitting}
            className={
              mode === 'create-all'
                ? 'h-12 px-6 text-muted-foreground border border-border bg-transparent hover:bg-muted rounded-[10px] transition-all duration-200 font-medium order-3 sm:order-2'
                : 'h-11 px-6 rounded-[10px] font-medium transition-all duration-150'
            }
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || formState.isSubmitting}
            className={
              mode === 'create-all'
                ? 'h-12 px-8 bg-primary hover:opacity-90 text-primary-foreground rounded-[10px] transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-3'
                : 'h-11 px-6 rounded-[10px] font-medium bg-primary hover:opacity-90 text-primary-foreground transition-all duration-150'
            }
          >
            {formState.isSubmitting
              ? mode === 'edit'
                ? t('task.saving', 'Saving...')
                : t('task.creating', 'Creating...')
              : mode === 'edit'
                ? t('task.saveChanges', 'Save Changes')
                : t('task.createTask', 'Create Task')}
          </Button>
        </div>
      </div>
    </>
  );
}

