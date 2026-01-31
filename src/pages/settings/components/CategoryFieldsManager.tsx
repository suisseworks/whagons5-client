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
import { useLanguage } from "@/providers/LanguageProvider";

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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  category: Category | null;
  variant?: 'dialog' | 'inline';
}

export function CategoryFieldsManager({ open, onOpenChange, category, variant = 'dialog' }: CategoryFieldsManagerProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { t } = useLanguage();
  const tc = (key: string, fallback: string) => t(`settings.categories.fieldsManager.${key}`, fallback);
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

  // Data is hydrated on login; this dialog should not trigger ad-hoc IndexedDB/API loading.
  React.useEffect(() => {
    if ((variant === 'dialog' && open) || variant === 'inline') {
      if (category) {
        setInlineError(null);
        // Reset local overrides so we display the hydrated Redux data.
        setLocalAssignments([]);
      }
    }
  }, [variant, open, category]);

  const addAssignment = async () => {
    if (!category || !newFieldId) return;
    if (assignedFieldIds.has(Number(newFieldId))) {
      setInlineError(tc('errors.alreadyAssigned', 'Field already assigned to this category.'));
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
    } catch (e: any) {
      console.error('Error adding assignment', e?.response?.data || e);
      // If server add fails, remove our optimistic row
      setLocalAssignments(prev => prev.filter(r => r.id >= 0));
      const msg = e?.response?.data?.message || e?.response?.data?.error || (Array.isArray(e?.response?.data?.errors) ? e.response.data.errors.join(', ') : '') || e?.message || tc('errors.failedToAdd', 'Failed to add field');
      setInlineError(String(msg));
    } finally {
      setAssignSubmitting(false);
    }
  };

  const removeAssignment = async (assignment: CategoryFieldAssignment) => {
    setAssignSubmitting(true);
    try {
      await dispatch(genericActions.categoryCustomFields.removeAsync(assignment.id)).unwrap();
      setLocalAssignments(prev => prev.filter((r: any) => r?.id !== assignment.id));
    } catch (e) {
      console.error('Error removing assignment', e);
    } finally {
      setAssignSubmitting(false);
    }
  };

  const updateAssignment = async (assignmentId: number, updates: Partial<CategoryFieldAssignment>) => {
    try {
      await dispatch(genericActions.categoryCustomFields.updateAsync({ id: assignmentId, updates } as any)).unwrap();
      setLocalAssignments(prev => prev.map((r: any) => (r?.id === assignmentId ? { ...r, ...(updates as any) } : r)));
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
    if (onOpenChange) {
      onOpenChange(false);
    }
    setNewFieldId("");
  };

  const content = (
    <div className="space-y-4">
          <div className="flex items-center gap-2">
            <select
              value={newFieldId}
              onChange={(e) => setNewFieldId(e.target.value)}
              className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            >
              <option value="">{tc('selectPlaceholder', 'Select field to add')}</option>
              {availableFields.map((f: any) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <Button onClick={addAssignment} disabled={!newFieldId || assignSubmitting} size="sm">
              {assignSubmitting ? <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" /> : <FontAwesomeIcon icon={faPlus} className="mr-2" />}
              {tc('addButton', 'Add Field')}
            </Button>
            {inlineError && <span className="text-sm text-red-600 ml-2">{inlineError}</span>}
          </div>

          {currentAssignments.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <div className="text-sm text-muted-foreground">{tc('empty.noFields', 'No fields assigned yet.')}</div>
              <div className="text-xs text-muted-foreground mt-1">{tc('empty.selectField', 'Select a field above and click Add Field.')}</div>
            </div>
          ) : (
            <div className="border rounded-md">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-sm font-medium text-muted-foreground bg-muted/30 rounded-t-md">
                <div className="col-span-6">{tc('columns.field', 'Field')}</div>
                <div className="col-span-2">{tc('columns.required', 'Required')}</div>
                <div className="col-span-3">{tc('columns.default', 'Default')}</div>
                <div className="col-span-1 text-right">{tc('columns.actions', 'Actions')}</div>
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
                        <Button variant="destructive" size="sm" className="h-7 w-7 p-0" onClick={() => setDeleteTarget(a)} title={tc('removeButton', 'Remove field')} aria-label={tc('removeButton', 'Remove field')}>
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
  );

  if (variant === 'inline') {
    return (
      <>
        {content}
        {/* Confirm delete assignment */}
        <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{tc('deleteDialog.title', 'Remove field from category')}</DialogTitle>
              <DialogDescription>
                {(() => {
                  const fid = deleteTarget ? getFieldId(deleteTarget) : null;
                  const f = (customFields as CustomField[]).find((cf) => Number(cf.id) === Number(fid));
                  const name = f?.name || (fid != null ? tc('deleteDialog.fieldNumber', 'Field #{id}').replace('{id}', String(fid)) : tc('deleteDialog.thisField', 'this field'));
                  return tc('deleteDialog.confirm', 'Are you sure you want to remove "{name}" from {category}? This does not delete the custom field itself.')
                    .replace('{name}', name)
                    .replace('{category}', category?.name ?? tc('deleteDialog.thisCategory', 'this category'));
                })()}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>{tc('deleteDialog.cancel', 'Cancel')}</Button>
              <Button variant="destructive" onClick={async () => { if (deleteTarget) { await removeAssignment(deleteTarget); setDeleteTarget(null); } }}>{tc('deleteDialog.delete', 'Delete')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Dialog open={open ?? false} onOpenChange={closeDialog}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{tc('title', 'Manage Fields')}{category ? ` • ${category.name}` : ''}</DialogTitle>
          <DialogDescription>
            {tc('description', 'Assign custom fields to this category and configure their requirements, defaults, and order.')}
          </DialogDescription>
        </DialogHeader>

        {content}

        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>{tc('closeButton', 'Close')}</Button>
        </DialogFooter>
      </DialogContent>

      {/* Confirm delete assignment */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tc('deleteDialog.title', 'Remove field from category')}</DialogTitle>
            <DialogDescription>
              {(() => {
                const fid = deleteTarget ? getFieldId(deleteTarget) : null;
                const f = (customFields as CustomField[]).find((cf) => Number(cf.id) === Number(fid));
                const name = f?.name || (fid != null ? tc('deleteDialog.fieldNumber', 'Field #{id}').replace('{id}', String(fid)) : tc('deleteDialog.thisField', 'this field'));
                return tc('deleteDialog.confirm', 'Are you sure you want to remove "{name}" from {category}? This does not delete the custom field itself.')
                  .replace('{name}', name)
                  .replace('{category}', category?.name ?? tc('deleteDialog.thisCategory', 'this category'));
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{tc('deleteDialog.cancel', 'Cancel')}</Button>
            <Button variant="destructive" onClick={async () => { if (deleteTarget) { await removeAssignment(deleteTarget); setDeleteTarget(null); } }}>{tc('deleteDialog.delete', 'Delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

export default CategoryFieldsManager;
