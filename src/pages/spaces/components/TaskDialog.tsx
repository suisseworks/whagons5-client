import { useEffect, useMemo, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addTaskAsync, updateTaskAsync } from '@/store/reducers/tasksSlice';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { iconService } from '@/database/iconService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/animated/Tabs';
import { Combobox } from '@/components/ui/combobox';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { TagMultiSelect } from '@/components/ui/tag-multi-select';
import { ChevronUp, Plus } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { genericActions } from '@/store/genericSlices';

type TaskDialogMode = 'create' | 'edit' | 'create-all';

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: TaskDialogMode;
  workspaceId?: number; // Required for 'create' mode
  task?: any | null; // Required for 'edit' mode
}

export default function TaskDialog({ open, onOpenChange, mode, workspaceId: propWorkspaceId, task }: TaskDialogProps) {
  const dispatch = useDispatch<AppDispatch>();

  const { value: categories = [] } = useSelector((s: RootState) => (s as any).categories || { value: [] });
  const { value: priorities = [] } = useSelector((s: RootState) => (s as any).priorities || { value: [] });
  const { value: statuses = [] } = useSelector((s: RootState) => (s as any).statuses || { value: [] });
  const { value: spots = [] } = useSelector((s: RootState) => (s as any).spots || { value: [] });
  const { value: users = [] } = useSelector((s: RootState) => (s as any).users || { value: [] });
  const { value: spotTypes = [] } = useSelector((s: RootState) => (s as any).spotTypes || { value: [] });
  const { value: workspaces = [] } = useSelector((s: RootState) => (s as any).workspaces || { value: [] });
  const { value: slas = [] } = useSelector((s: RootState) => (s as any).slas || { value: [] });
  const { value: approvals = [] } = useSelector((s: RootState) => (s as any).approvals || { value: [] });
  const { value: templates = [] } = useSelector((s: RootState) => (s as any).templates || { value: [] });
  const { value: tags = [] } = useSelector((s: RootState) => (s as any).tags || { value: [] });
  const { value: taskTags = [] } = useSelector((s: RootState) => (s as any).taskTags || { value: [] });
  
  const { user } = useAuth();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [priorityId, setPriorityId] = useState<number | null>(null);
  const [spotId, setSpotId] = useState<number | null>(null);
  const [statusId, setStatusId] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);

  // For create-all mode: derive workspace from selected template's category
  const derivedWorkspaceId = useMemo(() => {
    if (mode !== 'create-all' || !templateId) return null;
    const template = templates.find((t: any) => 
      t.id === templateId || 
      Number(t.id) === Number(templateId) ||
      String(t.id) === String(templateId)
    );
    if (!template) {
      console.log('[TaskDialog] Template not found for templateId:', templateId, 'available templates:', templates.map((t: any) => t.id));
      return null;
    }
    if (!template.category_id) {
      console.log('[TaskDialog] Template has no category_id:', template);
      return null;
    }
    const cat = categories.find((c: any) => 
      c.id === template.category_id || 
      Number(c.id) === Number(template.category_id) ||
      String(c.id) === String(template.category_id)
    );
    if (!cat) {
      console.log('[TaskDialog] Category not found for category_id:', template.category_id, 'available categories:', categories.map((c: any) => c.id));
      return null;
    }
    const wsId = cat.workspace_id;
    console.log('[TaskDialog] Derived workspaceId:', wsId, 'from template:', template.name, 'category:', cat.name);
    return wsId || null;
  }, [mode, templates, templateId, categories]);

  // Determine workspace ID based on mode
  const workspaceId = useMemo(() => {
    if (mode === 'create' && propWorkspaceId) return propWorkspaceId;
    if (mode === 'edit' && task?.workspace_id) return Number(task.workspace_id);
    if (mode === 'create-all' && derivedWorkspaceId) return derivedWorkspaceId;
    return null;
  }, [mode, propWorkspaceId, task?.workspace_id, derivedWorkspaceId]);

  const currentWorkspace = useMemo(() => {
    if (!workspaceId) return null;
    return workspaces.find((w: any) => w.id === workspaceId);
  }, [workspaces, workspaceId]);

  const workspaceCategories = useMemo(() => {
    if (!workspaceId) return [];
    return categories.filter((c: any) => c.workspace_id === workspaceId);
  }, [categories, workspaceId]);
  const [dueDate, setDueDate] = useState<string>('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryIcon, setCategoryIcon] = useState<any>(null);
  const [slaId, setSlaId] = useState<number | null>(null);
  const [approvalId, setApprovalId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [showDescription, setShowDescription] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const derivedTeamId = useMemo(() => {
    if (!categoryId) return null;
    const cat = workspaceCategories.find((c: any) => c.id === categoryId);
    return cat?.team_id || null;
  }, [workspaceCategories, categoryId]);

  const currentCategory = useMemo(() => {
    return categories.find((c: any) => c.id === categoryId);
  }, [categories, categoryId]);

  const categoryInitialStatusId = useMemo(() => {
    if (mode === 'edit') return null; // Edit mode uses existing status
    const initial = (statuses || []).find((s: any) => s.initial === true);
    return (initial || statuses[0])?.id || null;
  }, [statuses, mode]);

  // Load category icon
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cat = categories.find((c: any) => c.id === categoryId);
        if (cat?.icon) {
          const icon = await iconService.getIcon(cat.icon);
          if (!cancelled) setCategoryIcon(icon);
        } else {
          if (!cancelled) setCategoryIcon(null);
        }
      } catch {
        if (!cancelled) setCategoryIcon(null);
      }
    })();
    return () => { cancelled = true; };
  }, [categories, categoryId]);

  const categoryPriorities = useMemo(() => {
    if (!categoryId) {
      if (mode === 'create' || mode === 'create-all') {
        return priorities.filter((p: any) => p.category_id === null || p.category_id === undefined);
      }
      return [];
    }
    
    const categorySpecific = priorities.filter((p: any) => p.category_id === categoryId);
    if (categorySpecific.length > 0) {
      return categorySpecific;
    }
    
    return priorities.filter((p: any) => p.category_id === null || p.category_id === undefined);
  }, [priorities, categoryId, mode]);

  // For create-all mode: show all templates from all DEFAULT workspaces
  // For other modes: show templates filtered by current workspace
  const workspaceTemplates = useMemo(() => {
    if (mode === 'create-all') {
      // Show all enabled templates from DEFAULT workspaces
      return templates.filter((template: any) => {
        if (template?.enabled === false) return false;
        // Find the category for this template
        const cat = categories.find((c: any) => c.id === template.category_id);
        if (!cat) return false;
        // Find the workspace for this category
        const ws = workspaces.find((w: any) => w.id === cat.workspace_id);
        // Only show templates from DEFAULT workspaces
        return ws?.type === "DEFAULT";
      });
    }
    
    // For create and edit modes: filter by current workspace
    if (!currentWorkspace || currentWorkspace.type !== "DEFAULT") {
      return [];
    }
    return templates.filter((template: any) => {
      if (template?.enabled === false) return false;
      return template.category_id === currentWorkspace.category_id;
    });
  }, [templates, currentWorkspace, mode, categories, workspaces]);

  const selectedTemplate = useMemo(() => {
    if (!templateId) return null;
    // Always search in all templates to find the selected one
    const found = templates.find((t: any) => 
      t.id === templateId || 
      Number(t.id) === Number(templateId) ||
      String(t.id) === String(templateId)
    );
    return found || null;
  }, [templateId, templates]);

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

  const workspaceUsers = useMemo(() => {
    if (!workspaceId) return [];
    const filtered = users.filter((u: any) => !u.workspace_id || u.workspace_id === workspaceId);
    // Deduplicate by ID to prevent duplicate entries
    const seen = new Set();
    return filtered.filter((u: any) => {
      const id = u.id || String(u.id);
      if (seen.has(id)) {https://whagons-ybrywmmd5i.whagons.com/auth/invitation/31385943-6da4-44e1-86b7-6a7b9093514c
        return false;
      }
      seen.add(id);
      return true;
    });
  }, [users, workspaceId]);

  const workspaceSpots = useMemo(() => {
    if (!workspaceId) return [];
    const typeById = new Map(spotTypes.map((st: any) => [st.id, st]));
    return spots.filter((s: any) => {
      const st: any = typeById.get(s.spot_type_id);
      return !st?.workspace_id || st.workspace_id === workspaceId;
    });
  }, [spots, spotTypes, workspaceId]);


  // Get tags for edit mode
  const taskTagIds = useMemo(() => {
    if (mode !== 'edit' || !task?.id) return [];
    return taskTags
      .filter((tt: any) => tt.task_id === Number(task.id))
      .map((tt: any) => Number(tt.tag_id));
  }, [taskTags, task?.id, mode]);

  // Load tags when dialog opens
  useEffect(() => {
    if (open && (mode === 'create' || mode === 'edit')) {
      dispatch(genericActions.tags.getFromIndexedDB());
      if (mode === 'edit') {
        dispatch(genericActions.taskTags.getFromIndexedDB());
      }
    }
  }, [open, mode, dispatch]);

  // Track if form has been initialized to prevent resetting user selections
  const formInitializedRef = useRef(false);

  // Initialize form data - only when dialog opens/closes or mode/task changes
  useEffect(() => {
    if (!open) {
      formInitializedRef.current = false;
      return;
    }

    // Only initialize once when dialog opens
    if (formInitializedRef.current) return;
    formInitializedRef.current = true;

    if (mode === 'edit' && task) {
      // Edit mode: load from task
      setName(task.name || '');
      setDescription(task.description || '');
      setCategoryId(task.category_id ? Number(task.category_id) : null);
      setPriorityId(task.priority_id ? Number(task.priority_id) : null);
      setSpotId(task.spot_id ? Number(task.spot_id) : null);
      setStatusId(task.status_id ? Number(task.status_id) : null);
      setTemplateId(task.template_id ? Number(task.template_id) : null);
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
      // Create mode: reset form and prefill defaults
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
      
      // Prefill defaults
      const firstTemplate = workspaceTemplates[0];
      if (firstTemplate) {
        setTemplateId(firstTemplate.id);
        setCategoryId(firstTemplate.category_id || null);
        setPriorityId(firstTemplate.default_priority || null);
        setName(firstTemplate.name || '');
        setSlaId(firstTemplate.sla_id || null);
        setApprovalId(firstTemplate.approval_id || null);
        const spotsNotApplicable = firstTemplate.spots_not_applicable === true || firstTemplate.spots_not_applicable === 'true';
        if (spotsNotApplicable) {
          setSpotId(null);
        } else if (firstTemplate.default_spot_id) {
          setSpotId(firstTemplate.default_spot_id);
        }
      } else {
        setTemplateId(null);
        setName('');
        const defaultCategory = workspaceCategories[0];
        setCategoryId(defaultCategory ? defaultCategory.id : null);
        setPriorityId(null);
      }
    } else if (mode === 'create-all') {
      // Create-all mode: reset form only on initial open
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
  }, [open, mode, task?.id, taskTags]);
  
  // Separate effect for create mode to prefill defaults when workspaceTemplates/workspaceCategories become available
  useEffect(() => {
    if (!open || mode !== 'create' || formInitializedRef.current) return;
    
    // Only prefill if form is still empty (hasn't been touched)
    if (!templateId && !categoryId && workspaceTemplates.length > 0) {
      const firstTemplate = workspaceTemplates[0];
      if (firstTemplate) {
        setTemplateId(firstTemplate.id);
        setCategoryId(firstTemplate.category_id || null);
        setPriorityId(firstTemplate.default_priority || null);
        setName(firstTemplate.name || '');
        setSlaId(firstTemplate.sla_id || null);
        setApprovalId(firstTemplate.approval_id || null);
        const spotsNotApplicable = firstTemplate.spots_not_applicable === true || firstTemplate.spots_not_applicable === 'true';
        if (spotsNotApplicable) {
          setSpotId(null);
        } else if (firstTemplate.default_spot_id) {
          setSpotId(firstTemplate.default_spot_id);
        }
      }
    } else if (!categoryId && workspaceCategories.length > 0) {
      const defaultCategory = workspaceCategories[0];
      if (defaultCategory) {
        setCategoryId(defaultCategory.id);
      }
    }
  }, [open, mode, workspaceTemplates, workspaceCategories, templateId, categoryId]);

  // Handle template selection for create-all mode: derive workspace and category from template
  useEffect(() => {
    if (mode === 'create-all' && selectedTemplate) {
      const t = selectedTemplate;
      // Set category from template
      setCategoryId(t.category_id || null);
      // Priority, name, SLA, approval will be set by the template change effect below
    }
  }, [mode, selectedTemplate]);

  // Template change effects
  useEffect(() => {
    if (selectedTemplate && (mode === 'create' || mode === 'create-all')) {
      const t = selectedTemplate;
      setCategoryId(t.category_id || categoryId);
      if (t.default_priority) {
        setPriorityId(t.default_priority);
      } else {
        const lowPriority = categoryPriorities.find((p: any) => 
          p.name?.toLowerCase() === 'low'
        );
        setPriorityId(lowPriority?.id || null);
      }
      setName(t.name || '');
      setSlaId(t.sla_id || null);
      setApprovalId(t.approval_id || null);
      const spotsNotApplicable = t.spots_not_applicable === true || t.spots_not_applicable === 'true';
      if (spotsNotApplicable) {
        setSpotId(null);
      } else if (t.default_spot_id) {
        setSpotId(t.default_spot_id);
      }
    }
  }, [selectedTemplate, categoryPriorities, categoryId, mode]);

  // Category change effects
  useEffect(() => {
    if ((mode === 'create' || mode === 'create-all') && categoryId && !priorityId) {
      const lowPriority = categoryPriorities.find((p: any) => 
        p.name?.toLowerCase() === 'low'
      );
      if (lowPriority) {
        setPriorityId(lowPriority.id);
      } else {
        const firstPriority = categoryPriorities[0]?.id ?? null;
        setPriorityId(firstPriority);
      }
    }
    if (!categoryId && (mode === 'create' || mode === 'create-all')) {
      setPriorityId(null);
    }
  }, [categoryId, categoryPriorities, priorityId, mode]);

  const canSubmit = useMemo(() => {
    if (mode === 'edit') {
      return Boolean(
        name.trim().length > 0 &&
        workspaceId &&
        categoryId &&
        derivedTeamId &&
        statusId &&
        (priorityId || categoryPriorities.length === 0) &&
        task?.id
      );
    } else {
      return Boolean(
        name.trim().length > 0 &&
        workspaceId &&
        categoryId &&
        derivedTeamId &&
        categoryInitialStatusId &&
        (priorityId || categoryPriorities.length === 0)
      );
    }
  }, [name, workspaceId, categoryId, derivedTeamId, statusId, categoryInitialStatusId, priorityId, categoryPriorities.length, task?.id, mode]);

  const handleSubmit = async () => {
    if (!canSubmit || !categoryId || !derivedTeamId || !user?.id) return;
    if (mode === 'edit' && (!statusId || !task?.id)) return;
    if ((mode === 'create' || mode === 'create-all') && !categoryInitialStatusId) return;

    try {
      setIsSubmitting(true);
      
      if (mode === 'edit') {
        // Edit mode: update task
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
        
        // Handle tag assignments
        const currentTagIds = new Set(taskTagIds);
        const newTagIds = new Set(selectedTagIds);
        const tagsToAdd = selectedTagIds.filter((tagId: number) => !currentTagIds.has(tagId));
        const tagsToRemove = taskTagIds.filter((tagId: number) => !newTagIds.has(tagId));
        
        for (const tagId of tagsToAdd) {
          await dispatch(genericActions.taskTags.addAsync({
            task_id: Number(task.id),
            tag_id: tagId,
            user_id: user.id,
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
      } else {
        // Create modes: add task
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
          start_date: null,
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
        
        // Create task tags if any tags were selected (only for create mode, not create-all)
        if (mode === 'create' && newTaskId && selectedTagIds.length > 0) {
          for (const tagId of selectedTagIds) {
            await dispatch(genericActions.taskTags.addAsync({
              task_id: Number(newTaskId),
              tag_id: tagId,
              user_id: user.id,
            })).unwrap();
          }
        }
      }
      
      onOpenChange(false);
    } catch (e) {
      // Error is handled by slice; keep dialog open for correction
    } finally {
      setIsSubmitting(false);
    }
  };


  // Early return for edit mode if no task
  if (mode === 'edit' && !task) return null;

  // Main form (create, edit, or create-all after category selection)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        onInteractOutside={(e) => {
          if (isSubmitting) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (!isSubmitting) {
            onOpenChange(false);
          } else {
            e.preventDefault();
          }
        }}
        className={`w-full ${mode === 'create-all' ? 'sm:w-[800px] max-w-[800px]' : 'sm:w-[1120px] max-w-[1120px]'} p-0 m-0 top-0 gap-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 flex flex-col h-full`}
      >
        {/* Header Section - Fixed */}
        <SheetHeader className="relative px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b border-border/40 overflow-hidden bg-gradient-to-br from-[#00BFA5]/5 via-transparent to-transparent flex-shrink-0">
          <div className={`flex items-center gap-3 flex-1 min-w-0 ${mode === 'edit' ? 'mb-2' : ''}`}>
            <SheetTitle className="text-xl sm:text-2xl font-semibold font-[600] text-foreground flex-shrink-0">
              {mode === 'edit' ? 'Edit Task' : 'Create New Task'}
            </SheetTitle>
            {categoryId && categoryIcon && (
              <FontAwesomeIcon
                icon={categoryIcon}
                style={{ color: currentCategory?.color }}
                className="w-5 h-5 flex-shrink-0"
              />
            )}
            {categoryId && currentCategory && (
              <span className="text-sm text-[#6B7280] font-medium whitespace-nowrap truncate">
                {currentCategory.name}
              </span>
            )}
          </div>
          {mode === 'edit' && (
            <SheetDescription className="text-sm text-[#6B7280] mt-1">
              Update task details and configuration.
            </SheetDescription>
          )}
        </SheetHeader>

        {/* Content Area - Scrollable */}
        <div className="flex flex-col flex-1 min-h-0 overflow-auto">
          {/* Tabs Navigation */}
          <div className="px-4 sm:px-6 pt-4 sm:pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="inline-flex h-auto p-0 bg-transparent border-b border-border/40 rounded-none gap-0 w-full">
                <TabsTrigger 
                  value="basic" 
                  className="px-0 py-3 mr-4 sm:mr-8 text-sm font-medium text-[#6B7280] data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-[#00BFA5] rounded-none transition-all duration-150 ease-in-out"
                >
                  Basic Details
                </TabsTrigger>
                <TabsTrigger 
                  value="additional" 
                  className="px-0 py-3 text-sm font-medium text-[#6B7280] data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-[#00BFA5] rounded-none transition-all duration-150 ease-in-out"
                >
                  Additional Info
                </TabsTrigger>
              </TabsList>
              
              {/* Basic Details Tab */}
              <TabsContent value="basic" className="mt-0 pt-4 sm:pt-6 px-4 sm:px-6 pb-6 space-y-4 data-[state=inactive]:hidden">
                {/* Template Selection */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="template" className="text-sm font-medium font-[500] text-foreground">
                    Template
                  </Label>
                  {mode === 'create-all' ? (
                    // For create-all mode: show all templates from all DEFAULT workspaces
                    workspaceTemplates.length === 0 ? (
                      <div className="[&_button]:border [&_button]:border-black/8 [&_button]:bg-[#F8F9FA] [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-black/12 [&_button]:focus-visible:border-[#00BFA5] [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-[#00BFA5]/10 [&_button]:focus-visible:bg-background">
                        <Combobox
                          options={[]}
                          value={undefined}
                          onValueChange={() => {}}
                          placeholder="No templates available"
                          searchPlaceholder="Search templates..."
                          emptyText="No templates available"
                          className="w-full"
                        />
                      </div>
                    ) : (
                      <div className="[&_button]:border [&_button]:border-black/8 [&_button]:bg-[#F8F9FA] [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-black/12 [&_button]:focus-visible:border-[#00BFA5] [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-[#00BFA5]/10 [&_button]:focus-visible:bg-background">
                        <Combobox
                          options={workspaceTemplates.map((t: any) => ({
                            value: String(t.id),
                            label: t.name,
                          }))}
                          value={templateId ? String(templateId) : undefined}
                          onValueChange={(v) => {
                            // Always set the template, don't allow deselection by clicking the same item
                            if (v) {
                              const newTemplateId = parseInt(v, 10);
                              console.log('[TaskDialog create-all] Setting templateId:', newTemplateId, 'from value:', v);
                              setTemplateId(newTemplateId);
                            } else {
                              console.log('[TaskDialog create-all] Template deselected, ignoring');
                            }
                          }}
                          placeholder="Select template"
                          searchPlaceholder="Search templates..."
                          emptyText="No templates found."
                          className="w-full"
                        />
                      </div>
                    )
                  ) : (
                    // For create and edit modes: show templates filtered by workspace
                    !currentWorkspace || currentWorkspace.type !== "DEFAULT" ? (
                      <div className="[&_button]:border [&_button]:border-black/8 [&_button]:bg-[#F8F9FA] [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-black/12 [&_button]:focus-visible:border-[#00BFA5] [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-[#00BFA5]/10 [&_button]:focus-visible:bg-background">
                        <Combobox
                          options={[]}
                          value={undefined}
                          onValueChange={() => {}}
                          placeholder="Templates only available for default workspaces"
                          searchPlaceholder="Search templates..."
                          emptyText="No templates available"
                          className="w-full"
                        />
                      </div>
                    ) : workspaceTemplates.length === 0 ? (
                      <div className="[&_button]:border [&_button]:border-black/8 [&_button]:bg-[#F8F9FA] [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-black/12 [&_button]:focus-visible:border-[#00BFA5] [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-[#00BFA5]/10 [&_button]:focus-visible:bg-background">
                        <Combobox
                          options={[]}
                          value={undefined}
                          onValueChange={() => {}}
                          placeholder="No templates available"
                          searchPlaceholder="Search templates..."
                          emptyText="No templates available"
                          className="w-full"
                        />
                      </div>
                    ) : (
                      <div className="[&_button]:border [&_button]:border-black/8 [&_button]:bg-[#F8F9FA] [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-black/12 [&_button]:focus-visible:border-[#00BFA5] [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-[#00BFA5]/10 [&_button]:focus-visible:bg-background">
                        <Combobox
                          options={workspaceTemplates.map((t: any) => ({
                            value: String(t.id),
                            label: t.name,
                          }))}
                          value={templateId ? String(templateId) : undefined}
                          onValueChange={(v) => {
                            // Always set the template, don't allow deselection by clicking the same item
                            if (v) {
                              setTemplateId(parseInt(v, 10));
                            }
                          }}
                          placeholder="Select template"
                          searchPlaceholder="Search templates..."
                          emptyText="No templates found."
                          className="w-full"
                        />
                      </div>
                    )
                  )}
                  {!workspaceTemplates.length && (
                    <p className="text-xs text-[#6B7280] mt-1">
                      {mode === 'create-all'
                        ? 'No templates available. Enable or create templates in default workspaces first.'
                        : !currentWorkspace || currentWorkspace.type !== "DEFAULT"
                        ? 'Templates are only available for default workspaces.'
                        : 'No templates available in this workspace. Enable or create templates first.'
                      }
                    </p>
                  )}
                </div>

                {/* Description - Collapsible */}
                {!showDescription && !description.trim() ? (
                  <button
                    type="button"
                    onClick={() => setShowDescription(true)}
                    className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-foreground transition-colors duration-150 py-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add description</span>
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="task-desc" className="text-sm font-medium font-[500] text-foreground">
                        Description
                      </Label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDescription(false);
                          if (!description.trim()) {
                            setDescription('');
                          }
                        }}
                        className="text-[#6B7280] hover:text-foreground transition-colors duration-150 p-1"
                        aria-label="Hide description"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                    </div>
                    <Textarea 
                      id="task-desc" 
                      value={description} 
                      onChange={(e) => {
                        setDescription(e.target.value);
                        if (e.target.value.trim() && !showDescription) {
                          setShowDescription(true);
                        }
                      }}
                      placeholder="Add a description for this task..." 
                      className="min-h-[120px] px-4 py-4 rounded-[12px] text-sm resize-y focus:border-[#00BFA5] focus:ring-[3px] focus:ring-[#00BFA5]/10 transition-all duration-150" 
                    />
                  </div>
                )}

                {/* Location */}
                {(() => {
                  if (!spotsApplicable) return null;
                  if (selectedTemplate) {
                    const spotsNotApplicableValue = selectedTemplate.spots_not_applicable;
                    const isNotApplicable = 
                      spotsNotApplicableValue === true || 
                      spotsNotApplicableValue === 'true' || 
                      spotsNotApplicableValue === 1 || 
                      spotsNotApplicableValue === '1';
                    if (isNotApplicable) return null;
                  }
                  
                  return (
                    <div className="flex flex-col gap-2">
                      <Label className="text-sm font-medium font-[500] text-foreground">
                        Location
                      </Label>
                      <div className="[&_button]:border [&_button]:border-black/8 [&_button]:bg-[#F8F9FA] [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-black/12 [&_button]:focus-visible:border-[#00BFA5] [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-[#00BFA5]/10 [&_button]:focus-visible:bg-background">
                        <Combobox
                          options={workspaceSpots.map((s: any) => ({
                            value: String(s.id),
                            label: s.name,
                          }))}
                          value={spotId ? String(spotId) : undefined}
                          onValueChange={(v) => setSpotId(v ? parseInt(v, 10) : null)}
                          placeholder={workspaceSpots.length ? 'Select location' : 'No spots'}
                          searchPlaceholder="Search locations..."
                          emptyText="No locations found."
                          className="w-full"
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Responsible */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium font-[500] text-foreground">
                    Responsible
                  </Label>
                  <div className="[&_button]:border [&_button]:border-black/8 [&_button]:bg-[#F8F9FA] [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-black/12 [&_button]:focus-visible:border-[#00BFA5] [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-[#00BFA5]/10 [&_button]:focus-visible:bg-background">
                    <MultiSelectCombobox
                      options={workspaceUsers.map((u: any) => ({
                        value: String(u.id),
                        label: u.name || u.email || `User ${u.id}`,
                      }))}
                      value={selectedUserIds.map((id) => String(id))}
                      onValueChange={(values) => {
                        setSelectedUserIds(values.map((v) => parseInt(v, 10)).filter((n) => Number.isFinite(n)));
                      }}
                      placeholder="Select users..."
                      searchPlaceholder="Search users..."
                      emptyText="No users found."
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Priority */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium font-[500] text-foreground">
                    Priority
                  </Label>
                  <Select value={priorityId ? String(priorityId) : ""} onValueChange={(v) => setPriorityId(v ? parseInt(v, 10) : null)}>
                    <SelectTrigger 
                      className="h-10 px-4 border border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background"
                    >
                      <SelectValue placeholder={categoryPriorities.length ? 'Select priority' : 'No priorities'} />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryPriorities.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-2 h-2 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: p.color }}
                            />
                            <span>{p.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tags - Only for create and edit modes */}
                {(mode === 'create' || mode === 'edit') && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium font-[500] text-foreground">
                      Tags
                    </Label>
                    <div className="[&_button]:border [&_button]:border-black/8 [&_button]:bg-[#F8F9FA] [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-black/12 [&_button]:focus-visible:border-[#00BFA5] [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-[#00BFA5]/10 [&_button]:focus-visible:bg-background">
                      <TagMultiSelect
                        tags={tags}
                        value={selectedTagIds}
                        onValueChange={(values) => {
                          setSelectedTagIds(values);
                        }}
                        placeholder="Select tags..."
                        searchPlaceholder="Search tags..."
                        emptyText="No tags found."
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Additional Info Tab */}
              <TabsContent value="additional" className="mt-0 pt-4 sm:pt-6 px-4 sm:px-6 pb-6 space-y-4 data-[state=inactive]:hidden">
                {/* Due Date */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="due" className="text-sm font-medium font-[500] text-foreground">
                    Due Date
                  </Label>
                  <Input 
                    id="due" 
                    type="date" 
                    value={dueDate} 
                    onChange={(e) => setDueDate(e.target.value)} 
                    className="h-10 px-4 border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background" 
                  />
                </div>

                {/* SLA */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium font-[500] text-foreground">
                    SLA
                  </Label>
                  <Select value={slaId ? String(slaId) : ""} onValueChange={(v) => setSlaId(v ? parseInt(v, 10) : null)}>
                    <SelectTrigger 
                      className="h-10 px-4 border border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background"
                    >
                      <SelectValue placeholder="Select SLA (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(slas) && slas.length > 0 ? (
                        slas.filter((s: any) => s.enabled !== false).map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name || `SLA ${s.id}`}</SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-[#6B7280]">No SLAs available</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Approval */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium font-[500] text-foreground">Approval</Label>
                  <Select value={approvalId ? String(approvalId) : ""} onValueChange={(v) => setApprovalId(v ? parseInt(v, 10) : null)}>
                    <SelectTrigger 
                      className="h-10 px-4 border border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background"
                    >
                      <SelectValue placeholder="Select approval (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(approvals) && approvals.length > 0 ? (
                        approvals.filter((a: any) => a.is_active !== false).map((a: any) => (
                          <SelectItem key={a.id} value={String(a.id)}>{a.name || `Approval ${a.id}`}</SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-[#6B7280]">No approvals available</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Footer Actions - Fixed */}
        <div className={`flex-shrink-0 border-t border-border/40 px-4 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-6 bg-background`}>
          <div className={`flex ${mode === 'create-all' ? 'flex-col sm:flex-row items-stretch sm:items-center' : 'items-center'} justify-end gap-3`}>
            <Button 
              variant={mode === 'create-all' ? 'ghost' : 'outline'}
              onClick={() => onOpenChange(false)} 
              disabled={isSubmitting} 
              className={mode === 'create-all' 
                ? "h-12 px-6 text-[#6B7280] border border-black/20 bg-transparent hover:bg-[#F3F4F6] rounded-[10px] transition-all duration-200 font-medium order-3 sm:order-2"
                : "h-11 px-6 rounded-[10px] font-medium transition-all duration-150"
              }
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!canSubmit || isSubmitting} 
              className={mode === 'create-all'
                ? "h-12 px-8 bg-[#00BFA5] hover:bg-[#00AA92] text-white rounded-[10px] transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-3"
                : "h-11 px-6 rounded-[10px] font-medium bg-[#00BFA5] hover:bg-[#00BFA5]/90 text-white transition-all duration-150"
              }
            >
              {isSubmitting 
                ? (mode === 'edit' ? 'Saving...' : 'Creating...') 
                : (mode === 'edit' ? 'Save Changes' : 'Create Task')
              }
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

