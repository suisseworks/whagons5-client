import { useEffect, useMemo, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faCubes, faCheck, faLayerGroup, faGripVertical } from "@fortawesome/free-solid-svg-icons";
import { faArrowDown, faArrowUp } from "@fortawesome/free-solid-svg-icons";
import { genericActions } from '@/store/genericSlices';
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { SettingsLayout } from "../components";
import { createSwapy } from 'swapy';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DraftField = {
  id?: number;
  name: string;
  field_type: string;
  optionsText?: string; // comma-separated list for UI input
  // UI-friendly validation state (converted to array on save)
  isRequired?: boolean;
  minLength?: string; // for text/textarea
  maxLength?: string; // for text/textarea
  minNumber?: string; // for number
  maxNumber?: string; // for number
  pattern?: string;   // regex string for text/textarea
};

const TYPES = [
  { id: "text", label: "Text" },
  { id: "textarea", label: "Textarea" },
  { id: "number", label: "Number" },
  { id: "checkbox", label: "Checkbox" },
  { id: "radio", label: "Radio" },
  { id: "date", label: "Date" },
  { id: "time", label: "Time" },
  { id: "datetime", label: "Date/Time" },
  { id: "select", label: "List (Single Select)" },
  { id: "multi_select", label: "Multi‑select" },
];

