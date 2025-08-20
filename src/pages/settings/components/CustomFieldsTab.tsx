import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faEdit, faTrash, faCubes, faCheck, faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import { CategoryCustomField, createCustomField, deleteCustomField, getCustomFieldsFromIndexedDB, fetchCustomFields, updateCustomField } from "@/store/reducers/customFieldsSlice";
import { bulkAssignFieldToCategories } from "@/store/reducers/categoryFieldAssignmentsSlice";

type DraftField = {
  id?: number;
  label: string;
  key: string;
  type: string;
  description?: string;
  required: boolean;
  options_json?: any;
  default_value_json?: any;
  active: boolean;
};

const TYPES = [
  { id: "text", label: "Text" },
  { id: "textarea", label: "Textarea" },
  { id: "number", label: "Number" },
  { id: "date", label: "Date" },
  { id: "datetime", label: "Date/Time" },
  { id: "checkbox", label: "Checkbox" },
  { id: "select", label: "Select" },
  { id: "multi_select", label: "Multi‑select" },
  { id: "user", label: "User" },
  { id: "team", label: "Team" },
  { id: "spot", label: "Spot" },
  { id: "url", label: "URL" },
  { id: "file", label: "File" },
];

export default function CustomFieldsTab() {
  const dispatch = useDispatch<AppDispatch>();
  const { value: fields, loading } = useSelector((s: RootState) => s.customFields);
  const categories = useSelector((s: RootState) => s.categories.value);

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [draft, setDraft] = useState<DraftField>({ label: "", key: "", type: "text", required: false, active: true });
  const [selectedField, setSelectedField] = useState<CategoryCustomField | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);

  useEffect(() => { dispatch(getCustomFieldsFromIndexedDB()); dispatch(fetchCustomFields()); }, [dispatch]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return fields;
    return fields.filter(f => (
      f.label.toLowerCase().includes(q) ||
      f.key.toLowerCase().includes(q) ||
      f.type.toLowerCase().includes(q)
    ));
  }, [fields, search]);

  const onCreate = async () => {
    const payload: any = {
      label: draft.label,
      key: draft.key || draft.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      type: draft.type,
      description: draft.description || null,
      options_json: draft.options_json || null,
      required: draft.required,
      default_value_json: draft.default_value_json || null,
      active: draft.active,
      order: 0,
      workspace_id: 0,
    };
    await dispatch(createCustomField(payload));
    setOpen(false);
    setDraft({ label: "", key: "", type: "text", required: false, active: true });
  };

  const onUpdate = async () => {
    if (!selectedField) return;
    const updates: any = {
      label: draft.label,
      key: draft.key,
      type: draft.type,
      description: draft.description || null,
      options_json: draft.options_json || null,
      required: draft.required,
      default_value_json: draft.default_value_json || null,
      active: draft.active,
    };
    await dispatch(updateCustomField({ id: selectedField.id, updates }));
    setOpen(false);
    setSelectedField(null);
  };

  const openCreate = () => { setSelectedField(null); setDraft({ label: "", key: "", type: "text", required: false, active: true }); setOpen(true); };
  const openEdit = (f: CategoryCustomField) => { setSelectedField(f); setDraft({
    id: f.id, label: f.label, key: f.key, type: f.type, description: f.description || undefined, required: f.required,
    options_json: f.options_json || undefined, default_value_json: f.default_value_json || undefined, active: f.active
  }); setOpen(true); };

  const onDelete = async (f: CategoryCustomField) => { await dispatch(deleteCustomField(f.id)); };

  const openAssign = (f: CategoryCustomField) => { setSelectedField(f); setSelectedCategoryIds([]); setAssignOpen(true); };
  const onAssign = async () => {
    if (!selectedField) return;
    await dispatch(bulkAssignFieldToCategories({ fieldId: selectedField.id, categoryIds: selectedCategoryIds }));
    setAssignOpen(false);
    setSelectedField(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <FontAwesomeIcon icon={faCubes} className="text-blue-500 text-2xl" />
            <h2 className="text-2xl font-bold">Custom fields</h2>
          </div>
          <p className="text-muted-foreground">Reusable fields you can assign to any category.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Input placeholder="Search fields..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <Button onClick={openCreate} className="flex items-center space-x-2"><FontAwesomeIcon icon={faPlus} className="w-4 h-4" /><span>New field</span></Button>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((f) => (
          <Card key={f.id} className="group">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{f.label}</CardTitle>
                <Badge variant={f.active ? "default" : "secondary"}>{f.active ? "Active" : "Archived"}</Badge>
              </div>
              <CardDescription>Key: {f.key} • Type: {f.type}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground truncate max-w-[60%]">{f.description}</div>
              <div className="flex items-center space-x-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(f)}><FontAwesomeIcon icon={faEdit} className="w-3 h-3 mr-1" />Edit</Button>
                <Button size="sm" variant="outline" onClick={() => openAssign(f)}><FontAwesomeIcon icon={faLayerGroup} className="w-3 h-3 mr-1" />Assign</Button>
                <Button size="sm" variant="destructive" onClick={() => onDelete(f)}><FontAwesomeIcon icon={faTrash} className="w-3 h-3" /></Button>
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
              <label className="text-right text-sm">Label</label>
              <Input className="col-span-3" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-right text-sm">Key</label>
              <Input className="col-span-3" value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} placeholder="auto-from-label" />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-right text-sm">Type</label>
              <select className="col-span-3 px-3 py-2 border rounded-md" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                {TYPES.map(t => (<option key={t.id} value={t.id}>{t.label}</option>))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-right text-sm">Description</label>
              <Input className="col-span-3" value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-right text-sm">Required</label>
              <input type="checkbox" checked={draft.required} onChange={(e) => setDraft({ ...draft, required: e.target.checked })} />
            </div>
            {(draft.type === 'select' || draft.type === 'multi_select') && (
              <div className="grid grid-cols-4 items-start gap-3">
                <label className="text-right text-sm pt-2">Options (comma-separated)</label>
                <Input className="col-span-3" placeholder="e.g., Low, Medium, High" value={Array.isArray(draft.options_json) ? draft.options_json.join(', ') : ''} onChange={(e) => setDraft({ ...draft, options_json: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={selectedField ? onUpdate : onCreate}><FontAwesomeIcon icon={faCheck} className="w-4 h-4 mr-2" />{selectedField ? 'Save changes' : 'Create field'}</Button>
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
              {categories.map(c => (
                <label key={c.id} className="flex items-center space-x-2 px-2 py-1">
                  <input type="checkbox" checked={selectedCategoryIds.includes(c.id)} onChange={(e) => {
                    setSelectedCategoryIds(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id));
                  }} />
                  <span className="text-sm">{c.name}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={onAssign}><FontAwesomeIcon icon={faCheck} className="w-4 h-4 mr-2" />Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


