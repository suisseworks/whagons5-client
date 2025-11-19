import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateTaskAsync } from '@/store/reducers/tasksSlice';
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

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: any | null;
}

export default function EditTaskDialog({ open, onOpenChange, task }: EditTaskDialogProps) {
  const dispatch = useDispatch<AppDispatch>();

  const { value: categories = [] } = useSelector((s: RootState) => (s as any).categories || { value: [] });
  const { value: priorities = [] } = useSelector((s: RootState) => (s as any).priorities || { value: [] });
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
  
  const { user } = useAuth();

  const workspaceId = task?.workspace_id ? Number(task.workspace_id) : null;
  const currentWorkspace = workspaces.find((w: any) => w.id === workspaceId);

  const workspaceCategories = useMemo(() => {
    if (!workspaceId) return [];
    return categories.filter((c: any) => c.workspace_id === workspaceId);
  }, [categories, workspaceId]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [priorityId, setPriorityId] = useState<number | null>(null);
  const [spotId, setSpotId] = useState<number | null>(null);
  const [statusId, setStatusId] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (currentCategory?.icon) {
          const icon = await iconService.getIcon(currentCategory.icon);
          if (!cancelled) setCategoryIcon(icon);
        } else {
          if (!cancelled) setCategoryIcon(null);
        }
      } catch {
        if (!cancelled) setCategoryIcon(null);
      }
    })();
    return () => { cancelled = true; };
  }, [currentCategory?.icon]);

  const categoryPriorities = useMemo(() => {
    if (!categoryId) {
      // If no category selected, return global priorities (category_id is null)
      return priorities.filter((p: any) => p.category_id === null || p.category_id === undefined);
    }
    
    // First, try to get category-specific priorities
    const categorySpecific = priorities.filter((p: any) => p.category_id === categoryId);
    
    // If category has priorities, use them; otherwise fall back to global priorities
    if (categorySpecific.length > 0) {
      return categorySpecific;
    }
    
    // Fall back to global priorities (category_id is null)
    return priorities.filter((p: any) => p.category_id === null || p.category_id === undefined);
  }, [priorities, categoryId]);

  const workspaceTemplates = useMemo(() => {
    // Only show templates for workspaces of type "DEFAULT"
    if (!currentWorkspace || currentWorkspace.type !== "DEFAULT") {
      return [];
    }

    // Templates are matched to workspace by category_id
    return templates.filter((template: any) => {
      if (template?.enabled === false) return false;
      return template.category_id === currentWorkspace.category_id;
    });
  }, [templates, currentWorkspace]);

  const selectedTemplate = useMemo(() => {
    if (!templateId) return null;
    // Handle both string and number ID comparisons
    const found = workspaceTemplates.find((t: any) => 
      t.id === templateId || 
      Number(t.id) === Number(templateId) ||
      String(t.id) === String(templateId)
    );
    return found || null;
  }, [templateId, workspaceTemplates]);

  const spotsApplicable = useMemo(() => {
    if (!selectedTemplate) return true; // Default to showing location if no template selected
    // Explicitly convert to boolean to handle various formats from API
    // Handle: true, "true", 1, "1" as truthy values
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
    return users.filter((u: any) => !u.workspace_id || u.workspace_id === workspaceId);
  }, [users, workspaceId]);

  const workspaceSpots = useMemo(() => {
    if (!workspaceId) return [];
    // Filter spots by spotType.workspace_id when available
    const typeById = new Map(spotTypes.map((st: any) => [st.id, st]));
    return spots.filter((s: any) => {
      const st: any = typeById.get(s.spot_type_id);
      return !st?.workspace_id || st.workspace_id === workspaceId;
    });
  }, [spots, spotTypes, workspaceId]);

  const availableStatuses = useMemo(() => {
    if (!categoryId) return [];
    return statuses.filter((s: any) => {
      // Filter statuses that belong to the same category or are global
      return !s.category_id || s.category_id === categoryId;
    });
  }, [statuses, categoryId]);

  // Get tags for this task
  const taskTagIds = useMemo(() => {
    if (!task?.id) return [];
    return taskTags
      .filter((tt: any) => tt.task_id === Number(task.id))
      .map((tt: any) => Number(tt.tag_id));
  }, [taskTags, task?.id]);

  // Load tags and taskTags from IndexedDB when dialog opens
  useEffect(() => {
    if (open) {
      dispatch(genericActions.tags.getFromIndexedDB());
      dispatch(genericActions.taskTags.getFromIndexedDB());
    }
  }, [open, dispatch]);

  // Load task data when dialog opens or task changes
  useEffect(() => {
    if (open && task) {
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
      // Load existing tags for this task
      const currentTaskTagIds = taskTags
        .filter((tt: any) => tt.task_id === Number(task.id))
        .map((tt: any) => Number(tt.tag_id));
      setSelectedTagIds(currentTaskTagIds);
    }
  }, [open, task?.id, taskTags]);

  const canSubmit = useMemo(() => {
    return Boolean(
      name.trim().length > 0 &&
      workspaceId &&
      categoryId &&
      derivedTeamId &&
      statusId &&
      (priorityId || categoryPriorities.length === 0) &&
      task?.id
    );
  }, [name, workspaceId, categoryId, derivedTeamId, statusId, priorityId, categoryPriorities.length, task?.id]);

  const handleSubmit = async () => {
    if (!canSubmit || !categoryId || !derivedTeamId || !statusId || !task?.id || !user?.id) return;
    try {
      setIsSubmitting(true);
      const updates: any = {
        name: name.trim(),
        description: description.trim() || null,
        category_id: categoryId,
        team_id: derivedTeamId,
        // status_id is not included - status should only be changed from the grid status column
        priority_id: priorityId ?? 0,
        template_id: templateId,
        sla_id: slaId,
        approval_id: approvalId,
        due_date: dueDate || null,
        user_ids: (Array.isArray(selectedUserIds) && selectedUserIds.length > 0)
          ? selectedUserIds.map((id) => parseInt(String(id), 10)).filter((n) => Number.isFinite(n))
          : [],
      };
      
      // Only include spot_id if spots are applicable for this template
      if (spotsApplicable) {
        updates.spot_id = spotId;
      }

      await dispatch(updateTaskAsync({ id: Number(task.id), updates })).unwrap();
      
      // Handle tag assignments
      const currentTagIds = new Set(taskTagIds);
      const newTagIds = new Set(selectedTagIds);
      
      // Find tags to add
      const tagsToAdd = selectedTagIds.filter(tagId => !currentTagIds.has(tagId));
      // Find tags to remove
      const tagsToRemove = taskTagIds.filter(tagId => !newTagIds.has(tagId));
      
      // Create new task tags
      for (const tagId of tagsToAdd) {
        await dispatch(genericActions.taskTags.addAsync({
          task_id: Number(task.id),
          tag_id: tagId,
          user_id: user.id,
        })).unwrap();
      }
      
      // Remove task tags
      for (const tagId of tagsToRemove) {
        const taskTag = taskTags.find((tt: any) => 
          tt.task_id === Number(task.id) && tt.tag_id === tagId
        );
        if (taskTag) {
          await dispatch(genericActions.taskTags.removeAsync(taskTag.id)).unwrap();
        }
      }
      
      onOpenChange(false);
    } catch (e) {
      // Error is handled by slice; keep dialog open for correction
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          // Only allow closing via Cancel button or X button
          if (!isSubmitting) {
            onOpenChange(false);
          } else {
            e.preventDefault();
          }
        }}
        className="w-full sm:w-[1120px] max-w-[1120px] p-0 m-0 sm:m-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 flex flex-col h-full"
      >
        {/* Header Section - Fixed */}
        <SheetHeader className="relative px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b border-border/40 overflow-hidden bg-gradient-to-br from-[#00BFA5]/5 via-transparent to-transparent flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <SheetTitle className="text-xl sm:text-2xl font-semibold font-[600] text-foreground">Edit Task</SheetTitle>
            {categoryId && categoryIcon && (
              <FontAwesomeIcon
                icon={categoryIcon}
                style={{ color: currentCategory?.color }}
                className="w-5 h-5 flex-shrink-0"
              />
            )}
            {categoryId && currentCategory && (
              <span className="text-sm text-[#6B7280] font-medium">
                {currentCategory.name}
              </span>
            )}
          </div>
          <SheetDescription className="text-sm text-[#6B7280] mt-1">
            Update task details and configuration.
          </SheetDescription>
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
                  <Select value={templateId ? String(templateId) : undefined} onValueChange={(v) => setTemplateId(parseInt(v, 10))}>
                    <SelectTrigger 
                      className="h-10 px-4 border border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background"
                    >
                      <SelectValue placeholder={
                        !currentWorkspace || currentWorkspace.type !== "DEFAULT"
                          ? 'Templates only available for default workspaces'
                          : workspaceTemplates.length
                            ? 'Select template'
                            : 'No templates available'
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaceTemplates.map((t: any) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!workspaceTemplates.length && (
                    <p className="text-xs text-[#6B7280] mt-1">
                      {!currentWorkspace || currentWorkspace.type !== "DEFAULT"
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
                    <textarea 
                      id="task-desc" 
                      value={description} 
                      onChange={(e) => {
                        setDescription(e.target.value);
                        if (e.target.value.trim() && !showDescription) {
                          setShowDescription(true);
                        }
                      }}
                      placeholder="Add a description for this task..." 
                      className="w-full min-h-[120px] px-4 py-4 border border-black/8 bg-[#F8F9FA] rounded-[12px] text-sm text-foreground placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#00BFA5] focus:ring-[3px] focus:ring-[#00BFA5]/10 focus:bg-background resize-y transition-all duration-150" 
                    />
                  </div>
                )}

                {/* Location */}
                {(() => {
                  // Double-check: if spotsApplicable is false, definitely hide
                  if (!spotsApplicable) return null;
                  
                  // Additional safety check: verify template directly
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
                  <Select value={priorityId ? String(priorityId) : undefined} onValueChange={(v) => setPriorityId(parseInt(v, 10))}>
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

                {/* Tags */}
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
                  <Select value={slaId ? String(slaId) : undefined} onValueChange={(v) => setSlaId(v ? parseInt(v, 10) : null)}>
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
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No SLAs available</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Approval */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium font-[500] text-foreground">Approval</Label>
                  <Select value={approvalId ? String(approvalId) : undefined} onValueChange={(v) => setApprovalId(v ? parseInt(v, 10) : null)}>
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
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No approvals available</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Footer Actions - Fixed */}
        <div className="flex-shrink-0 border-t border-border/40 px-4 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-6 bg-background">
          <div className="flex items-center justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              disabled={isSubmitting} 
              className="h-11 px-6 rounded-[10px] font-medium transition-all duration-150"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!canSubmit || isSubmitting} 
              className="h-11 px-6 rounded-[10px] font-medium bg-[#00BFA5] hover:bg-[#00BFA5]/90 text-white transition-all duration-150"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

