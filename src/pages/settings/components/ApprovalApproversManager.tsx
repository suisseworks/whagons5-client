import React, { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { Approval, User, Role } from "@/store/types";
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
  const { value: users } = useSelector((s: RootState) => s.users) as { value: User[] };
  const { value: roles } = useSelector((s: RootState) => s.roles) as { value: Role[] };

  const [items, setItems] = useState<LocalApprover[]>([]);
  const [type, setType] = useState<ApproverType>('user');
  const [selectedId, setSelectedId] = useState<string>("");
  const [required, setRequired] = useState<boolean>(true);

  const availableOptions = useMemo(() => {
    return type === 'user'
      ? (users || []).map((u) => ({ value: String(u.id), label: u.name }))
      : (roles || []).map((r) => ({ value: String(r.id), label: r.name }));
  }, [type, users, roles]);

  const add = () => {
    if (!approval || !selectedId) return;
    const approverId = Number(selectedId);
    const already = items.some(i => i.approver_type === type && i.approver_id === approverId);
    if (already) return;
    const next: LocalApprover = {
      id: -Date.now(),
      approval_id: Number(approval.id),
      approver_type: type,
      approver_id: approverId,
      required,
      order_index: items.length,
      scope: 'global',
      scope_id: null,
    };
    setItems(prev => [...prev, next]);
    setSelectedId("");
  };

  const remove = (id: number) => setItems(prev => prev.filter(i => i.id !== id));

  const toggleRequired = (id: number) => setItems(prev => prev.map(i => i.id === id ? { ...i, required: !i.required } : i));

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
            Assign users or roles as approvers for this approval. Ordering and persistence will be added with backend wiring.
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
                <div className="col-span-7">Approver</div>
                <div className="col-span-3">Required</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              <div className="divide-y">
                {items.map(i => (
                  <div key={i.id} className="grid grid-cols-12 gap-2 items-center px-3 py-2.5">
                    <div className="col-span-7 truncate">
                      <div className="font-medium leading-tight">{nameOf(i)}</div>
                      <div className="text-[11px] text-muted-foreground">{i.approver_type === 'user' ? 'User' : 'Role'}</div>
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

