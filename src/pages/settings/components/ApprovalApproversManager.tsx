import React, { useMemo, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store/store";
import { Approval, User, Role, ApprovalApprover } from "@/store/types";
import { genericActions, genericCaches, genericEventNames, genericEvents } from '@/store/genericSlices';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";

export interface ApprovalApproversManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approval: Approval | null;
}

type ApproverType = 'user' | 'role';

type LocalApprover = {
  id: number;
  approval_id: number;
  approver_type: ApproverType;
  approver_id: number;
  required: boolean;
  order_index: number;
  scope: 'global' | 'creator_department' | 'creator_manager' | 'specific_department';
  scope_id: number | null;
};

export function ApprovalApproversManager({ open, onOpenChange, approval }: ApprovalApproversManagerProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { value: users } = useSelector((s: RootState) => s.users) as { value: User[] };
  const { value: roles } = useSelector((s: RootState) => s.roles) as { value: Role[] };
  // Access slice to subscribe for external changes; actual data read via cache for consistency
  useSelector((s: RootState) => s.approvalApprovers.value as ApprovalApprover[]);

  const [items, setItems] = useState<LocalApprover[]>([]);
  const lastMutationRef = React.useRef<number>(0);
  const [type, setType] = useState<ApproverType>('user');
  const [selectedId, setSelectedId] = useState<string>("");
  const [required, setRequired] = useState<boolean>(true);

  const availableOptions = useMemo(() => {
    return type === 'user'
      ? (users || []).map((u) => ({ value: String(u.id), label: u.name }))
      : (roles || []).map((r) => ({ value: String(r.id), label: r.name }));
  }, [type, users, roles]);

  const refreshFromCache = React.useCallback(async (force: boolean = false) => {
    const aid = approval ? Number(approval.id) : null;
    if (!aid) return;
    try {
      // Skip transient refreshes triggered by events right after a local mutation
      if (!force) {
        const recentlyMutated = Date.now() - lastMutationRef.current < 1200;
        if (recentlyMutated) return;
      }
      const rows = await genericCaches.approvalApprovers.getAll();
      const filtered = rows.filter((r: any) => Number((r as any)?.approval_id ?? (r as any)?.approvalId) === aid);
      if (filtered.length > 0) {
        setItems((prev) => {
          const byId = new Map<number, any>();
          const byKey = new Map<string, any>();
          for (const r of filtered as any[]) {
            if (r && r.id != null) byId.set(Number(r.id), r);
            const key = `${(r as any)?.approver_type}-${Number((r as any)?.approver_id)}`;
            byKey.set(key, r);
          }
          const out: any[] = [];
          for (const r of byId.values()) out.push(r);
          for (const r of prev) {
            if (r && r.id < 0) {
              const key = `${r.approver_type}-${Number(r.approver_id)}`;
              if (!byKey.has(key)) out.push(r);
            }
          }
          return out as any;
        });
      } else {
        const recentlyMutated = Date.now() - lastMutationRef.current < 2000;
        if (!recentlyMutated) setItems([]);
      }
    } catch {}
  }, [approval]);

  const loadData = React.useCallback(async () => {
    if (!approval) return;
    const aid = Number(approval.id);
    try {
      await dispatch(genericActions.approvalApprovers.fetchFromAPI({ approval_id: aid }) as any);
    } catch {}
    await refreshFromCache(true);
  }, [dispatch, approval, refreshFromCache]);

  React.useEffect(() => {
    if (open && approval) {
      // hydrate from cache and API
      dispatch(genericActions.approvalApprovers.getFromIndexedDB() as any);
      loadData();
    }
  }, [open, approval, dispatch, loadData]);

  React.useEffect(() => {
    if (!open || !approval) return;
    const names = genericEventNames.approvalApprovers;
    const off1 = genericEvents.on(names.CREATED, refreshFromCache);
    const off2 = genericEvents.on(names.UPDATED, refreshFromCache);
    const off3 = genericEvents.on(names.DELETED, refreshFromCache);
    return () => { off1(); off2(); off3(); };
  }, [open, approval, refreshFromCache]);

  const add = async () => {
    if (!approval || !selectedId) return;
    const approverId = Number(selectedId);
    const already = items.some(i => i.approver_type === type && i.approver_id === approverId);
    if (already) return;
    const optimistic: LocalApprover = {
      id: -Date.now(),
      approval_id: Number(approval.id),
      approver_type: type,
      approver_id: approverId,
      required,
      order_index: items.length,
      scope: 'global',
      scope_id: null,
    };
    setItems(prev => [...prev, optimistic]);
    setSelectedId("");
    lastMutationRef.current = Date.now();
    try {
      const saved = await dispatch(genericActions.approvalApprovers.addAsync({
        approval_id: Number(approval.id),
        approver_type: type,
        approver_id: approverId,
        required,
        order_index: items.length,
        scope: 'global',
        scope_id: null,
      } as any) as any).unwrap();
      setItems(prev => {
        const copy = [...prev];
        const idx = copy.findIndex(r => r.id === optimistic.id);
        if (idx !== -1) copy[idx] = saved as any; else copy.push(saved as any);
        return copy;
      });
    } catch (e) {
      // rollback optimistic
      setItems(prev => prev.filter(i => i.id !== optimistic.id));
    } finally {
      refreshFromCache(true);
    }
  };

  const remove = async (id: number) => {
    // Optimistically remove from local UI immediately
    setItems(prev => prev.filter(i => String(i.id) !== String(id)));
    lastMutationRef.current = Date.now();
    try {
      await dispatch(genericActions.approvalApprovers.removeAsync(id) as any).unwrap();
      // Small delay to allow IndexedDB write to settle before pulling fresh rows
      setTimeout(() => { refreshFromCache(true); }, 120);
    } catch (e) {
      // If server fails, re-sync from cache to restore the item
      await refreshFromCache(true);
    }
  };

  const toggleRequired = async (id: number) => {
    const it = items.find(i => String(i.id) === String(id));
    if (!it) return;
    lastMutationRef.current = Date.now();
    try {
      await dispatch(genericActions.approvalApprovers.updateAsync({ id, updates: { required: !it.required } } as any) as any).unwrap();
    } catch (e) {
      // ignore
    } finally {
      refreshFromCache(true);
    }
  };

  const nameOf = (i: LocalApprover): string => {
    if (i.approver_type === 'user') {
      return users.find(u => u.id === i.approver_id)?.name || `User #${i.approver_id}`;
    }
    return roles.find(r => r.id === i.approver_id)?.name || `Role #${i.approver_id}`;
  };

  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Manage Approvers{approval ? ` • ${approval.name}` : ''}</DialogTitle>
          <DialogDescription>
            Assign users or roles as approvers for this approval. Changes are saved immediately and cached locally.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <select
              className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as ApproverType)}
            >
              <option value="user">User</option>
              <option value="role">Role</option>
            </select>
            <select
              className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">Select {type}</option>
              {availableOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="rounded" />
              Required
            </label>
            <Button onClick={add} disabled={!selectedId} size="sm">
              <FontAwesomeIcon icon={faPlus} className="mr-2" />
              Add
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <div className="text-sm text-muted-foreground">No approvers assigned yet.</div>
              <div className="text-xs text-muted-foreground mt-1">Choose a type and an item above, then click Add.</div>
            </div>
          ) : (
            <div className="border rounded-md">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-sm font-medium text-muted-foreground bg-muted/30 rounded-t-md">
                <div className="col-span-5">Approver</div>
                <div className="col-span-2">Approval Type</div>
                <div className="col-span-3">Required</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              <div className="divide-y">
                {items.map(i => (
                  <div key={i.id} className="grid grid-cols-12 gap-2 items-center px-3 py-2.5">
                    <div className="col-span-5 truncate">
                      <div className="font-medium leading-tight">{nameOf(i)}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-sm capitalize">{i.approver_type === 'user' ? 'User' : 'Role'}</div>
                    </div>
                    <div className="col-span-3">
                      <input type="checkbox" className="rounded" checked={i.required} onChange={() => toggleRequired(i.id)} />
                    </div>
                    <div className="col-span-2 flex items-center justify-end">
                      <Button variant="destructive" size="sm" className="h-7 w-7 p-0" onClick={() => remove(i.id)} title="Remove approver" aria-label="Remove approver">
                        <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center gap-2 w-full justify-between">
            <div className="text-xs text-muted-foreground">{items.length} approver{items.length === 1 ? '' : 's'}</div>
            <div className="flex items-center gap-2">
              <Input type="hidden" value={items.length} readOnly />
              <Button variant="outline" onClick={close}>Close</Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ApprovalApproversManager;