export default function CustomFieldsTab() {
  const dispatch = useDispatch<AppDispatch>();
  const { value: fields } = useSelector((s: RootState) => s.customFields);
  const { value: categories } = useSelector((s: RootState) => s.categories || { value: [] });

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Toast removed
  const [draft, setDraft] = useState<DraftField>({ 
    name: "", 
    field_type: "text", 
    optionsText: "",
    isRequired: false,
    minLength: "",
    maxLength: "",
    minNumber: "",
    maxNumber: "",
    pattern: ""
  });
  const [selectedField, setSelectedField] = useState<any | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  // Swapy-based reordering; no manual drag state needed
  const ORDER_KEY = 'wh-custom-fields-order-v1';
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const swapyRef = useRef<ReturnType<typeof createSwapy> | null>(null);

  const UI_TO_DB_TYPE: Record<string, string> = useMemo(() => ({
    text: 'TEXT',
    textarea: 'TEXTAREA',
    number: 'NUMBER',
    checkbox: 'CHECKBOX',
    radio: 'RADIO',
    date: 'DATE',
    time: 'TIME',
    datetime: 'DATETIME',
    select: 'LIST',
    multi_select: 'MULTI_SELECT',
  }), []);

  const DB_TO_UI_TYPE: Record<string, string> = useMemo(() => ({
    TEXT: 'text',
    TEXTAREA: 'textarea',
    NUMBER: 'number',
    CHECKBOX: 'checkbox',
    RADIO: 'radio',
    DATE: 'date',
    TIME: 'time',
    DATETIME: 'datetime',
    LIST: 'select',
    MULTI_SELECT: 'multi_select',
  }), []);

  // load persisted order
  const [order, setOrder] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(ORDER_KEY);
      const arr = raw ? (JSON.parse(raw) as number[]) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  });

  const persistOrder = (ids: number[]) => {
    setOrder(ids);
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(ids)); } catch {}
  };

  // ensure all field ids are present in order list
  useEffect(() => {
    const ids = (fields as any[]).map(f => Number(f.id));
    const existing = new Set(order);
    const merged = [...order.filter(id => ids.includes(id)), ...ids.filter(id => !existing.has(id))];
    if (merged.length !== order.length) persistOrder(merged);
  }, [fields]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const base = (fields as any[]);
    const matched = !q ? base : base.filter((f: any) => (
      String(f.name || '').toLowerCase().includes(q) ||
      String(f.field_type || '').toLowerCase().includes(q)
    ));
    // apply order
    const indexOfId = (id: number) => {
      const idx = order.indexOf(Number(id));
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    };
    return matched.slice().sort((a: any, b: any) => indexOfId(a.id) - indexOfId(b.id));
  }, [fields, search, order]);

  // Initialize Swapy for drag-and-drop reordering of cards
  useEffect(() => {
    // Only enable reordering when not filtering; otherwise the DOM subset
    // may not reflect the full order and persistence gets confusing
    if (!containerRef.current) return;
    if (search && search.trim().length > 0) {
      swapyRef.current?.destroy?.();
      swapyRef.current = null;
      return;
    }

    const container = containerRef.current;
    const slotEls = container.querySelectorAll('[data-swapy-slot]');
    if (slotEls.length < 2) {
      swapyRef.current?.destroy?.();
      swapyRef.current = null;
      return;
    }

    // Destroy previous instance before creating a new one
    swapyRef.current?.destroy?.();
    const instance = createSwapy(container, {});
    swapyRef.current = instance;

    const offEnd = (instance as any).onSwapEnd?.(() => {
      // After swap, read DOM to compute new order and persist
      try {
        const els = Array.from(container.querySelectorAll('[data-swapy-slot]')) as HTMLElement[];
        const nextIds: number[] = [];
        for (const el of els) {
          const itemEl = el.querySelector('[data-swapy-item]') as HTMLElement | null;
          const iid = itemEl?.getAttribute('data-swapy-item');
          if (iid != null) nextIds.push(Number(iid));
        }
        if (nextIds.length) {
          persistOrder(nextIds);
        }
      } catch {}
    });

    return () => {
      try { offEnd?.(); } catch {}
      try { instance.destroy(); } catch {}
      swapyRef.current = null;
    };
  }, [filtered.length, search]);

  const buildValidationArray = (d: DraftField): string[] => {
    const rules: string[] = [];
    if (d.isRequired) rules.push('required');
    if (d.field_type === 'text' || d.field_type === 'textarea') {
      if (d.minLength) rules.push(`min:${parseInt(d.minLength, 10)}`);
      if (d.maxLength) rules.push(`max:${parseInt(d.maxLength, 10)}`);
      if (d.pattern && d.pattern.trim()) rules.push(`regex:${d.pattern.trim()}`);
    }
    if (d.field_type === 'number') {
      rules.push('numeric');
      if (d.minNumber) rules.push(`min:${Number(d.minNumber)}`);
      if (d.maxNumber) rules.push(`max:${Number(d.maxNumber)}`);
    }
    return rules;
  };

  const onCreate = async () => {
    setFormError(null);
    setIsSaving(true);
    const options = (draft.optionsText || '').split(',').map(s => s.trim()).filter(Boolean);
    const needsOptions = draft.field_type === 'select' || draft.field_type === 'multi_select';
    const optionsValue = needsOptions ? (options.length ? options : []) : [];
    const validationValue = buildValidationArray(draft);
    const payload: any = {
      name: draft.name,
      field_type: UI_TO_DB_TYPE[draft.field_type] || draft.field_type.toUpperCase(),
      options: optionsValue,
      validation_rules: validationValue,
    };
    try {
      await dispatch(genericActions.customFields.addAsync(payload)).unwrap();
      setOpen(false);
      setDraft({ name: "", field_type: "text", optionsText: "", isRequired: false, minLength: "", maxLength: "", minNumber: "", maxNumber: "", pattern: "" });
      // toast removed
    } catch (e: any) {
      setFormError(e?.message || 'Failed to create field.');
    } finally { setIsSaving(false); }
  };

  const onUpdate = async () => {
    if (!selectedField) return;
    setFormError(null);
    setIsSaving(true);
    const options = (draft.optionsText || '').split(',').map(s => s.trim()).filter(Boolean);
    const needsOptions = draft.field_type === 'select' || draft.field_type === 'multi_select';
    const optionsValue = needsOptions ? (options.length ? options : []) : [];
    const validationValue = buildValidationArray(draft);
    const updates: any = {
      name: draft.name,
      field_type: UI_TO_DB_TYPE[draft.field_type] || draft.field_type.toUpperCase(),
      options: optionsValue,
      validation_rules: validationValue,
    };
    try {
      await dispatch(genericActions.customFields.updateAsync({ id: selectedField.id, updates } as any)).unwrap();
      setOpen(false);
      setSelectedField(null);
    } catch (e: any) {
      const apiMsg = e?.message || (e?.errors ? JSON.stringify(e.errors) : '');
      setFormError(apiMsg || 'Failed to update field.');
    } finally { setIsSaving(false); }
  };

  const openCreate = () => { 
    setSelectedField(null); 
    setDraft({ name: "", field_type: "text", optionsText: "", isRequired: false, minLength: "", maxLength: "", minNumber: "", maxNumber: "", pattern: "" }); 
    setOpen(true); 
  };
  
  const openEdit = (f: any) => {
    setSelectedField(f);
    const optionsText = (() => {
      const raw = (f?.options ?? '') as any;
      if (Array.isArray(raw)) return raw.join(', ');
      if (typeof raw === 'string') return raw;
      try { return JSON.stringify(raw); } catch { return ''; }
    })();
    const valArr: string[] = Array.isArray(f.validation_rules) ? f.validation_rules : [];
    const getVal = (prefix: string) => {
      const found = valArr.find((r: string) => typeof r === 'string' && r.startsWith(prefix + ':'));
      return found ? found.split(':')[1] : '';
    };
    setDraft({
      id: f.id,
      name: f.name || '',
      field_type: DB_TO_UI_TYPE[(f.field_type || '').toString().toUpperCase()] || 'text',
      optionsText,
      isRequired: valArr.includes('required'),
      minLength: getVal('min'),
      maxLength: getVal('max'),
      minNumber: getVal('min'),
      maxNumber: getVal('max'),
      pattern: ((): string => {
        const r = valArr.find((x: string) => typeof x === 'string' && x.startsWith('regex:'));
        return r ? r.slice('regex:'.length) : '';
      })()
    });
    setOpen(true);
  };

  const openAssign = (f: any) => {
    setSelectedField(f);
    setSelectedCategoryIds(Array.isArray((f as any).category_ids) ? (f as any).category_ids : []);
    setAssignOpen(true);
  };

  const onAssign = async () => {
    if (!selectedField) return;
    try {
      await dispatch(genericActions.customFields.assignToCategories({ 
        id: selectedField.id, 
        category_ids: selectedCategoryIds 
      } as any)).unwrap?.();
      setAssignOpen(false);
    } catch (_) {
      // best-effort
      setAssignOpen(false);
    }
  };

  const onDelete = async (f: any) => {
    try {
      setIsDeleting(true);
      await dispatch(genericActions.customFields.removeAsync(f.id as any)).unwrap?.();
    } catch (_) {
      // best-effort
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
      setSelectedField(null);
    }
  };

  return (
    <SettingsLayout
      title="Custom fields"
      description="Reusable fields you can assign to any category"
      icon={faCubes}
      iconColor="#f59e0b"
      backPath="/settings/categories"
      search={{
        placeholder: "Search fields...",
        value: search,
        onChange: setSearch
      }}
      headerActions={
        <Button onClick={openCreate} size="sm">
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          New field
        </Button>
      }
    >
      <div 
        ref={containerRef}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        {filtered.map((f: any) => (
          <div key={f.id} data-swapy-slot={String(f.id)} className="h-full">
            <div data-swapy-item={String(f.id)} className="h-full">
              <Card className={`group p-0`} 
                onDoubleClick={() => openEdit(f)}
              >
                <div className="flex items-center justify-between px-3 py-2 cursor-pointer" title="Double click to edit">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground/50 hover:text-muted-foreground cursor-grab transition-colors"><FontAwesomeIcon icon={faGripVertical} className="w-3.5 h-3.5" /></span>
                      <CardTitle className="text-base font-semibold tracking-tight truncate">{f.name || '(Unnamed field)'}</CardTitle>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {(() => {
                          const uiType = DB_TO_UI_TYPE[String(f.field_type || '').toUpperCase()] || String(f.field_type || '').toLowerCase();
                          const label = (TYPES.find(t => t.id === uiType)?.label) || uiType;
                          return label;
                        })()}
                      </span>
                    </div>
                    {f.description && (
                      <CardDescription className="truncate text-xs mt-0.5 text-muted-foreground/80">{f.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-3 shrink-0">
                    {/* Edit button removed; double-click card to edit */}
                    <Button size="sm" variant="ghost" className="h-7 px-2 opacity-70 hover:opacity-100 text-muted-foreground" onClick={() => openAssign(f)}>
                      <FontAwesomeIcon icon={faLayerGroup} className="w-3 h-3 mr-1" />
                      Assign
                    </Button>
                    {/* Delete moved into edit dialog */}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedField ? "Edit field" : "New field"}</DialogTitle>
            <DialogDescription>Define the metadata and default behavior of this field.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-right text-sm">Name</label>
              <Input 
                className="col-span-3" 
                value={draft.name} 
                onChange={(e) => setDraft({ ...draft, name: e.target.value })} 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-right text-sm">Type</label>
              <Select value={draft.field_type} onValueChange={(v) => setDraft({ ...draft, field_type: v })}>
                <SelectTrigger className="col-span-3"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {TYPES.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-right text-sm">Options</label>
              <Input 
                className="col-span-3 placeholder:text-muted-foreground/60" 
                placeholder="Low, Medium, High" 
                value={draft.optionsText || ''} 
                onChange={(e) => setDraft({ ...draft, optionsText: e.target.value })} 
              />
            </div>
            {/* Validation UI */}
            <div className="grid grid-cols-4 items-start gap-3">
              <label className="text-right text-sm mt-2 sr-only">Validation</label>
              <div className="col-span-3">
                {(draft.field_type === 'text' || draft.field_type === 'textarea') && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-sm mr-2"><input type="checkbox" checked={!!draft.isRequired} onChange={(e) => setDraft({ ...draft, isRequired: e.target.checked })} /> Required</label>
                    <Input placeholder="Regex (optional)" value={draft.pattern || ''} onChange={(e) => setDraft({ ...draft, pattern: e.target.value })} className="min-w-[180px] flex-1 placeholder:text-muted-foreground/60" />
                  </div>
                )}
                {draft.field_type === 'number' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-sm mr-2"><input type="checkbox" checked={!!draft.isRequired} onChange={(e) => setDraft({ ...draft, isRequired: e.target.checked })} /> Required</label>
                    <div className="relative w-24">
                      <FontAwesomeIcon icon={faArrowDown} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 w-3.5 h-3.5" />
                      <Input placeholder="Min" value={draft.minNumber || ''} onChange={(e) => setDraft({ ...draft, minNumber: e.target.value })} className="pl-6 placeholder:text-muted-foreground/60" />
                    </div>
                    <div className="relative w-24">
                      <FontAwesomeIcon icon={faArrowUp} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 w-3.5 h-3.5" />
                      <Input placeholder="Max" value={draft.maxNumber || ''} onChange={(e) => setDraft({ ...draft, maxNumber: e.target.value })} className="pl-6 placeholder:text-muted-foreground/60" />
                    </div>
                  </div>
                )}
                {!(draft.field_type === 'text' || draft.field_type === 'textarea' || draft.field_type === 'number') && (
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!draft.isRequired} onChange={(e) => setDraft({ ...draft, isRequired: e.target.checked })} /> Required</label>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            {formError && <div className="text-sm text-destructive mr-auto">{formError}</div>}
            {selectedField && (
              <Button variant="destructive" className="mr-auto" onClick={() => setDeleteOpen(true)} disabled={isDeleting}>
                {isDeleting ? 'Deleting…' : 'Delete'}
              </Button>
            )}
            <Button onClick={selectedField ? onUpdate : onCreate} disabled={isSaving}>
              <FontAwesomeIcon icon={faCheck} className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving…' : (selectedField ? 'Save changes' : 'Create field')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Assign to categories</DialogTitle>
            <DialogDescription>Select one or more categories to attach this field.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-auto p-1 border rounded-md">
              {categories.map((c: any) => (
                <label key={c.id} className="flex items-center space-x-2 px-2 py-1">
                  <input 
                    type="checkbox" 
                    checked={selectedCategoryIds.includes(c.id)} 
                    onChange={(e) => {
                      setSelectedCategoryIds(prev => 
                        e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id)
                      );
                    }} 
                  />
                  <span className="text-sm">{c.name}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={onAssign}>
              <FontAwesomeIcon icon={faCheck} className="w-4 h-4 mr-2" />
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete field</DialogTitle>
            <DialogDescription>
              {selectedField ? `Are you sure you want to delete "${selectedField.name}"? This cannot be undone.` : 'Are you sure?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => selectedField && onDelete(selectedField)} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* toast removed */}
    </SettingsLayout>
  );
}