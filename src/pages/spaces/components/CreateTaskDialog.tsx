import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addTaskAsync } from '@/store/reducers/tasksSlice';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { iconService } from '@/database/iconService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/animated/Tabs';
import { Combobox } from '@/components/ui/combobox';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { ChevronUp, Plus } from 'lucide-react';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: number;
}

export default function CreateTaskDialog({ open, onOpenChange, workspaceId }: CreateTaskDialogProps) {
  const dispatch = useDispatch<AppDispatch>();

  const { value: categories = [] } = useSelector((s: RootState) => (s as any).categories || { value: [] });
  const { value: priorities = [] } = useSelector((s: RootState) => (s as any).priorities || { value: [] });
  const { value: statuses = [] } = useSelector((s: RootState) => (s as any).statuses || { value: [] });
  const { value: spots = [] } = useSelector((s: RootState) => (s as any).spots || { value: [] });
  const { value: users = [] } = useSelector((s: RootState) => (s as any).users || { value: [] });
  const { value: templates = [] } = useSelector((s: RootState) => (s as any).templates || { value: [] });
  const { value: spotTypes = [] } = useSelector((s: RootState) => (s as any).spotTypes || { value: [] });
  const { value: workspaces = [] } = useSelector((s: RootState) => (s as any).workspaces || { value: [] });
  const { value: slas = [] } = useSelector((s: RootState) => (s as any).slas || { value: [] });
  const { value: approvals = [] } = useSelector((s: RootState) => (s as any).approvals || { value: [] });

  const currentWorkspace = workspaces.find((w: any) => w.id === workspaceId);

  const workspaceCategories = useMemo(() => categories.filter((c: any) => c.workspace_id === workspaceId), [categories, workspaceId]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [priorityId, setPriorityId] = useState<number | null>(null);
  const [spotId, setSpotId] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState<string>('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryIcon, setCategoryIcon] = useState<any>(null);
  const [slaId, setSlaId] = useState<number | null>(null);
  const [approvalId, setApprovalId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [showDescription, setShowDescription] = useState(false);

  const categoryInitialStatusId = useMemo(() => {
    // Statuses are global; pick the one marked initial, otherwise first available
    const initial = (statuses || []).find((s: any) => s.initial === true);
    return (initial || statuses[0])?.id || null;
  }, [statuses]);

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
    if (!categoryId) return [] as any[];
    return priorities.filter((p: any) => p.category_id === categoryId);
  }, [priorities, categoryId]);

  // Keep selectedPriority derivation available for future inline display needs
  // const selectedPriority = useMemo(() => {
  //   return categoryPriorities.find((p: any) => p.id === priorityId) || null;
  // }, [categoryPriorities, priorityId]);

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

  const workspaceUsers = useMemo(() => {
    return users.filter((u: any) => !u.workspace_id || u.workspace_id === workspaceId);
  }, [users, workspaceId]);

  const workspaceSpots = useMemo(() => {
    // Filter spots by spotType.workspace_id when available
    const typeById = new Map(spotTypes.map((st: any) => [st.id, st]));
    return spots.filter((s: any) => {
      const st: any = typeById.get(s.spot_type_id);
      return !st?.workspace_id || st.workspace_id === workspaceId;
    });
  }, [spots, spotTypes, workspaceId]);

  useEffect(() => {
    // Prefill defaults when panel opens
    if (open) {
      setDescription('');
      setSpotId(null);
      setSelectedUserIds([]);
      setDueDate('');
      setIsSubmitting(false);
      setSlaId(null);
      setApprovalId(null);
      setActiveTab('basic');
      setShowDescription(false);

      // Choose first template and derive defaults
      const firstTemplate = workspaceTemplates[0];
      if (firstTemplate) {
        setTemplateId(firstTemplate.id);
        setCategoryId(firstTemplate.category_id || null);
        // If template doesn't define priority, it will be set to "low" by the category change effect
        setPriorityId(firstTemplate.default_priority || null);
        // Set name automatically from template
        setName(firstTemplate.name || '');
        setSlaId(firstTemplate.sla_id || null);
        setApprovalId(firstTemplate.approval_id || null);
      } else {
        setTemplateId(null);
        setName('');
        // fall back to first category in workspace if no templates
        const defaultCategory = workspaceCategories[0];
        setCategoryId(defaultCategory ? defaultCategory.id : null);
        setPriorityId(null);
      }
    }
  }, [open, workspaceCategories, workspaceTemplates]);

  useEffect(() => {
    // When template changes, derive category/priority defaults and set name automatically
    if (templateId) {
      const t = workspaceTemplates.find((x: any) => x.id === templateId);
      if (t) {
        setCategoryId(t.category_id || null);
        // If template doesn't define priority, default to "low"
        if (t.default_priority) {
          setPriorityId(t.default_priority);
        } else {
          // Find "low" priority in category priorities
          const lowPriority = categoryPriorities.find((p: any) => 
            p.name?.toLowerCase() === 'low'
          );
          setPriorityId(lowPriority?.id || null);
        }
        setName(t.name || ''); // Always set name from template
        setSlaId(t.sla_id || null);
        setApprovalId(t.approval_id || null);
        // Clear spot if spots are not applicable for this template
        if (t.spots_not_applicable) {
          setSpotId(null);
        } else if (t.default_spot_id) {
          setSpotId(t.default_spot_id);
        }
      }
    }
  }, [templateId, workspaceTemplates, categoryPriorities]);

  useEffect(() => {
    // When category changes without template default, set priority to "low"
    if (categoryId && !priorityId) {
      // Try to find "low" priority first
      const lowPriority = categoryPriorities.find((p: any) => 
        p.name?.toLowerCase() === 'low'
      );
      if (lowPriority) {
        setPriorityId(lowPriority.id);
      } else {
        // Fallback to first priority if "low" doesn't exist
        const firstPriority = categoryPriorities[0]?.id ?? null;
        setPriorityId(firstPriority);
      }
    }
    if (!categoryId) {
      setPriorityId(null);
    }
  }, [categoryId, categoryPriorities, priorityId]);

  const canSubmit = useMemo(() => {
    return Boolean(
      name.trim().length > 0 &&
      workspaceId &&
      categoryId &&
      derivedTeamId &&
      categoryInitialStatusId &&
      (priorityId || categoryPriorities.length === 0)
    );
  }, [name, workspaceId, categoryId, derivedTeamId, categoryInitialStatusId, priorityId, categoryPriorities.length]);

  const handleSubmit = async () => {
    if (!canSubmit || !categoryId || !derivedTeamId || !categoryInitialStatusId) return;
    try {
      setIsSubmitting(true);
      const selectedTemplate = workspaceTemplates.find((t: any) => t.id === templateId);
      const spotsApplicable = !selectedTemplate?.spots_not_applicable;
      
      const payload: any = {
        name: name.trim(),
        description: description.trim() || null,
        workspace_id: workspaceId,
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
          const t = workspaceTemplates.find((x: any) => x.id === templateId);
          const v = t?.expected_duration ?? t?.default_duration ?? 0;
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
      
      // Only include spot_id if spots are applicable for this template
      if (spotsApplicable) {
        payload.spot_id = spotId;
      }

      await dispatch(addTaskAsync(payload)).unwrap();
      onOpenChange(false);
    } catch (e) {
      // Error is handled by slice; keep dialog open for correction
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:w-[600px] max-w-[600px] p-0 m-0 top-0 gap-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 flex flex-col h-full"
      >
        {/* Header Section - Fixed */}
        <SheetHeader className="relative px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b border-border/40 overflow-hidden bg-gradient-to-br from-[#00BFA5]/5 via-transparent to-transparent flex-shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <SheetTitle className="text-xl sm:text-2xl font-semibold font-[600] text-foreground flex-shrink-0">Create New Task</SheetTitle>
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
                      className="h-12 px-4 border border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background"
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
                  const selectedTemplate = workspaceTemplates.find((t: any) => t.id === templateId);
                  const spotsApplicable = !selectedTemplate?.spots_not_applicable;
                  
                  if (!spotsApplicable) {
                    return null; // Hide the Location field when spots are not applicable
                  }
                  
                  return (
                    <div className="flex flex-col gap-2">
                      <Label className="text-sm font-medium font-[500] text-foreground">
                        Location
                      </Label>
                      <div className="[&_button]:h-12 [&_button]:px-4 [&_button]:border [&_button]:border-black/8 [&_button]:bg-[#F8F9FA] [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-black/12 [&_button]:focus-visible:border-[#00BFA5] [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-[#00BFA5]/10 [&_button]:focus-visible:bg-background">
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

                {/* Priority */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium font-[500] text-foreground">
                    Priority
                  </Label>
                  <Select value={priorityId ? String(priorityId) : undefined} onValueChange={(v) => setPriorityId(parseInt(v, 10))}>
                    <SelectTrigger 
                      className="h-12 px-4 border border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        {priorityId && (() => {
                          const selectedPriority = categoryPriorities.find((p: any) => p.id === priorityId);
                          if (selectedPriority) {
                            return (
                              <>
                                <span 
                                  className="w-2 h-2 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: selectedPriority.color }}
                                />
                                <SelectValue placeholder={categoryPriorities.length ? 'Select priority' : 'No priorities'} />
                              </>
                            );
                          }
                          return <SelectValue placeholder={categoryPriorities.length ? 'Select priority' : 'No priorities'} />;
                        })()}
                      </div>
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

                {/* Responsible */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium font-[500] text-foreground">
                    Responsible
                  </Label>
                  <div className="[&_button]:h-auto [&_button]:min-h-[48px] [&_button]:px-4 [&_button]:py-2.5 [&_button]:border [&_button]:border-black/8 [&_button]:bg-[#F8F9FA] [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-black/12 [&_button]:focus-visible:border-[#00BFA5] [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-[#00BFA5]/10 [&_button]:focus-visible:bg-background">
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
                    className="h-12 px-4 border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background" 
                  />
                </div>

                {/* SLA */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium font-[500] text-foreground">
                    SLA
                  </Label>
                  <Select value={slaId ? String(slaId) : undefined} onValueChange={(v) => setSlaId(v ? parseInt(v, 10) : null)}>
                    <SelectTrigger 
                      className="h-12 px-4 border border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background"
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
                  <Label className="text-sm font-medium font-[500] text-foreground">
                    Approval
                  </Label>
                  <Select value={approvalId ? String(approvalId) : undefined} onValueChange={(v) => setApprovalId(v ? parseInt(v, 10) : null)}>
                    <SelectTrigger 
                      className="h-12 px-4 border border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background"
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
        <div className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-6 border-t border-border/40 bg-background">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
            <Button 
              variant="ghost" 
              onClick={() => onOpenChange(false)} 
              disabled={isSubmitting} 
              className="h-12 px-6 text-[#6B7280] border border-black/20 bg-transparent hover:bg-[#F3F4F6] rounded-[10px] transition-all duration-200 font-medium order-2 sm:order-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!canSubmit || isSubmitting} 
              className="h-12 px-8 bg-[#00BFA5] hover:bg-[#00AA92] text-white rounded-[10px] transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2"
            >
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}


