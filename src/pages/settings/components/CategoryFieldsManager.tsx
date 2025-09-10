import React, { useState, useMemo, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faSpinner, faTrash } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RootState, AppDispatch } from "@/store/store";
import { genericActions } from '@/store/genericSlices';
import { Category } from "@/store/types";

type CategoryFieldAssignment = { 
  id: number; 
  field_id: number; 
  category_id: number; 
  is_required: boolean; 
  order: number; 
  default_value: string | null; 
  updated_at?: string; 
};

type CustomField = { 
  id: number; 
  name: string; 
  field_type: string; 
  options?: any; 
  validation_rules?: any; 
  updated_at?: string; 
};

export interface CategoryFieldsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
}

export function CategoryFieldsManager({ open, onOpenChange, category }: CategoryFieldsManagerProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { value: customFields } = useSelector((state: RootState) => state.customFields) as { value: CustomField[] };
  const { value: categoryFieldAssignments } = useSelector((state: RootState) => state.categoryFieldAssignments) as { value: CategoryFieldAssignment[] };
  
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [newFieldId, setNewFieldId] = useState<string>("");

  const currentAssignments = useMemo(() => {
    if (!category) return [] as CategoryFieldAssignment[];
    return (categoryFieldAssignments as CategoryFieldAssignment[])
      .filter(a => a.category_id === category.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [categoryFieldAssignments, category]);

  const assignedFieldIds = useMemo(() => new Set(currentAssignments.map(a => a.field_id)), [currentAssignments]);
  const availableFields = useMemo(() => {
    return (customFields as CustomField[]).filter(f => !assignedFieldIds.has(f.id));
  }, [customFields, assignedFieldIds]);

  const loadData = useCallback(async () => {
    if (!category) return;
    try {
      await Promise.all([
        dispatch(genericActions.customFields.getFromIndexedDB()),
        dispatch(genericActions.categoryFieldAssignments.getFromIndexedDB()),
      ]);
      await Promise.all([
        dispatch(genericActions.customFields.fetchFromAPI() as any),
        dispatch(genericActions.categoryFieldAssignments.fetchFromAPI({ category_id: category.id }) as any),
      ]);
    } catch (e) {
      console.error('Error loading fields/assignments', e);
    }
  }, [dispatch, category]);

  // Load data when dialog opens
  React.useEffect(() => {
    if (open && category) {
      loadData();
    }
  }, [open, category, loadData]);

  const addAssignment = async () => {
    if (!category || !newFieldId) return;
    setAssignSubmitting(true);
    try {
      const nextOrder = currentAssignments.length > 0 ? Math.max(...currentAssignments.map(a => a.order || 0)) + 1 : 0;
      await dispatch(genericActions.categoryFieldAssignments.addAsync({
        field_id: parseInt(newFieldId, 10),
        category_id: category.id,
        is_required: false,
        order: nextOrder,
        default_value: null,
      } as any)).unwrap();
      setNewFieldId("");
    } catch (e) {
      console.error('Error adding assignment', e);
    } finally {
      setAssignSubmitting(false);
    }
  };

  const removeAssignment = async (assignment: CategoryFieldAssignment) => {
    setAssignSubmitting(true);
    try {
      await dispatch(genericActions.categoryFieldAssignments.removeAsync(assignment.id)).unwrap();
    } catch (e) {
      console.error('Error removing assignment', e);
    } finally {
      setAssignSubmitting(false);
    }
  };

  const updateAssignment = async (assignmentId: number, updates: Partial<CategoryFieldAssignment>) => {
    try {
      await dispatch(genericActions.categoryFieldAssignments.updateAsync({ id: assignmentId, updates } as any)).unwrap();
    } catch (e) {
      console.error('Error updating assignment', e);
    }
  };

  const reorderAssignments = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= currentAssignments.length) return;
    const reordered = [...currentAssignments];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    for (let i = 0; i < reordered.length; i++) {
      const a = reordered[i];
      const desired = i;
      if ((a.order ?? i) !== desired) {
        updateAssignment(a.id, { order: desired } as any);
      }
    }
  };

  // Helpers to render default value editor by field type
  const coerceBoolean = (v: any): boolean => {
    if (typeof v === 'boolean') return v;
    if (v == null) return false;
    const s = String(v).toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'y';
  };

  const parseFieldOptions = (f?: CustomField): Array<{ value: string; label: string }> => {
    if (!f) return [];
    const raw = (f as any).options;
    try {
      if (Array.isArray(raw)) {
        return raw.map((o: any) => {
          if (typeof o === 'string') return { value: o, label: o };
          if (o && typeof o === 'object') {
            const val = String(o.value ?? o.id ?? o.name ?? '');
            const lab = String(o.label ?? o.name ?? val);
            return { value: val, label: lab };
          }
          return { value: String(o), label: String(o) };
        });
      }
      if (typeof raw === 'string' && raw.trim().length) {
        // Try JSON first
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.map((o: any) => {
              if (typeof o === 'string') return { value: o, label: o };
              const val = String(o.value ?? o.id ?? o.name ?? '');
              const lab = String(o.label ?? o.name ?? val);
              return { value: val, label: lab };
            });
          }
        } catch {}
        // Fallback: comma-separated
        const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
        return parts.map(s => ({ value: s, label: s }));
      }
    } catch {}
    return [];
  };

  const parseMultiDefault = (val: string | null | undefined): string[] => {
    if (!val) return [];
    // Try JSON array, else comma-separated
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {}
    return String(val).split(',').map(s => s.trim()).filter(Boolean);
  };

  const renderDefaultValueEditor = (a: CategoryFieldAssignment, f?: CustomField) => {
    const type = (f?.field_type || '').toLowerCase();
    const onText = (v: string) => updateAssignment(a.id, { default_value: v } as any);
    
    if (type === 'checkbox') {
      const checked = coerceBoolean(a.default_value);
      return (
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => updateAssignment(a.id, { default_value: e.target.checked ? 'true' : 'false' } as any)}
          className="rounded"
        />
      );
    }
    if (type === 'select') {
      const opts = parseFieldOptions(f);
      return (
        <select
          className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
          value={a.default_value ?? ''}
          onChange={(e) => onText(e.target.value)}
        >
          <option value="">—</option>
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    if (type === 'multi_select') {
      const opts = parseFieldOptions(f);
      const selected = new Set(parseMultiDefault(a.default_value));
      const toggle = (val: string) => {
        const next = new Set(selected);
        if (next.has(val)) next.delete(val); else next.add(val);
        const arr = Array.from(next.values());
        onText(arr.join(','));
      };
      return (
        <div className="flex flex-wrap gap-2">
          {opts.map(o => (
            <label key={o.value} className="flex items-center space-x-1 text-xs border rounded px-2 py-1">
              <input type="checkbox" checked={selected.has(o.value)} onChange={() => toggle(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    }
    if (type === 'date') {
      return (
        <input
          type="date"
          className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
          value={a.default_value ?? ''}
          onChange={(e) => onText(e.target.value)}
        />
      );
    }
    if (type === 'datetime' || type === 'datetime_local' || type === 'datetime-local') {
      return (
        <input
          type="datetime-local"
          className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
          value={a.default_value ?? ''}
          onChange={(e) => onText(e.target.value)}
        />
      );
    }
    if (type === 'number') {
      return (
        <input
          type="number"
          className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
          value={a.default_value ?? ''}
          onChange={(e) => onText(e.target.value)}
        />
      );
    }
    // Fallback text
    return (
      <Input
        value={a.default_value ?? ''}
        onChange={(e) => onText(e.target.value)}
      />
    );
  };

  const closeDialog = () => {
    onOpenChange(false);
    setNewFieldId("");
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Manage Fields{category ? ` • ${category.name}` : ''}</DialogTitle>
          <DialogDescription>
            Assign custom fields to this category and configure their requirements, defaults, and order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <select
              value={newFieldId}
              onChange={(e) => setNewFieldId(e.target.value)}
              className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            >
              <option value="">Select field to add</option>
              {availableFields.map((f: any) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <Button onClick={addAssignment} disabled={!newFieldId || assignSubmitting}>
              {assignSubmitting ? <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" /> : <FontAwesomeIcon icon={faPlus} className="mr-2" />}
              Add Field
            </Button>
          </div>

          <div className="border rounded-md">
            <div className="grid grid-cols-12 gap-2 p-2 text-sm font-medium text-muted-foreground">
              <div className="col-span-5">Field</div>
              <div className="col-span-2">Required</div>
              <div className="col-span-3">Default</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            <div className="divide-y">
              {currentAssignments.map((a, idx) => {
                const f = (customFields as CustomField[]).find(cf => cf.id === a.field_id);
                return (
                  <div key={a.id} className="grid grid-cols-12 gap-2 items-center p-2">
                    <div className="col-span-5 truncate">
                      <div className="font-medium">{f?.name || `Field #${a.field_id}`}</div>
                      <div className="text-xs text-muted-foreground">{f?.field_type || ''}</div>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="checkbox"
                        checked={!!a.is_required}
                        onChange={(e) => updateAssignment(a.id, { is_required: e.target.checked } as any)}
                        className="rounded"
                      />
                    </div>
                    <div className="col-span-3">
                      {renderDefaultValueEditor(a, f)}
                    </div>
                    <div className="col-span-2 flex items-center justify-end space-x-2">
                      <Button variant="outline" size="sm" onClick={() => reorderAssignments(idx, idx - 1)}>Up</Button>
                      <Button variant="outline" size="sm" onClick={() => reorderAssignments(idx, idx + 1)}>Down</Button>
                      <Button variant="destructive" size="sm" onClick={() => removeAssignment(a)}>
                        <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {currentAssignments.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">No fields assigned yet.</div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CategoryFieldsManager;
