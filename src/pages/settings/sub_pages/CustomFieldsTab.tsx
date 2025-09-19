import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faEdit, faTrash, faCubes, faCheck, faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import { genericActions } from '@/store/genericSlices';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsLayout } from "../components";

type DraftField = {
  id?: number;
  name: string;
  field_type: string;
  optionsText?: string; // comma-separated list for UI input
  validation_rules?: string;
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
  const [draft, setDraft] = useState<DraftField>({ 
    name: "", 
    field_type: "text", 
    optionsText: "", 
    validation_rules: "" 
  });
  const [selectedField, setSelectedField] = useState<any | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);

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

  useEffect(() => {
    dispatch(genericActions.customFields.getFromIndexedDB());
    dispatch(genericActions.customFields.fetchFromAPI());
  }, [dispatch]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return fields;
    return fields.filter((f: any) => (
      f.label.toLowerCase().includes(q) ||
      f.key.toLowerCase().includes(q) ||
      f.type.toLowerCase().includes(q)
    ));
  }, [fields, search]);

  const onCreate = async () => {
    setFormError(null);
    const options = (draft.optionsText || '').split(',').map(s => s.trim()).filter(Boolean);
    const needsOptions = draft.field_type === 'select' || draft.field_type === 'multi_select';
    const parseArray = (s: string | undefined | null) => {
      if (!s) return [] as any[];
      try {
        const v = JSON.parse(s);
        return Array.isArray(v) ? v : [] as any[];
      } catch { return [] as any[]; }
    };
    const optionsValue = needsOptions ? (options.length ? options : []) : [];
    const validationValue = parseArray(draft.validation_rules);
    const payload: any = {
      name: draft.name,
      field_type: UI_TO_DB_TYPE[draft.field_type] || draft.field_type.toUpperCase(),
      options: optionsValue,
      validation_rules: validationValue,
    };
    try {
      await dispatch(genericActions.customFields.addAsync(payload)).unwrap();
      // Force a refresh from server to avoid any pruning/race and confirm persistence
      await dispatch(genericActions.customFields.fetchFromAPI() as any);
      setOpen(false);
      setDraft({ name: "", field_type: "text", optionsText: "", validation_rules: "" });
    } catch (e: any) {
      setFormError(e?.message || 'Failed to create field.');
    }
  };

  const onUpdate = async () => {
    if (!selectedField) return;
    setFormError(null);
    const options = (draft.optionsText || '').split(',').map(s => s.trim()).filter(Boolean);
    const needsOptions = draft.field_type === 'select' || draft.field_type === 'multi_select';
    const parseArray = (s: string | undefined | null) => {
      if (!s) return [] as any[];
      try {
        const v = JSON.parse(s);
        return Array.isArray(v) ? v : [] as any[];
      } catch { return [] as any[]; }
    };
    const optionsValue = needsOptions ? (options.length ? options : []) : [];
    const validationValue = parseArray(draft.validation_rules);
    const updates: any = {
      name: draft.name,
      field_type: UI_TO_DB_TYPE[draft.field_type] || draft.field_type.toUpperCase(),
      options: optionsValue,
      validation_rules: validationValue,
    };
    try {
      await dispatch(genericActions.customFields.updateAsync({ id: selectedField.id, updates } as any)).unwrap();
      await dispatch(genericActions.customFields.fetchFromAPI() as any);
      setOpen(false);
      setSelectedField(null);
    } catch (e: any) {
      const apiMsg = e?.message || (e?.errors ? JSON.stringify(e.errors) : '');
      setFormError(apiMsg || 'Failed to update field.');
    }
  };

  const openCreate = () => { 
    setSelectedField(null); 
    setDraft({ name: "", field_type: "text", optionsText: "", validation_rules: "" }); 
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
    setDraft({
      id: f.id,
      name: f.name || '',
      field_type: DB_TO_UI_TYPE[(f.field_type || '').toString().toUpperCase()] || 'text',
      optionsText,
      validation_rules: f.validation_rules || ''
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
      await dispatch(genericActions.customFields.removeAsync(f.id as any)).unwrap?.();
      await dispatch(genericActions.customFields.fetchFromAPI() as any);
    } catch (_) {
      /* ignore */
    }
  };

  return (
    <SettingsLayout
      title="Custom fields"
      description="Reusable fields you can assign to any category"
      icon={faCubes}
      iconColor="#f59e0b"
      backPath="/settings/categories"
      breadcrumbs={[
        { label: "Categories", path: "/settings/categories" }
      ]}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((f: any) => (
          <Card key={f.id} className="group">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{f.label}</CardTitle>
                <Badge variant={f.active ? "default" : "secondary"}>
                  {f.active ? "Active" : "Archived"}
                </Badge>
              </div>
              <CardDescription>Key: {f.key} • Type: {f.type}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground truncate max-w-[60%]">
                {f.description}
              </div>
              <div className="flex items-center space-x-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(f)}>
                  <FontAwesomeIcon icon={faEdit} className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => openAssign(f)}>
                  <FontAwesomeIcon icon={faLayerGroup} className="w-3 h-3 mr-1" />
                  Assign
                </Button>
                <Button size="sm" variant="destructive" onClick={() => onDelete(f)}>
                  <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
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
              <select 
                className="col-span-3 px-3 py-2 border rounded-md" 
                value={draft.field_type} 
                onChange={(e) => setDraft({ ...draft, field_type: e.target.value })}
              >
                {TYPES.map(t => (<option key={t.id} value={t.id}>{t.label}</option>))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-right text-sm">Options (comma-separated)</label>
              <Input 
                className="col-span-3" 
                placeholder="e.g., Low, Medium, High" 
                value={draft.optionsText || ''} 
                onChange={(e) => setDraft({ ...draft, optionsText: e.target.value })} 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-right text-sm">Validation rules (JSON/text)</label>
              <Input 
                className="col-span-3" 
                value={draft.validation_rules || ''} 
                onChange={(e) => setDraft({ ...draft, validation_rules: e.target.value })} 
              />
            </div>
          </div>
          <DialogFooter>
            {formError && <div className="text-sm text-destructive mr-auto">{formError}</div>}
            <Button onClick={selectedField ? onUpdate : onCreate}>
              <FontAwesomeIcon icon={faCheck} className="w-4 h-4 mr-2" />
              {selectedField ? 'Save changes' : 'Create field'}
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
    </SettingsLayout>
  );
}