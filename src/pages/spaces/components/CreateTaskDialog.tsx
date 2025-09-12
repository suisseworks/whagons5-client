import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addTaskAsync } from '@/store/reducers/tasksSlice';
import { genericActions } from '@/store/genericSlices';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

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
  const { value: teams = [] } = useSelector((s: RootState) => (s as any).teams || { value: [] });
  const { value: spotTypes = [] } = useSelector((s: RootState) => (s as any).spotTypes || { value: [] });

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
  const [nameTouched, setNameTouched] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [spotQuery, setSpotQuery] = useState('');

  const categoryInitialStatusId = useMemo(() => {
    if (!categoryId) return null;
    const catStatuses = statuses.filter((s: any) => s.category_id === categoryId);
    const initial = catStatuses.find((s: any) => s.initial === true);
    return (initial || catStatuses[0])?.id || null;
  }, [statuses, categoryId]);

  const derivedTeamId = useMemo(() => {
    if (!categoryId) return null;
    const cat = workspaceCategories.find((c: any) => c.id === categoryId);
    return cat?.team_id || null;
  }, [workspaceCategories, categoryId]);

  const categoryPriorities = useMemo(() => {
    if (!categoryId) return [] as any[];
    return priorities.filter((p: any) => p.category_id === categoryId);
  }, [priorities, categoryId]);

  const workspaceTemplates = useMemo(() => {
    return templates.filter((t: any) => t.workspace_id === workspaceId && t.enabled !== false);
  }, [templates, workspaceId]);

  const workspaceUsers = useMemo(() => {
    const list = users.filter((u: any) => !u.workspace_id || u.workspace_id === workspaceId);
    if (!userQuery.trim()) return list;
    const q = userQuery.toLowerCase();
    return list.filter((u: any) => (u.name || u.email || '').toLowerCase().includes(q));
  }, [users, workspaceId, userQuery]);

  const workspaceSpots = useMemo(() => {
    // Filter spots by spotType.workspace_id when available
    const typeById = new Map(spotTypes.map((st: any) => [st.id, st]));
    const list = spots.filter((s: any) => {
      const st: any = typeById.get(s.spot_type_id);
      return !st?.workspace_id || st.workspace_id === workspaceId;
    });
    if (!spotQuery.trim()) return list;
    const q = spotQuery.toLowerCase();
    return list.filter((s: any) => (s.name || '').toLowerCase().includes(q));
  }, [spots, spotTypes, workspaceId, spotQuery]);

  useEffect(() => {
    // Prefill defaults when panel opens
    if (open) {
      setName('');
      setDescription('');
      setSpotId(null);
      setSelectedUserIds([]);
      setDueDate('');
      setIsSubmitting(false);
      setNameTouched(false);
      setUserQuery('');
      setSpotQuery('');

      // Choose first template and derive defaults
      const firstTemplate = workspaceTemplates[0];
      if (firstTemplate) {
        setTemplateId(firstTemplate.id);
        setCategoryId(firstTemplate.category_id || null);
        setPriorityId(firstTemplate.default_priority || null);
      } else {
        setTemplateId(null);
        // fall back to first category in workspace if no templates
        const defaultCategory = workspaceCategories[0];
        setCategoryId(defaultCategory ? defaultCategory.id : null);
        setPriorityId(null);
      }
    }
  }, [open, workspaceCategories, workspaceTemplates]);

  useEffect(() => {
    // When template changes, derive category/priority defaults
    if (templateId) {
      const t = workspaceTemplates.find((x: any) => x.id === templateId);
      if (t) {
        setCategoryId(t.category_id || null);
        setPriorityId(t.default_priority || null);
        if (!nameTouched) {
          setName(t.name);
        }
      }
    }
  }, [templateId, workspaceTemplates]);

  useEffect(() => {
    // When category changes without template default, set a reasonable default priority
    if (categoryId && !priorityId) {
      const firstPriority = categoryPriorities[0]?.id ?? null;
      setPriorityId(firstPriority);
    }
    if (!categoryId) {
      setPriorityId(null);
    }
  }, [categoryId]);

  const canSubmit = useMemo(() => {
    return Boolean(
      name.trim().length > 0 &&
      templateId &&
      workspaceId &&
      categoryId &&
      derivedTeamId &&
      categoryInitialStatusId &&
      (priorityId || categoryPriorities.length === 0)
    );
  }, [name, templateId, workspaceId, categoryId, derivedTeamId, categoryInitialStatusId, priorityId, categoryPriorities.length]);

  const handleSubmit = async () => {
    if (!canSubmit || !categoryId || !derivedTeamId || !categoryInitialStatusId) return;
    try {
      setIsSubmitting(true);
      const payload: any = {
        name: name.trim(),
        description: description.trim() || null,
        workspace_id: workspaceId,
        category_id: categoryId,
        team_id: derivedTeamId,
        template_id: templateId,
        spot_id: spotId,
        status_id: categoryInitialStatusId,
        priority_id: priorityId ?? 0,
        start_date: null,
        due_date: dueDate || null,
        expected_duration: (() => {
          const t = workspaceTemplates.find((x: any) => x.id === templateId);
          return t?.default_duration ?? 0;
        })(),
        response_date: null,
        resolution_date: null,
        work_duration: 0,
        pause_duration: 0,
        user_ids: null,
      };

      const created = await dispatch(addTaskAsync(payload)).unwrap();
      // Optionally attach users via taskUsers if any selected
      if (created?.id && Array.isArray(selectedUserIds) && selectedUserIds.length > 0) {
        try {
          await Promise.all(
            selectedUserIds.map((uid) =>
              dispatch((genericActions as any).taskUsers.addAsync({ task_id: created.id, user_id: uid }))
            )
          );
        } catch (e) {
          // Non-blocking
        }
      }
      onOpenChange(false);
    } catch (e) {
      // Error is handled by slice; keep dialog open for correction
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[560px] sm:w-[600px] overflow-auto">
        <SheetHeader>
          <SheetTitle>New Task</SheetTitle>
          <SheetDescription>Create a task from a template.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Template *</Label>
            <Select value={templateId ? String(templateId) : undefined} onValueChange={(v) => setTemplateId(parseInt(v, 10))}>
              <SelectTrigger>
                <SelectValue placeholder={workspaceTemplates.length ? 'Select template' : 'No templates available'} />
              </SelectTrigger>
              <SelectContent>
                {workspaceTemplates.map((t: any) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!workspaceTemplates.length && (
              <div className="text-xs text-muted-foreground">No templates available in this workspace. Enable or create templates first.</div>
            )}
          </div>

          {templateId && (
            <div className="rounded-md border p-3 bg-accent/30">
              <div className="text-xs text-muted-foreground mb-2">Template summary</div>
              <div className="flex flex-wrap gap-2">
                {categoryId && (
                  <Badge variant="secondary">Category: {(() => { const c = categories.find((x: any) => x.id === categoryId); return c?.name || categoryId; })()}</Badge>
                )}
                {(() => { const t = workspaceTemplates.find((x: any) => x.id === templateId); const team = teams.find((tm: any) => tm.id === t?.team_id); return t?.team_id ? (<Badge variant="secondary">Team: {team?.name || t.team_id}</Badge>) : null; })()}
                {(() => { const p = priorities.find((x: any) => x.id === priorityId); return priorityId ? (<Badge variant="secondary">Priority: {p?.name || priorityId}</Badge>) : null; })()}
                {(() => { const t = workspaceTemplates.find((x: any) => x.id === templateId); return t?.default_duration ? (<Badge variant="secondary">Duration: {t.default_duration} min</Badge>) : null; })()}
                {(() => { const sid = categoryInitialStatusId; if (!sid) return null; const st = statuses.find((s: any) => s.id === sid); return (<Badge variant="secondary">Initial Status: {st?.name || sid}</Badge>); })()}
              </div>
            </div>
          )}

          <Separator />
          <div className="text-xs font-medium text-muted-foreground">Details</div>

          <div className="space-y-2">
            <Label htmlFor="task-name">Name *</Label>
            <Input id="task-name" value={name} onChange={(e) => { setName(e.target.value); setNameTouched(true); }} placeholder="Task name" />
            {!name.trim() && <div className="text-xs text-muted-foreground">Auto-filled from template. You can edit.</div>}
          </div>

          {/* Derived Category (hidden field, shown as read-only text) */}
          {categoryId && (
            <div className="space-y-1">
              <Label>Category</Label>
              <div className="text-sm text-muted-foreground">
                {(() => {
                  const cat = categories.find((c: any) => c.id === categoryId);
                  return cat?.name || `Category ${categoryId}`;
                })()}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priorityId ? String(priorityId) : undefined} onValueChange={(v) => setPriorityId(parseInt(v, 10))}>
              <SelectTrigger>
                <SelectValue placeholder={categoryPriorities.length ? 'Select priority' : 'No priorities configured'} />
              </SelectTrigger>
              <SelectContent>
                {categoryPriorities.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />
          <div className="text-xs font-medium text-muted-foreground">Assignment</div>

          <div className="space-y-2">
            <Label>Spot</Label>
            <Input placeholder="Search spots" value={spotQuery} onChange={(e) => setSpotQuery(e.target.value)} />
            <Select value={spotId ? String(spotId) : undefined} onValueChange={(v) => setSpotId(parseInt(v, 10))}>
              <SelectTrigger>
                <SelectValue placeholder={workspaceSpots.length ? 'Select spot (optional)' : 'No spots available'} />
              </SelectTrigger>
              <SelectContent>
                {workspaceSpots.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="users">Assignees</Label>
            <Input placeholder="Search users" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} />
            <div className="max-h-44 overflow-auto border rounded-md p-2">
              {workspaceUsers.length === 0 && (
                <div className="text-xs text-muted-foreground px-1 py-2">No users match.</div>
              )}
              {workspaceUsers.map((u: any) => {
                const checked = selectedUserIds.includes(u.id);
                return (
                  <label key={u.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-accent/50 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedUserIds((prev) => e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id));
                      }}
                    />
                    <span className="text-sm">{u.name || u.email || `User ${u.id}`}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <Separator />
          <div className="text-xs font-medium text-muted-foreground">Scheduling</div>
          <div className="space-y-2">
            <Label htmlFor="due">Due date</Label>
            <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-desc">Description</Label>
            <textarea id="task-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" className="w-full min-h-[80px] px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent" />
          </div>

          <div className="pt-2 sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4">
            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Task'}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}


