import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateTaskAsync } from '@/store/reducers/tasksSlice';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { iconService } from '@/database/iconService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/animated/Tabs';
import { Combobox } from '@/components/ui/combobox';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';

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
  const [dueDate, setDueDate] = useState<string>('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryIcon, setCategoryIcon] = useState<any>(null);
  const [slaId, setSlaId] = useState<number | null>(null);
  const [approvalId, setApprovalId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('basic');

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

  // Load task data when dialog opens or task changes
  useEffect(() => {
    if (open && task) {
      setName(task.name || '');
      setDescription(task.description || '');
      setCategoryId(task.category_id ? Number(task.category_id) : null);
      setPriorityId(task.priority_id ? Number(task.priority_id) : null);
      setSpotId(task.spot_id ? Number(task.spot_id) : null);
      setStatusId(task.status_id ? Number(task.status_id) : null);
      setDueDate(task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '');
      setSelectedUserIds(Array.isArray(task.user_ids) ? task.user_ids.map((id: any) => Number(id)).filter((n: any) => Number.isFinite(n)) : []);
      setSlaId(task.sla_id ? Number(task.sla_id) : null);
      setApprovalId(task.approval_id ? Number(task.approval_id) : null);
      setIsSubmitting(false);
      setActiveTab('basic');
    }
  }, [open, task]);

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
    if (!canSubmit || !categoryId || !derivedTeamId || !statusId || !task?.id) return;
    try {
      setIsSubmitting(true);
      const updates: any = {
        name: name.trim(),
        description: description.trim() || null,
        category_id: categoryId,
        team_id: derivedTeamId,
        spot_id: spotId,
        status_id: statusId,
        priority_id: priorityId ?? 0,
        sla_id: slaId,
        approval_id: approvalId,
        due_date: dueDate || null,
        user_ids: (Array.isArray(selectedUserIds) && selectedUserIds.length > 0)
          ? selectedUserIds.map((id) => parseInt(String(id), 10)).filter((n) => Number.isFinite(n))
          : [],
      };

      await dispatch(updateTaskAsync({ id: Number(task.id), updates })).unwrap();
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
      <SheetContent side="right" className="w-[1000px] sm:w-[1200px] overflow-auto">
        <SheetHeader className="pb-6 mb-6 border-b px-6">
          <SheetTitle className="text-xl font-semibold mb-2">Edit Task</SheetTitle>
          <SheetDescription className="text-sm">Update task details and configuration.</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-6">
          {/* Task Name */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Task Name</Label>
            <div className="text-sm py-2.5 px-3 border rounded-md bg-muted/50">
              {name || 'N/A'}
            </div>
          </div>

          {/* Additional Details Tabs */}
          <div className="border rounded-lg overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-11 rounded-none border-b bg-muted/30">
                <TabsTrigger value="basic" className="text-sm data-[state=active]:bg-background">Basic Details</TabsTrigger>
                <TabsTrigger value="additional" className="text-sm data-[state=active]:bg-background">Additional Info</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-5 p-6 m-0">
                {/* Description */}
                <div className="space-y-3">
                  <Label htmlFor="task-desc" className="text-sm font-medium">Description</Label>
                  <textarea 
                    id="task-desc" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    placeholder="Add a description for this task..." 
                    className="w-full min-h-[100px] px-3 py-2.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none" 
                  />
                </div>

                {/* Priority */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Priority</Label>
                  <Select value={priorityId ? String(priorityId) : undefined} onValueChange={(v) => setPriorityId(parseInt(v, 10))}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder={categoryPriorities.length ? 'Select priority' : 'No priorities'} />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryPriorities.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                            <span>{p.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Location */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Location</Label>
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
                    className="h-10"
                  />
                </div>

                {/* Responsible */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Responsible</Label>
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
                    className="h-10"
                  />
                </div>

                {/* Category Display */}
                {categoryId && (
                  <div className="flex items-center gap-3 p-4 rounded-md bg-muted/50 border">
                    {categoryIcon && (
                      <FontAwesomeIcon
                        icon={categoryIcon}
                        style={{ color: currentCategory?.color }}
                        className="w-4 h-4"
                      />
                    )}
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground mb-1 block">Category</Label>
                      <div className="text-sm font-medium">
                        {currentCategory?.name || `Category ${categoryId}`}
                      </div>
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Status *</Label>
                  <Select value={statusId ? String(statusId) : undefined} onValueChange={(v) => setStatusId(parseInt(v, 10))}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStatuses.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Due Date */}
                <div className="space-y-3">
                  <Label htmlFor="due" className="text-sm font-medium">Due Date</Label>
                  <Input 
                    id="due" 
                    type="date" 
                    value={dueDate} 
                    onChange={(e) => setDueDate(e.target.value)} 
                    className="h-10"
                  />
                </div>
              </TabsContent>

              <TabsContent value="additional" className="space-y-5 p-6 m-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">SLA</Label>
                    <Select value={slaId ? String(slaId) : undefined} onValueChange={(v) => setSlaId(v ? parseInt(v, 10) : null)}>
                      <SelectTrigger className="h-10">
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

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Approval</Label>
                    <Select value={approvalId ? String(approvalId) : undefined} onValueChange={(v) => setApprovalId(v ? parseInt(v, 10) : null)}>
                      <SelectTrigger className="h-10">
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
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 bg-background border-t pt-6 mt-6 -mx-6 px-6 pb-6 -mb-6">
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="h-9 px-5">
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting} className="h-9 px-5">
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

