import React, { useState, useMemo, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faSpinner, faTrash, faGripVertical } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RootState, AppDispatch } from "@/store/store";
import { genericActions, genericCaches, genericEventNames, genericEvents } from '@/store/genericSlices';
import { Category } from "@/store/types";
import api from "@/api/whagonsApi";

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
  const { value: categoryCustomFields } = useSelector((state: RootState) => state.categoryCustomFields) as { value: CategoryFieldAssignment[] };
  
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [newFieldId, setNewFieldId] = useState<string>("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [localAssignments, setLocalAssignments] = useState<CategoryFieldAssignment[]>([]);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const lastMutationRef = React.useRef<number>(0);
  const [deleteTarget, setDeleteTarget] = useState<CategoryFieldAssignment | null>(null);

  // Accessors tolerant to API shape differences (snake_case vs camelCase)
  const getCategoryId = (a: any): number => Number(a?.category_id ?? a?.categoryId ?? a?.categoryID ?? a?.categoryid);
  const getFieldId = (a: any): number => Number(a?.field_id ?? a?.fieldId ?? a?.custom_field_id ?? a?.customFieldId);

  const currentAssignments = useMemo(() => {
    if (!category) return [] as CategoryFieldAssignment[];
    const cid = Number(category.id);
    const source = localAssignments.length ? localAssignments : (categoryCustomFields as CategoryFieldAssignment[]);
    return source
      .filter(a => getCategoryId(a) === cid)
      .sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0));
  }, [localAssignments, categoryCustomFields, category]);

  const assignedFieldIds = useMemo(() => new Set(currentAssignments.map(a => getFieldId(a))), [currentAssignments]);
  const availableFields = useMemo(() => {
    return (customFields as CustomField[]).filter(f => !assignedFieldIds.has(Number(f.id)));
  }, [customFields, assignedFieldIds]);

  const loadData = useCallback(async () => {
    if (!category) return;
    try {
      await Promise.all([
        dispatch(genericActions.customFields.fetchFromAPI() as any),
        dispatch(genericActions.categoryCustomFields.fetchFromAPI() as any),
      ]);
      await refreshFromCache();
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

  // Local cache refresh helper
  const refreshFromCache = useCallback(async () => {
    if (!category) return;
    try {
      const rows = await genericCaches.categoryCustomFields.getAll();
      const cid = Number(category.id);
      const filtered = rows.filter((r: any) => Number((r as any)?.category_id ?? (r as any)?.categoryId) === cid);
      if (filtered.length === 0) {
        // Fallback to Redux state if cache is empty (e.g., encryption not ready)
        const reduxRows = (categoryCustomFields as any[]).filter((r) => Number((r as any)?.category_id ?? (r as any)?.categoryId) === cid);
        const recentlyMutated = Date.now() - lastMutationRef.current < 2000;
        if (reduxRows.length) {
          // Merge with local (preserve optimistic entries)
          setLocalAssignments(prev => {
            const byId = new Map<number, any>();
            for (const r of reduxRows as any[]) if (r && r.id != null) byId.set(Number(r.id), r);
            const out: any[] = [];
            // Include server/redux rows first
            for (const r of byId.values()) out.push(r);
            // Preserve any optimistic (negative id) not yet matched
            for (const r of prev) if (r && r.id < 0) out.push(r);
            return out;
          });
          return;
        }
        // If nothing yet and we just mutated, keep current local view to avoid flash-removal
        if (recentlyMutated) {
          return;
        }
      }
      if (filtered.length > 0) {
        // Merge cache rows with any optimistic rows: replace optimistic if same field/category
        setLocalAssignments(prev => {
          const out: any[] = [];
          const byId = new Map<number, any>();
          const byKey = new Map<string, any>();
          for (const r of filtered as any[]) {
            if (r && r.id != null) byId.set(Number(r.id), r);
            const key = `${Number((r as any)?.field_id ?? (r as any)?.fieldId)}-${Number((r as any)?.category_id ?? (r as any)?.categoryId)}`;
            byKey.set(key, r);
          }
          // Start with server rows
          for (const r of byId.values()) out.push(r);
          // Add optimistic ones that don't have a matching server row yet
          for (const r of prev) {
            if (r && r.id < 0) {
              const key = `${Number((r as any)?.field_id ?? (r as any)?.fieldId)}-${Number((r as any)?.category_id ?? (r as any)?.categoryId)}`;
              if (!byKey.has(key)) out.push(r);
            }
          }
          return out;
        });
      }
    } catch (e) {
      // ignore
    }
  }, [category]);

  // Subscribe to generic events to keep the dialog in sync
  React.useEffect(() => {
    if (!open || !category) return;
    const names = genericEventNames.categoryCustomFields;
    const off1 = genericEvents.on(names.CREATED, refreshFromCache);
    const off2 = genericEvents.on(names.UPDATED, refreshFromCache);
    const off3 = genericEvents.on(names.DELETED, refreshFromCache);
    return () => { off1(); off2(); off3(); };
  }, [open, category, refreshFromCache]);

  const addAssignment = async () => {
    if (!category || !newFieldId) return;
    if (assignedFieldIds.has(Number(newFieldId))) {
      setInlineError('Field already assigned to this category.');
      return;
    }
    setInlineError(null);
    setAssignSubmitting(true);
    try {
      lastMutationRef.current = Date.now();
      const dbg = true;
      if (dbg) console.log('[CFM] addAssignment start', { category, newFieldId });
      const nextOrder = currentAssignments.length > 0 ? Math.max(...currentAssignments.map(a => a.order || 0)) + 1 : 0;
      // Optimistic local push to avoid flash if cache write lags
      const optimistic: any = {
        id: -Date.now(),
        field_id: parseInt(newFieldId, 10),
        category_id: Number(category.id),
        is_required: false,
        order: nextOrder,
        default_value: null,
      };
      setLocalAssignments(prev => [...prev, optimistic]);

      const saved = await dispatch(genericActions.categoryCustomFields.addAsync({
        field_id: parseInt(newFieldId, 10),
        custom_field_id: parseInt(newFieldId, 10),
        category_id: Number(category.id),
        is_required: false,
        order: nextOrder,
        default_value: null,
      } as any)).unwrap();
      if (dbg) console.log('[CFM] addAssignment saved', saved);
      setNewFieldId("");
      // Replace optimistic row with server row to prevent flash-removal
      setLocalAssignments(prev => {
        const copy = [...prev];
        const idx = copy.findIndex(r => r.id === optimistic.id);
        if (idx !== -1) copy[idx] = saved as any; else copy.push(saved as any);
        return copy;
      });
      // Background refresh
      refreshFromCache();

      // Debug: verify server and cache immediately
      try {
        const resp = await api.get('/category-field-assignments', { params: { category_id: Number(category.id), per_page: 1000 } });
        const serverRows = (resp.data?.data ?? resp.data?.rows ?? resp.data) as any[];
        console.log('[CFM] server list', serverRows);
      const cacheRows = await genericCaches.categoryCustomFields.getAll();
        console.log('[CFM] cache list (all)', cacheRows);
        const cid = Number(category.id);
        console.log('[CFM] cache list (filtered)', cacheRows.filter((r: any) => Number((r as any)?.category_id ?? (r as any)?.categoryId) === cid));
      } catch (e) {
        console.log('[CFM] debug fetch error', e);
      }
    } catch (e: any) {
      console.error('Error adding assignment', e?.response?.data || e);
      // If server add fails, remove our optimistic row
      setLocalAssignments(prev => prev.filter(r => r.id >= 0));
      const msg = e?.response?.data?.message || e?.response?.data?.error || (Array.isArray(e?.response?.data?.errors) ? e.response.data.errors.join(', ') : '') || e?.message || 'Failed to add field';
      setInlineError(String(msg));
    } finally {
      setAssignSubmitting(false);
    }
  };

  const removeAssignment = async (assignment: CategoryFieldAssignment) => {
    setAssignSubmitting(true);
    try {
      await dispatch(genericActions.categoryCustomFields.removeAsync(assignment.id)).unwrap();
      await refreshFromCache();
    } catch (e) {
      console.error('Error removing assignment', e);
    } finally {
      setAssignSubmitting(false);
    }
  };

  const updateAssignment = async (assignmentId: number, updates: Partial<CategoryFieldAssignment>) => {
    try {
      await dispatch(genericActions.categoryCustomFields.updateAsync({ id: assignmentId, updates } as any)).unwrap();
      await refreshFromCache();
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
    await refreshFromCache();
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Manage Fields{category ? ` • ${category.name}` : ''}</DialogTitle>
          <DialogDescription>
            Assign custom fields to this category and configure their requirements, defaults, and order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
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
            <Button onClick={addAssignment} disabled={!newFieldId || assignSubmitting} size="sm">
              {assignSubmitting ? <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" /> : <FontAwesomeIcon icon={faPlus} className="mr-2" />}
              Add Field
            </Button>
            {inlineError && <span className="text-sm text-red-600 ml-2">{inlineError}</span>}
          </div>

          {currentAssignments.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <div className="text-sm text-muted-foreground">No fields assigned yet.</div>
              <div className="text-xs text-muted-foreground mt-1">Select a field above and click Add Field.</div>
            </div>
          ) : (
            <div className="border rounded-md">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-sm font-medium text-muted-foreground bg-muted/30 rounded-t-md">
                <div className="col-span-6">Field</div>
                <div className="col-span-2">Required</div>
                <div className="col-span-3">Default</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>
              <div className="divide-y">
                {currentAssignments.map((a, idx) => {
                  const f = (customFields as CustomField[]).find(cf => Number(cf.id) === getFieldId(a));
                  return (
                    <div
                      key={a.id}
                      className={`grid grid-cols-12 gap-2 items-center px-3 py-2.5 ${overIndex === idx ? 'bg-muted/20' : ''}`}
                      draggable
                      onDragStart={() => setDragIndex(idx)}
                      onDragOver={(e) => { e.preventDefault(); setOverIndex(idx); }}
                      onDrop={() => { if (dragIndex != null && dragIndex !== idx) reorderAssignments(dragIndex, idx); setDragIndex(null); setOverIndex(null); }}
                      onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                    >
                      <div className="col-span-6 truncate flex items-center gap-2">
                        <span className="text-muted-foreground cursor-grab"><FontAwesomeIcon icon={faGripVertical} /></span>
                        <div>
                          <div className="font-medium leading-tight">{f?.name || `Field #${a.field_id}`}</div>
                          <div className="mt-0.5 inline-block text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {f?.field_type || ''}
                          </div>
                        </div>
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
                      <div className="col-span-1 flex items-center justify-end gap-1">
                        <Button variant="destructive" size="sm" className="h-7 w-7 p-0" onClick={() => setDeleteTarget(a)} title="Remove field" aria-label="Remove field">
                          <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>Close</Button>
        </DialogFooter>
      </DialogContent>

      {/* Confirm delete assignment */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove field from category</DialogTitle>
            <DialogDescription>
              {(() => {
                const fid = deleteTarget ? getFieldId(deleteTarget) : null;
                const f = (customFields as CustomField[]).find((cf) => Number(cf.id) === Number(fid));
                const name = f?.name || (fid != null ? `Field #${fid}` : 'this field');
                return `Are you sure you want to remove "${name}" from ${category?.name ?? 'this category'}? This does not delete the custom field itself.`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => { if (deleteTarget) { await removeAssignment(deleteTarget); setDeleteTarget(null); } }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

export default CategoryFieldsManager;
