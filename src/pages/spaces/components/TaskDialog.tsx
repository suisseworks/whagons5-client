import { useEffect, useMemo, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addTaskAsync, updateTaskAsync } from '@/store/reducers/tasksSlice';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { iconService } from '@/database/iconService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/animated/Tabs';
import { Combobox } from '@/components/ui/combobox';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { TagMultiSelect } from '@/components/ui/tag-multi-select';
import { ChevronUp, Plus, ShieldCheck, Clock } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { genericActions } from '@/store/genericSlices';

type TaskDialogMode = 'create' | 'edit' | 'create-all';

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: TaskDialogMode;
  workspaceId?: number; // Required for 'create' mode
  task?: any | null; // Required for 'edit' mode
}

export default function TaskDialog({ open, onOpenChange, mode, workspaceId: propWorkspaceId, task }: TaskDialogProps) {
  const dispatch = useDispatch<AppDispatch>();

  const { value: categories = [] } = useSelector((s: RootState) => (s as any).categories || { value: [] });
  const { value: priorities = [] } = useSelector((s: RootState) => (s as any).priorities || { value: [] });
  const { value: statuses = [] } = useSelector((s: RootState) => (s as any).statuses || { value: [] });
  const { value: spots = [] } = useSelector((s: RootState) => (s as any).spots || { value: [] });
  const { value: users = [] } = useSelector((s: RootState) => (s as any).users || { value: [] });
  const { value: spotTypes = [] } = useSelector((s: RootState) => (s as any).spotTypes || { value: [] });
  const { value: workspaces = [] } = useSelector((s: RootState) => (s as any).workspaces || { value: [] });
  const { value: slas = [] } = useSelector((s: RootState) => (s as any).slas || { value: [] });
  const { value: approvals = [] } = useSelector((s: RootState) => (s as any).approvals || { value: [] });
  const { value: templates = [] } = useSelector((s: RootState) => (s as any).templates || { value: [] });
  const { value: tags = [] } = useSelector((s: RootState) => (s as any).tags || { value: [] });
  const { value: taskTags = [] } = useSelector((s: RootState) => (s as any).taskTags || { value: [] });
  const { value: customFields = [] } = useSelector((s: RootState) => (s as any).customFields || { value: [] });
  const { value: categoryCustomFields = [] } = useSelector((s: RootState) => (s as any).categoryCustomFields || { value: [] });
  const { value: taskCustomFieldValues = [] } = useSelector((s: RootState) => (s as any).taskCustomFieldValues || { value: [] });
  
  const { user } = useAuth();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [priorityId, setPriorityId] = useState<number | null>(null);
  const [spotId, setSpotId] = useState<number | null>(null);
  const [statusId, setStatusId] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);

  // For create-all mode: derive workspace from selected template's category
  const derivedWorkspaceId = useMemo(() => {
    if (mode !== 'create-all' || !templateId) return null;
    const template = templates.find((t: any) => 
      t.id === templateId || 
      Number(t.id) === Number(templateId) ||
      String(t.id) === String(templateId)
    );
    if (!template) {
      console.log('[TaskDialog] Template not found for templateId:', templateId, 'available templates:', templates.map((t: any) => t.id));
      return null;
    }
    if (!template.category_id) {
      console.log('[TaskDialog] Template has no category_id:', template);
      return null;
    }
    const cat = categories.find((c: any) => 
      c.id === template.category_id || 
      Number(c.id) === Number(template.category_id) ||
      String(c.id) === String(template.category_id)
    );
    if (!cat) {
      console.log('[TaskDialog] Category not found for category_id:', template.category_id, 'available categories:', categories.map((c: any) => c.id));
      return null;
    }
    const wsId = cat.workspace_id;
    console.log('[TaskDialog] Derived workspaceId:', wsId, 'from template:', template.name, 'category:', cat.name);
    return wsId || null;
  }, [mode, templates, templateId, categories]);

  // Determine workspace ID based on mode
  const workspaceId = useMemo(() => {
    if (mode === 'create' && propWorkspaceId) return propWorkspaceId;
    if (mode === 'edit' && task?.workspace_id) return Number(task.workspace_id);
    if (mode === 'create-all' && derivedWorkspaceId) return derivedWorkspaceId;
    return null;
  }, [mode, propWorkspaceId, task?.workspace_id, derivedWorkspaceId]);

  const currentWorkspace = useMemo(() => {
    if (!workspaceId) return null;
    return workspaces.find((w: any) => w.id === workspaceId);
  }, [workspaces, workspaceId]);

  const workspaceCategories = useMemo(() => {
    if (!workspaceId) return [];
    return categories.filter((c: any) => c.workspace_id === workspaceId);
  }, [categories, workspaceId]);
  const [dueDate, setDueDate] = useState<string>('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryIcon, setCategoryIcon] = useState<any>(null);
  const [slaId, setSlaId] = useState<number | null>(null);
  const [approvalId, setApprovalId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [showDescription, setShowDescription] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, any>>({});

  const customFieldValuesRef = useRef<Record<number, any>>({});
  const lastCustomFieldCategoryRef = useRef<number | null>(null);

  const approvalMap = useMemo(() => {
    const map: Record<number, any> = {};
    for (const a of approvals || []) {
      const id = Number((a as any)?.id);
      if (Number.isFinite(id)) map[id] = a;
    }
    return map;
  }, [approvals]);

  const normalizeDefaultUserIds = (ids: any): number[] => {
    if (!Array.isArray(ids)) return [];
    return ids
      .map((id: any) => Number(id))
      .filter((n) => Number.isFinite(n));
  };

  const normalizeFieldType = (field: any): string => {
    return String((field as any)?.field_type ?? (field as any)?.type ?? '').toLowerCase();
  };

  const coerceBoolean = (v: any): boolean => {
    if (typeof v === 'boolean') return v;
    if (v == null) return false;
    const s = String(v).toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on';
  };

  const parseFieldOptions = (field?: any): Array<{ value: string; label: string }> => {
    if (!field) return [];
    const raw = (field as any).options;
    try {
      if (Array.isArray(raw)) {
        return raw.map((o: any) => {
          if (typeof o === 'string') return { value: o, label: o };
          if (o && typeof o === 'object') {
            const value = String((o as any).value ?? (o as any).id ?? (o as any).name ?? '');
            const label = String((o as any).label ?? (o as any).name ?? value);
            return { value, label };
          }
          return { value: String(o), label: String(o) };
        });
      }
      if (typeof raw === 'string' && raw.trim().length) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.map((o: any) => {
              if (typeof o === 'string') return { value: o, label: o };
              const value = String((o as any).value ?? (o as any).id ?? (o as any).name ?? '');
              const label = String((o as any).label ?? (o as any).name ?? value);
              return { value, label };
            });
          }
        } catch {}
        const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
        return parts.map((p) => ({ value: p, label: p }));
      }
    } catch {}
    return [];
  };

  const parseMultiValue = (val: any): string[] => {
    if (Array.isArray(val)) return val.map((v) => String(v));
    if (val == null) return [];
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map((v: any) => String(v));
    } catch {}
    return String(val)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const formatDateValueForInput = (val: any, type: string): string => {
    if (!val) return '';
    const t = (type || '').toLowerCase();
    if (t === 'time') {
      return String(val);
    }
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) {
      if (t === 'date') return d.toISOString().slice(0, 10);
      if (t.startsWith('datetime')) return d.toISOString().slice(0, 16);
    }
    return String(val);
  };

  const deserializeCustomFieldValue = (row: any, field: any) => {
    const type = normalizeFieldType(field);
    const value = (row as any)?.value ?? (row as any)?.value_text;
    const valueNumeric = (row as any)?.value_numeric ?? (row as any)?.valueNumber;
    const valueDate = (row as any)?.value_date ?? (row as any)?.valueDate;
    const valueJson = (row as any)?.value_json ?? (row as any)?.valueJson;

    if (type === 'multi_select' || type === 'multi-select' || type === 'multi select') {
      if (Array.isArray(valueJson)) return valueJson.map((v: any) => String(v));
      if (value != null) return parseMultiValue(value);
      return [];
    }
    if (type === 'checkbox') {
      if (value != null) return coerceBoolean(value);
      if (valueNumeric != null) return Number(valueNumeric) === 1;
      return false;
    }
    if (type === 'number') {
      if (valueNumeric != null && Number.isFinite(Number(valueNumeric))) return Number(valueNumeric);
      if (value != null && String(value).length) {
        const num = Number(value);
        return Number.isFinite(num) ? num : '';
      }
      return '';
    }
    if (type === 'date' || type.startsWith('datetime')) {
      return formatDateValueForInput(valueDate ?? value, type);
    }
    if (type === 'time') {
      return value ?? '';
    }
    return value ?? '';
  };

  const parseDefaultCustomFieldValue = (defaultValue: any, field: any) => {
    const type = normalizeFieldType(field);
    if (type === 'multi_select' || type === 'multi-select' || type === 'multi select') {
      return parseMultiValue(defaultValue);
    }
    if (type === 'checkbox') {
      if (defaultValue == null) return false;
      return coerceBoolean(defaultValue);
    }
    if (type === 'number') {
      if (defaultValue == null || defaultValue === '') return '';
      const num = Number(defaultValue);
      return Number.isFinite(num) ? num : '';
    }
    if (type === 'date' || type.startsWith('datetime')) {
      return formatDateValueForInput(defaultValue, type);
    }
    if (type === 'time') {
      return defaultValue ?? '';
    }
    return defaultValue ?? '';
  };

  const isCustomFieldValueFilled = (field: any, raw: any): boolean => {
    const type = normalizeFieldType(field);
    if (type === 'multi_select' || type === 'multi-select' || type === 'multi select') {
      if (Array.isArray(raw)) return raw.length > 0;
      return String(raw ?? '').trim().length > 0;
    }
    if (type === 'checkbox') {
      return raw === true || raw === false || raw === 'true' || raw === 'false' || raw === 1 || raw === 0 || raw === '1' || raw === '0';
    }
    if (type === 'number') {
      if (raw === '' || raw == null) return false;
      return Number.isFinite(Number(raw));
    }
    return raw != null && String(raw).trim().length > 0;
  };

  const serializeCustomFieldPayload = (field: any, raw: any) => {
    const type = normalizeFieldType(field);
    const base = { value: null as any, value_numeric: null as any, value_date: null as any, value_json: null as any };

    if (type === 'multi_select' || type === 'multi-select' || type === 'multi select') {
      const arr = Array.isArray(raw) ? raw.map((v) => String(v)).filter(Boolean) : parseMultiValue(raw);
      return {
        ...base,
        value: arr.length ? arr.join(',') : null,
        value_json: arr.length ? arr : [],
      };
    }
    if (type === 'checkbox') {
      if (raw == null || raw === '') return base;
      const bool = coerceBoolean(raw);
      return {
        ...base,
        value: bool ? 'true' : 'false',
        value_numeric: bool ? 1 : 0,
      };
    }
    if (type === 'number') {
      if (raw == null || raw === '') return base;
      const num = Number(raw);
      return {
        ...base,
        value: Number.isFinite(num) ? String(num) : null,
        value_numeric: Number.isFinite(num) ? num : null,
      };
    }
    if (type === 'date' || type.startsWith('datetime')) {
      if (!raw) return base;
      return {
        ...base,
        value: String(raw),
        value_date: String(raw),
      };
    }
    if (type === 'time') {
      return {
        ...base,
        value: raw == null || raw === '' ? null : String(raw),
      };
    }
    // TEXT, TEXTAREA, LIST, RADIO or fallback
    return {
      ...base,
      value: raw == null || String(raw).trim() === '' ? null : String(raw),
    };
  };

  const derivedTeamId = useMemo(() => {
    if (!categoryId) return null;
    const cat = workspaceCategories.find((c: any) => c.id === categoryId);
    return cat?.team_id || null;
  }, [workspaceCategories, categoryId]);

  const currentCategory = useMemo(() => {
    return categories.find((c: any) => c.id === categoryId);
  }, [categories, categoryId]);

  const categoryFields = useMemo(() => {
    if (!categoryId) return [] as Array<{ assignment: any; field: any }>;
    const fieldById = new Map<number, any>();
    for (const f of customFields || []) {
      const id = Number((f as any)?.id);
      if (Number.isFinite(id)) fieldById.set(id, f);
    }
    return (categoryCustomFields || [])
      .filter((ccf: any) => Number((ccf as any)?.category_id ?? (ccf as any)?.categoryId) === Number(categoryId))
      .sort((a: any, b: any) => ((a as any)?.order ?? 0) - ((b as any)?.order ?? 0))
      .map((assignment: any) => {
        const fieldId = Number((assignment as any)?.field_id ?? (assignment as any)?.custom_field_id ?? (assignment as any)?.fieldId);
        const field = fieldById.get(fieldId);
        return { assignment, field };
      })
      .filter((row) => !!row.field);
  }, [categoryId, categoryCustomFields, customFields]);

  useEffect(() => {
    if (activeTab === 'customFields' && categoryFields.length === 0) {
      setActiveTab('basic');
    }
  }, [activeTab, categoryFields.length]);

  const categoryInitialStatusId = useMemo(() => {
    if (mode === 'edit') return null; // Edit mode uses existing status
    const initial = (statuses || []).find((s: any) => s.initial === true);
    return (initial || statuses[0])?.id || null;
  }, [statuses, mode]);

  // Load category icon
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cat = categories.find((c: any) => c.id === categoryId);
        if (cat?.icon) {
          const icon = await iconService.getIcon(cat.icon);
          if (!cancelled) setCategoryIcon(icon);
        } else {
          if (!cancelled) setCategoryIcon(null);
        }
      } catch {
        if (!cancelled) setCategoryIcon(null);
      }
    })();
    return () => { cancelled = true; };
  }, [categories, categoryId]);

  const categoryPriorities = useMemo(() => {
    if (!categoryId) {
      if (mode === 'create' || mode === 'create-all') {
        return priorities.filter((p: any) => p.category_id === null || p.category_id === undefined);
      }
      return [];
    }
    
    const categorySpecific = priorities.filter((p: any) => p.category_id === categoryId);
    if (categorySpecific.length > 0) {
      return categorySpecific;
    }
    
    return priorities.filter((p: any) => p.category_id === null || p.category_id === undefined);
  }, [priorities, categoryId, mode]);

  // For create-all mode: show all templates from all DEFAULT workspaces
  // For other modes: show templates filtered by current workspace
  const workspaceTemplates = useMemo(() => {
    if (mode === 'create-all') {
      // Show all enabled templates from DEFAULT workspaces
      return templates.filter((template: any) => {
        if (template?.enabled === false) return false;
        // Find the category for this template
        const cat = categories.find((c: any) => c.id === template.category_id);
        if (!cat) return false;
        // Find the workspace for this category
        const ws = workspaces.find((w: any) => w.id === cat.workspace_id);
        // Only show templates from DEFAULT workspaces
        return ws?.type === "DEFAULT";
      });
    }
    
    // For create and edit modes: filter by current workspace
    if (!currentWorkspace || currentWorkspace.type !== "DEFAULT") {
      return [];
    }
    return templates.filter((template: any) => {
      if (template?.enabled === false) return false;
      return template.category_id === currentWorkspace.category_id;
    });
  }, [templates, currentWorkspace, mode, categories, workspaces]);

  const selectedTemplate = useMemo(() => {
    if (!templateId) return null;
    // Always search in all templates to find the selected one
    const found = templates.find((t: any) => 
      t.id === templateId || 
      Number(t.id) === Number(templateId) ||
      String(t.id) === String(templateId)
    );
    return found || null;
  }, [templateId, templates]);

  const selectedApprovalId = useMemo(() => {
    if (approvalId != null) return Number(approvalId);
    if (selectedTemplate?.approval_id != null) return Number(selectedTemplate.approval_id);
    return null;
  }, [approvalId, selectedTemplate]);

  const selectedApproval = useMemo(() => {
    if (selectedApprovalId == null) return null;
    return approvalMap[selectedApprovalId] || null;
  }, [selectedApprovalId, approvalMap]);

  const spotsApplicable = useMemo(() => {
    if (!selectedTemplate) return true;
    const spotsNotApplicableValue = selectedTemplate.spots_not_applicable;
    const spotsNotApplicable = 
      spotsNotApplicableValue === true || 
      spotsNotApplicableValue === 'true' || 
      spotsNotApplicableValue === 1 || 
      spotsNotApplicableValue === '1';
    return !spotsNotApplicable;
  }, [selectedTemplate]);

  const workspaceUsers = useMemo(() => {
    if (!workspaceId) return [];
    const filtered = users.filter((u: any) => !u.workspace_id || u.workspace_id === workspaceId);
    // Deduplicate by ID to prevent duplicate entries
    const seen = new Set();
    return filtered.filter((u: any) => {
      const id = u.id || String(u.id);
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }, [users, workspaceId]);

  const workspaceSpots = useMemo(() => {
    if (!workspaceId) return [];
    const typeById = new Map(spotTypes.map((st: any) => [st.id, st]));
    return spots.filter((s: any) => {
      const st: any = typeById.get(s.spot_type_id);
      return !st?.workspace_id || st.workspace_id === workspaceId;
    });
  }, [spots, spotTypes, workspaceId]);


  // Get tags for edit mode
  const taskTagIds = useMemo(() => {
    if (mode !== 'edit' || !task?.id) return [];
    return taskTags
      .filter((tt: any) => tt.task_id === Number(task.id))
      .map((tt: any) => Number(tt.tag_id));
  }, [taskTags, task?.id, mode]);

  const taskCustomFieldValueMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const row of taskCustomFieldValues || []) {
      const tId = Number((row as any)?.task_id ?? (row as any)?.taskId);
      const fId = Number((row as any)?.field_id ?? (row as any)?.custom_field_id ?? (row as any)?.fieldId);
      if (!Number.isFinite(tId) || !Number.isFinite(fId)) continue;
      m.set(`${tId}:${fId}`, row);
    }
    return m;
  }, [taskCustomFieldValues]);

  useEffect(() => {
    customFieldValuesRef.current = customFieldValues;
  }, [customFieldValues]);

  // Load related data when dialog opens
  useEffect(() => {
    if (!open) return;
    dispatch(genericActions.tags.getFromIndexedDB());
    dispatch(genericActions.customFields.getFromIndexedDB());
    dispatch(genericActions.categoryCustomFields.getFromIndexedDB());
    dispatch(genericActions.taskCustomFieldValues.getFromIndexedDB());
    if (mode === 'edit') {
      dispatch(genericActions.taskTags.getFromIndexedDB());
    }
  }, [open, mode, dispatch]);

  // Track if form has been initialized to prevent resetting user selections
  const formInitializedRef = useRef(false);

  // Initialize form data - only when dialog opens/closes or mode/task changes
  useEffect(() => {
    if (!open) {
      formInitializedRef.current = false;
      return;
    }

    // Only initialize once when dialog opens
    if (formInitializedRef.current) return;
    formInitializedRef.current = true;

    if (mode === 'edit' && task) {
      // Edit mode: load from task
      setName(task.name || '');
      setDescription(task.description || '');
      setCategoryId(task.category_id ? Number(task.category_id) : null);
      setPriorityId(task.priority_id ? Number(task.priority_id) : null);
      setSpotId(task.spot_id ? Number(task.spot_id) : null);
      setStatusId(task.status_id ? Number(task.status_id) : null);
      setTemplateId(task.template_id ? Number(task.template_id) : null);
      setDueDate(task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '');
      setSelectedUserIds(Array.isArray(task.user_ids) ? task.user_ids.map((id: any) => Number(id)).filter((n: any) => Number.isFinite(n)) : []);
      setSlaId(task.sla_id ? Number(task.sla_id) : null);
      setApprovalId(task.approval_id ? Number(task.approval_id) : null);
      setIsSubmitting(false);
      setActiveTab('basic');
      setShowDescription(!!task.description);
      const currentTaskTagIds = taskTags
        .filter((tt: any) => tt.task_id === Number(task.id))
        .map((tt: any) => Number(tt.tag_id));
      setSelectedTagIds(currentTaskTagIds);
    } else if (mode === 'create') {
      // Create mode: reset form and prefill defaults
      setDescription('');
      setSpotId(null);
      setSelectedUserIds([]);
      setDueDate('');
      setIsSubmitting(false);
      setSlaId(null);
      setApprovalId(null);
      setActiveTab('basic');
      setShowDescription(false);
      setSelectedTagIds([]);
      
      // Prefill defaults
      const firstTemplate = workspaceTemplates[0];
      if (firstTemplate) {
        setTemplateId(firstTemplate.id);
        setCategoryId(firstTemplate.category_id || null);
        const tplPriority = firstTemplate.priority_id ?? firstTemplate.default_priority ?? null;
        setPriorityId(tplPriority);
        setName(firstTemplate.name || '');
        setSlaId(firstTemplate.sla_id || null);
        setApprovalId(firstTemplate.approval_id || null);
        const spotsNotApplicable = firstTemplate.spots_not_applicable === true || firstTemplate.spots_not_applicable === 'true';
        if (spotsNotApplicable) {
          setSpotId(null);
        } else if (firstTemplate.default_spot_id) {
          setSpotId(firstTemplate.default_spot_id);
        }
        const defaultsUsers = normalizeDefaultUserIds((firstTemplate as any).default_user_ids);
        setSelectedUserIds(defaultsUsers);
      } else {
        setTemplateId(null);
        setName('');
        const defaultCategory = workspaceCategories[0];
        setCategoryId(defaultCategory ? defaultCategory.id : null);
        setPriorityId(null);
      }
    } else if (mode === 'create-all') {
      // Create-all mode: reset form only on initial open
      setDescription('');
      setSpotId(null);
      setSelectedUserIds([]);
      setDueDate('');
      setIsSubmitting(false);
      setSlaId(null);
      setApprovalId(null);
      setActiveTab('basic');
      setShowDescription(false);
      setSelectedTagIds([]);
      setCategoryId(null);
      setName('');
      setTemplateId(null);
      setPriorityId(null);
    }
  }, [open, mode, task?.id, taskTags]);

  // Initialize custom field values based on category, defaults, and existing values
  useEffect(() => {
    if (!open) {
      setCustomFieldValues({});
      lastCustomFieldCategoryRef.current = null;
      return;
    }
    if (!categoryId || categoryFields.length === 0) {
      setCustomFieldValues({});
      lastCustomFieldCategoryRef.current = categoryId ?? null;
      return;
    }

    const sameCategory = lastCustomFieldCategoryRef.current === categoryId;
    const prevValues = customFieldValuesRef.current;
    const next: Record<number, any> = {};

    for (const { assignment, field } of categoryFields) {
      const fieldId = Number((field as any)?.id);
      if (!Number.isFinite(fieldId)) continue;

      const existing = (mode === 'edit' && task?.id)
        ? taskCustomFieldValueMap.get(`${task.id}:${fieldId}`)
        : null;

      if (existing) {
        next[fieldId] = deserializeCustomFieldValue(existing, field);
        continue;
      }

      if (sameCategory && prevValues[fieldId] !== undefined) {
        next[fieldId] = prevValues[fieldId];
        continue;
      }

      next[fieldId] = parseDefaultCustomFieldValue(
        (assignment as any)?.default_value ?? (assignment as any)?.defaultValue,
        field
      );
    }

    setCustomFieldValues(next);
    lastCustomFieldCategoryRef.current = categoryId;
  }, [open, categoryId, categoryFields, mode, task?.id, taskCustomFieldValueMap]);
  
  // Separate effect for create mode to prefill defaults when workspaceTemplates/workspaceCategories become available
  useEffect(() => {
    if (!open || mode !== 'create' || formInitializedRef.current) return;
    
    // Only prefill if form is still empty (hasn't been touched)
    if (!templateId && !categoryId && workspaceTemplates.length > 0) {
      const firstTemplate = workspaceTemplates[0];
      if (firstTemplate) {
        setTemplateId(firstTemplate.id);
        setCategoryId(firstTemplate.category_id || null);
        const tplPriority = firstTemplate.priority_id ?? firstTemplate.default_priority ?? null;
        setPriorityId(tplPriority);
        setName(firstTemplate.name || '');
        setSlaId(firstTemplate.sla_id || null);
        setApprovalId(firstTemplate.approval_id || null);
        const spotsNotApplicable = firstTemplate.spots_not_applicable === true || firstTemplate.spots_not_applicable === 'true';
        if (spotsNotApplicable) {
          setSpotId(null);
        } else if (firstTemplate.default_spot_id) {
          setSpotId(firstTemplate.default_spot_id);
        }
        const defaultsUsers = normalizeDefaultUserIds((firstTemplate as any).default_user_ids);
        setSelectedUserIds(defaultsUsers);
      }
    } else if (!categoryId && workspaceCategories.length > 0) {
      const defaultCategory = workspaceCategories[0];
      if (defaultCategory) {
        setCategoryId(defaultCategory.id);
      }
    }
  }, [open, mode, workspaceTemplates, workspaceCategories, templateId, categoryId]);

  // Handle template selection for create-all mode: derive workspace and category from template
  useEffect(() => {
    if (mode === 'create-all' && selectedTemplate) {
      const t = selectedTemplate;
      // Set category from template
      setCategoryId(t.category_id || null);
      // Priority, name, SLA, approval will be set by the template change effect below
    }
  }, [mode, selectedTemplate]);

  // Template change effects
  useEffect(() => {
    if (selectedTemplate && (mode === 'create' || mode === 'create-all')) {
      const t = selectedTemplate;
      setCategoryId(t.category_id || categoryId);
      const tplPriority = t.priority_id ?? t.default_priority;
      if (tplPriority) {
        setPriorityId(tplPriority);
      } else {
        const lowPriority = categoryPriorities.find((p: any) => 
          p.name?.toLowerCase() === 'low'
        );
        setPriorityId(lowPriority?.id || null);
      }
      setName(t.name || '');
      setSlaId(t.sla_id || null);
      setApprovalId(t.approval_id || null);
      const spotsNotApplicable = t.spots_not_applicable === true || t.spots_not_applicable === 'true';
      if (spotsNotApplicable) {
        setSpotId(null);
      } else if (t.default_spot_id) {
        setSpotId(t.default_spot_id);
      }
      const defaultsUsers = normalizeDefaultUserIds((t as any).default_user_ids);
      if (defaultsUsers.length > 0) {
        setSelectedUserIds(defaultsUsers);
      } else {
        setSelectedUserIds([]);
      }
    }
  }, [selectedTemplate, categoryPriorities, categoryId, mode]);

  // Category change effects
  useEffect(() => {
    if ((mode === 'create' || mode === 'create-all') && categoryId && !priorityId) {
      const lowPriority = categoryPriorities.find((p: any) => 
        p.name?.toLowerCase() === 'low'
      );
      if (lowPriority) {
        setPriorityId(lowPriority.id);
      } else {
        const firstPriority = categoryPriorities[0]?.id ?? null;
        setPriorityId(firstPriority);
      }
    }
    if (!categoryId && (mode === 'create' || mode === 'create-all')) {
      setPriorityId(null);
    }
  }, [categoryId, categoryPriorities, priorityId, mode]);

  const handleCustomFieldValueChange = (fieldId: number, value: any) => {
    setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const customFieldRequirementMissing = useMemo(() => {
    if (!categoryFields.length) return false;
    return categoryFields.some(({ assignment, field }) => {
      if (!(assignment as any)?.is_required) return false;
      const fid = Number((field as any)?.id);
      const currentValue = customFieldValues[fid];
      return !isCustomFieldValueFilled(field, currentValue);
    });
  }, [categoryFields, customFieldValues]);

  const canSubmit = useMemo(() => {
    if (mode === 'edit') {
      return Boolean(
        name.trim().length > 0 &&
        workspaceId &&
        categoryId &&
        derivedTeamId &&
        statusId &&
        (priorityId || categoryPriorities.length === 0) &&
        task?.id &&
        !customFieldRequirementMissing
      );
    } else {
      return Boolean(
        name.trim().length > 0 &&
        workspaceId &&
        categoryId &&
        derivedTeamId &&
        categoryInitialStatusId &&
        (priorityId || categoryPriorities.length === 0) &&
        !customFieldRequirementMissing
      );
    }
  }, [name, workspaceId, categoryId, derivedTeamId, statusId, categoryInitialStatusId, priorityId, categoryPriorities.length, task?.id, mode, customFieldRequirementMissing]);

  const syncTaskCustomFields = async (taskId: number) => {
    if (!taskId || categoryFields.length === 0) return;
    let didChange = false;
    const validFieldIds = new Set<number>();
    for (const { field } of categoryFields) {
      const fid = Number((field as any)?.id);
      if (Number.isFinite(fid)) validFieldIds.add(fid);
    }

    const existingByField = new Map<number, any>();
    for (const row of taskCustomFieldValues || []) {
      const tId = Number((row as any)?.task_id ?? (row as any)?.taskId);
      const fId = Number((row as any)?.field_id ?? (row as any)?.custom_field_id ?? (row as any)?.fieldId);
      if (tId === Number(taskId) && Number.isFinite(fId)) {
        existingByField.set(fId, row);
      }
    }

    // Remove values that no longer belong to the current category
    for (const [fieldId, row] of existingByField.entries()) {
      if (!validFieldIds.has(fieldId)) {
        await dispatch(genericActions.taskCustomFieldValues.removeAsync((row as any)?.id ?? fieldId)).unwrap();
        didChange = true;
      }
    }

    for (const { field } of categoryFields) {
      const fieldId = Number((field as any)?.id);
      if (!Number.isFinite(fieldId)) continue;

      const rawValue = customFieldValues[fieldId];
      const hasValue = isCustomFieldValueFilled(field, rawValue);
      const existing = existingByField.get(fieldId);

      if (!hasValue) {
        if (existing) {
          await dispatch(genericActions.taskCustomFieldValues.removeAsync((existing as any)?.id ?? fieldId)).unwrap();
          didChange = true;
        }
        continue;
      }

      const payload = serializeCustomFieldPayload(field, rawValue);
      const body = {
        task_id: Number(taskId),
        field_id: fieldId,
        name: (field as any)?.name ?? '',
        type: String((field as any)?.field_type ?? (field as any)?.type ?? '').toUpperCase(),
        ...payload,
      };

      if (existing) {
        await dispatch(genericActions.taskCustomFieldValues.updateAsync({ id: (existing as any)?.id, updates: body } as any)).unwrap();
        didChange = true;
      } else {
        await dispatch(genericActions.taskCustomFieldValues.addAsync(body as any)).unwrap();
        didChange = true;
      }
    }

    // If any custom field changed, refresh the task to pick up approval_status immediately
    if (didChange) {
      try {
        await dispatch(updateTaskAsync({ id: taskId, updates: {} } as any)).unwrap();
      } catch (err) {
        console.warn('Failed to refresh task after custom field sync', err);
      }
    }
  };

  const renderCustomFieldInput = (field: any, value: any, onChange: (v: any) => void) => {
    const type = normalizeFieldType(field);
    const options = parseFieldOptions(field);

    if (type === 'textarea') {
      return (
        <Textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ingresa un valor..."
          className="min-h-[100px] px-4 py-3 rounded-[10px] text-sm focus:border-[#00BFA5] focus:ring-[3px] focus:ring-[#00BFA5]/10 transition-all duration-150"
        />
      );
    }

    if (type === 'number') {
      return (
        <Input
          type="number"
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ingresa un número"
          className="h-10 px-4 border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background"
        />
      );
    }

    if (type === 'checkbox') {
      return (
        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={coerceBoolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border border-border"
          />
          <span>Marcar</span>
        </label>
      );
    }

    if (type === 'list' || type === 'radio' || type === 'select') {
      return (
        <Select
          value={value ? String(value) : ""}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger 
            className="h-10 px-4 border border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background"
          >
            <SelectValue placeholder="Selecciona una opción" />
          </SelectTrigger>
          <SelectContent>
            {options.length ? options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            )) : (
              <div className="px-2 py-1.5 text-sm text-[#6B7280]">Sin opciones</div>
            )}
          </SelectContent>
        </Select>
      );
    }

    if (type === 'multi_select' || type === 'multi-select' || type === 'multi select') {
      const values = Array.isArray(value) ? value.map(String) : parseMultiValue(value);
      return (
        <div className="[&_button]:border [&_button]:border-black/8 [&_button]:bg-[#F8F9FA] [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-black/12 [&_button]:focus-visible:border-[#00BFA5] [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-[#00BFA5]/10 [&_button]:focus-visible:bg-background">
          <MultiSelectCombobox
            options={options}
            value={values}
            onValueChange={(vals) => onChange(vals)}
            placeholder="Selecciona opciones"
            searchPlaceholder="Buscar..."
            emptyText="Sin opciones"
            className="w-full"
          />
        </div>
      );
    }

    if (type === 'date') {
      return (
        <Input
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 px-4 border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background"
        />
      );
    }

    if (type.startsWith('datetime')) {
      return (
        <Input
          type="datetime-local"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 px-4 border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background"
        />
      );
    }

    if (type === 'time') {
      return (
        <Input
          type="time"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 px-4 border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background"
        />
      );
    }

    // TEXT or fallback
    return (
      <Input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ingresa un valor..."
        className="h-10 px-4 border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background"
      />
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit || !categoryId || !derivedTeamId || !user?.id) return;
    if (mode === 'edit' && (!statusId || !task?.id)) return;
    if ((mode === 'create' || mode === 'create-all') && !categoryInitialStatusId) return;

    try {
      setIsSubmitting(true);
      
      if (mode === 'edit') {
        // Edit mode: update task
        const updates: any = {
          name: name.trim(),
          description: description.trim() || null,
          category_id: categoryId,
          team_id: derivedTeamId,
          priority_id: priorityId ?? 0,
          template_id: templateId,
          sla_id: slaId,
          approval_id: approvalId,
          due_date: dueDate || null,
          user_ids: (Array.isArray(selectedUserIds) && selectedUserIds.length > 0)
            ? selectedUserIds.map((id) => parseInt(String(id), 10)).filter((n) => Number.isFinite(n))
            : [],
        };
        
        if (spotsApplicable) {
          updates.spot_id = spotId;
        }

        await dispatch(updateTaskAsync({ id: Number(task.id), updates })).unwrap();
        
        // Handle tag assignments
        const currentTagIds = new Set(taskTagIds);
        const newTagIds = new Set(selectedTagIds);
        const tagsToAdd = selectedTagIds.filter((tagId: number) => !currentTagIds.has(tagId));
        const tagsToRemove = taskTagIds.filter((tagId: number) => !newTagIds.has(tagId));
        
        for (const tagId of tagsToAdd) {
          await dispatch(genericActions.taskTags.addAsync({
            task_id: Number(task.id),
            tag_id: tagId,
            user_id: user.id,
          })).unwrap();
        }
        
        for (const tagId of tagsToRemove) {
          const taskTag = taskTags.find((tt: any) => 
            tt.task_id === Number(task.id) && tt.tag_id === tagId
          );
          if (taskTag) {
            await dispatch(genericActions.taskTags.removeAsync(taskTag.id)).unwrap();
          }
        }

        await syncTaskCustomFields(Number(task.id));
      } else {
        // Create modes: add task
        const payload: any = {
          name: name.trim(),
          description: description.trim() || null,
          workspace_id: workspaceId!,
          category_id: categoryId,
          team_id: derivedTeamId,
          template_id: templateId,
          status_id: categoryInitialStatusId,
          priority_id: priorityId ?? 0,
          sla_id: slaId,
          approval_id: approvalId,
          start_date: null,
          due_date: dueDate || null,
          expected_duration: (() => {
            const v = selectedTemplate?.expected_duration ?? selectedTemplate?.default_duration ?? 0;
            return Number.isFinite(v) ? v : 0;
          })(),
          response_date: null,
          resolution_date: null,
          work_duration: 0,
          pause_duration: 0,
          user_ids: (Array.isArray(selectedUserIds) && selectedUserIds.length > 0)
            ? selectedUserIds.map((id) => parseInt(String(id), 10)).filter((n) => Number.isFinite(n))
            : [],
        };
        
        if (spotsApplicable) {
          payload.spot_id = spotId;
        }

        const result = await dispatch(addTaskAsync(payload)).unwrap();
        const newTaskId = result?.id;
        
        // Create task tags if any tags were selected (only for create mode, not create-all)
        if (mode === 'create' && newTaskId && selectedTagIds.length > 0) {
          for (const tagId of selectedTagIds) {
            await dispatch(genericActions.taskTags.addAsync({
              task_id: Number(newTaskId),
              tag_id: tagId,
              user_id: user.id,
            })).unwrap();
          }
        }

        if (newTaskId) {
          await syncTaskCustomFields(Number(newTaskId));
        }
      }
      
      onOpenChange(false);
    } catch (e) {
      // Error is handled by slice; keep dialog open for correction
    } finally {
      setIsSubmitting(false);
    }
  };


  // Early return for edit mode if no task
  if (mode === 'edit' && !task) return null;

  // Main form (create, edit, or create-all after category selection)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        onInteractOutside={(e) => {
          if (isSubmitting) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (!isSubmitting) {
            onOpenChange(false);
          } else {
            e.preventDefault();
          }
        }}
        className={`w-full ${mode === 'create-all' ? 'sm:w-[1050px] max-w-[1050px]' : 'sm:w-[1400px] max-w-[1400px]'} p-0 m-0 top-0 gap-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 flex flex-col h-full`}
      >
        {/* Header Section - Fixed */}
        <SheetHeader className="relative px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b border-border/40 overflow-hidden bg-gradient-to-br from-[#00BFA5]/5 via-transparent to-transparent flex-shrink-0">
          <div className={`flex items-center gap-3 flex-1 min-w-0 ${mode === 'edit' ? 'mb-2' : ''}`}>
            <SheetTitle className="text-xl sm:text-2xl font-semibold font-[600] text-foreground flex-shrink-0">
              {mode === 'edit' ? 'Edit Task' : 'Create New Task'}
            </SheetTitle>
            {categoryId && categoryIcon && (
              <FontAwesomeIcon
                icon={categoryIcon}
                style={{ color: currentCategory?.color }}
                className="w-5 h-5 flex-shrink-0"
              />
            )}
            {categoryId && currentCategory && (
              <span className="text-sm text-[#6B7280] font-medium whitespace-nowrap truncate">
                {currentCategory.name}
              </span>
            )}
          </div>
        </SheetHeader>

        {/* Content Area - Scrollable */}
        <div className="flex flex-col flex-1 min-h-0 overflow-auto">
          {/* Tabs Navigation */}
          <div className="px-4 sm:px-6 pt-2 sm:pt-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="inline-flex h-auto p-0 pr-6 bg-transparent border-b border-border/40 rounded-none gap-0 w-full overflow-x-auto">
                <TabsTrigger 
                  value="basic" 
                  className="px-0 py-3 mr-4 sm:mr-8 text-sm font-medium text-[#6B7280] data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-[#00BFA5] rounded-none transition-all duration-150 ease-in-out"
                >
                  Basic Details
                </TabsTrigger>
                {categoryFields.length > 0 && (
                  <TabsTrigger 
                    value="customFields" 
                    className="px-0 py-3 mr-4 sm:mr-8 text-sm font-medium text-[#6B7280] data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-[#00BFA5] rounded-none transition-all duration-150 ease-in-out"
                  >
                    Fields
                    {customFieldRequirementMissing && (
                      <span className="ml-2 text-[11px] text-red-500 font-semibold align-middle">●</span>
                    )}
                  </TabsTrigger>
                )}
                <TabsTrigger 
                  value="additional" 
                  className="px-0 py-3 text-sm font-medium text-[#6B7280] data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-[#00BFA5] rounded-none transition-all duration-150 ease-in-out"
                >
                  Additional Info
                </TabsTrigger>
              </TabsList>
              
              {/* Basic Details Tab */}
              <TabsContent value="basic" className="mt-0 pt-4 sm:pt-6 px-4 sm:px-6 pb-6 space-y-4 data-[state=inactive]:hidden">
                {/* Template Selection */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="template" className="text-sm font-medium font-[500] text-foreground">
                    Template
                  </Label>
                  {mode === 'create-all' ? (
                    // For create-all mode: show all templates from all DEFAULT workspaces
                    workspaceTemplates.length === 0 ? (
                      <div className="[&_button]:border [&_button]:border-black/8 [&_button]:bg-[#F8F9FA] [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-black/12 [&_button]:focus-visible:border-[#00BFA5] [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-[#00BFA5]/10 [&_button]:focus-visible:bg-background">
                        <Combobox
                          options={[]}
                          value={undefined}
                          onValueChange={() => {}}
                          placeholder="No templates available"
                          searchPlaceholder="Search templates..."
                          emptyText="No templates available"
                          className="w-full"
                        />
                      </div>
                    ) : (
                      <div className="[&_button]:border [&_button]:border-black/8 [&_button]:bg-[#F8F9FA] [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-black/12 [&_button]:focus-visible:border-[#00BFA5] [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-[#00BFA5]/10 [&_button]:focus-visible:bg-background">
                        <Combobox
                          options={workspaceTemplates.map((t: any) => ({
                            value: String(t.id),
                            label: t.name,
                          }))}
                          value={templateId ? String(templateId) : undefined}
                          onValueChange={(v) => {
                            // Always set the template, don't allow deselection by clicking the same item
                            if (v) {
                              const newTemplateId = parseInt(v, 10);
                              console.log('[TaskDialog create-all] Setting templateId:', newTemplateId, 'from value:', v);
                              setTemplateId(newTemplateId);
                            } else {
                              console.log('[TaskDialog create-all] Template deselected, ignoring');
                            }
                          }}
                          placeholder="Select template"
                          searchPlaceholder="Search templates..."
                          emptyText="No templates found."
                          className="w-full"
                        />
                      </div>
                    )
                  ) : (
                    // For create and edit modes: show templates filtered by workspace
                    !currentWorkspace || currentWorkspace.type !== "DEFAULT" ? (
                      <div className="[&_button]:border [&_button]:border-black/8 [&_button]:bg-[#F8F9FA] [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-black/12 [&_button]:focus-visible:border-[#00BFA5] [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-[#00BFA5]/10 [&_button]:focus-visible:bg-background">
                        <Combobox
                          options={[]}
                          value={undefined}
                          onValueChange={() => {}}
                          placeholder="Templates only available for default workspaces"
                          searchPlaceholder="Search templates..."
                          emptyText="No templates available"
                          className="w-full"
                        />
                      </div>
                    ) : workspaceTemplates.length === 0 ? (
                      <div className="[&_button]:border [&_button]:border-black/8 [&_button]:bg-[#F8F9FA] [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-black/12 [&_button]:focus-visible:border-[#00BFA5] [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-[#00BFA5]/10 [&_button]:focus-visible:bg-background">
                        <Combobox
                          options={[]}
                          value={undefined}
                          onValueChange={() => {}}
                          placeholder="No templates available"
                          searchPlaceholder="Search templates..."
                          emptyText="No templates available"
                          className="w-full"
                        />
                      </div>
                    ) : (
                      <div className="[&_button]:border [&_button]:border-black/8 [&_button]:bg-[#F8F9FA] [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-black/12 [&_button]:focus-visible:border-[#00BFA5] [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-[#00BFA5]/10 [&_button]:focus-visible:bg-background">
                        <Combobox
                          options={workspaceTemplates.map((t: any) => ({
                            value: String(t.id),
                            label: t.name,
                          }))}
                          value={templateId ? String(templateId) : undefined}
                          onValueChange={(v) => {
                            // Always set the template, don't allow deselection by clicking the same item
                            if (v) {
                              setTemplateId(parseInt(v, 10));
                            }
                          }}
                          placeholder="Select template"
                          searchPlaceholder="Search templates..."
                          emptyText="No templates found."
                          className="w-full"
                        />
                      </div>
                    )
                  )}
                  {!workspaceTemplates.length && (
                    <p className="text-xs text-[#6B7280] mt-1">
                      {mode === 'create-all'
                        ? 'No templates available. Enable or create templates in default workspaces first.'
                        : !currentWorkspace || currentWorkspace.type !== "DEFAULT"
                        ? 'Templates are only available for default workspaces.'
                        : 'No templates available in this workspace. Enable or create templates first.'
                      }
                    </p>
                  )}
                </div>

                {/* Template summary / approvals */}
                {(mode === 'create' || mode === 'create-all' || mode === 'edit') && selectedApprovalId && (
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-100 bg-blue-50 text-sm text-blue-900">
                    <div className="mt-0.5">
                      {selectedApproval ? (
                        <ShieldCheck className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Clock className="w-4 h-4 text-blue-600 animate-spin" />
                      )}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs uppercase tracking-wide font-semibold text-blue-700">Approval required</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-white text-blue-700 border border-blue-100 font-semibold">Pending</span>
                      </div>
                      <div className="font-semibold truncate">
                        {selectedApproval?.name || `Approval #${selectedApprovalId}`}
                      </div>
                      <div className="text-xs text-blue-800 truncate">
                        {selectedApproval?.trigger_type
                          ? `Trigger: ${String(selectedApproval.trigger_type).replace(/_/g, ' ').toLowerCase()}`
                          : 'Will start once the task is created'}
                      </div>
                      {selectedApproval?.deadline_value && (
                        <div className="text-xs text-blue-800 truncate">
                          Deadline: {selectedApproval.deadline_value} {selectedApproval.deadline_type || 'hours'}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Description - Collapsible */}
                {!showDescription ? (
                  <button
                    type="button"
                    onClick={() => setShowDescription(true)}
                    className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-foreground transition-colors duration-150 py-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{description.trim() ? 'Show description' : 'Add description'}</span>
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="task-desc" className="text-sm font-medium font-[500] text-foreground">
                        Description
                      </Label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDescription(false);
                          if (!description.trim()) {
                            setDescription('');
                          }
                        }}
                        className="text-[#6B7280] hover:text-foreground transition-colors duration-150 p-1"
                        aria-label="Hide description"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                    </div>
                    <Textarea 
                      id="task-desc" 
                      value={description} 
                      onChange={(e) => {
                        setDescription(e.target.value);
                        if (e.target.value.trim() && !showDescription) {
                          setShowDescription(true);
                        }
                      }}
                      placeholder="Add a description for this task..." 
                      className="min-h-[120px] px-4 py-4 rounded-[12px] text-sm resize-y focus:border-[#00BFA5] focus:ring-[3px] focus:ring-[#00BFA5]/10 transition-all duration-150" 
                    />
                  </div>
                )}

                {/* Location */}
                {(() => {
                  if (!spotsApplicable) return null;
                  if (selectedTemplate) {
                    const spotsNotApplicableValue = selectedTemplate.spots_not_applicable;
                    const isNotApplicable = 
                      spotsNotApplicableValue === true || 
                      spotsNotApplicableValue === 'true' || 
                      spotsNotApplicableValue === 1 || 
                      spotsNotApplicableValue === '1';
                    if (isNotApplicable) return null;
                  }
                  
                  return (
                    <div className="flex flex-col gap-2">
                      <Label className="text-sm font-medium font-[500] text-foreground">
                        Location
                      </Label>
                      <div className="[&_button]:border [&_button]:border-black/8 [&_button]:bg-[#F8F9FA] [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-black/12 [&_button]:focus-visible:border-[#00BFA5] [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-[#00BFA5]/10 [&_button]:focus-visible:bg-background">
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
                          className="w-full"
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Responsible */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium font-[500] text-foreground">
                    Responsible
                  </Label>
                  <div className="[&_button]:border [&_button]:border-black/8 [&_button]:bg-[#F8F9FA] [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-black/12 [&_button]:focus-visible:border-[#00BFA5] [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-[#00BFA5]/10 [&_button]:focus-visible:bg-background">
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
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Priority */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium font-[500] text-foreground">
                    Priority
                  </Label>
                  <Select value={priorityId ? String(priorityId) : ""} onValueChange={(v) => setPriorityId(v ? parseInt(v, 10) : null)}>
                    <SelectTrigger 
                      className="h-10 px-4 border border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background"
                    >
                      <SelectValue placeholder={categoryPriorities.length ? 'Select priority' : 'No priorities'} />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryPriorities.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-2 h-2 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: p.color }}
                            />
                            <span>{p.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              </TabsContent>

              {/* Custom Fields Tab */}
              {categoryFields.length > 0 && (
              <TabsContent value="customFields" className="mt-0 pt-4 sm:pt-6 px-4 sm:px-6 pb-6 space-y-4 data-[state=inactive]:hidden">
                {!categoryId ? (
                  <p className="text-sm text-[#6B7280]">Selecciona una categoría para ver los campos personalizados.</p>
                ) : categoryFields.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">Esta categoría no tiene campos personalizados asignados.</p>
                ) : (
                  <div className="space-y-4">
                    {categoryFields.map(({ assignment, field }) => {
                      const fieldId = Number((field as any)?.id);
                      const required = (assignment as any)?.is_required;
                      const currentValue = customFieldValues[fieldId];
                      const showError = required && !isCustomFieldValueFilled(field, currentValue);

                      return (
                        <div key={fieldId} className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm font-medium font-[500] text-foreground">
                              {(field as any)?.name ?? 'Campo'}
                            </Label>
                            {required && (
                              <span className="text-[11px] text-red-500 font-semibold">Requerido</span>
                            )}
                          </div>
                          {renderCustomFieldInput(field, currentValue, (v) => handleCustomFieldValueChange(fieldId, v))}
                          {showError && (
                            <p className="text-xs text-red-500">Completa este campo para continuar.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
              )}


              {/* Additional Info Tab */}
              <TabsContent value="additional" className="mt-0 pt-4 sm:pt-6 px-4 sm:px-6 pb-6 space-y-4 data-[state=inactive]:hidden">
                {/* Tags - Only for create and edit modes */}
                {(mode === 'create' || mode === 'edit') && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium font-[500] text-foreground">
                      Tags
                    </Label>
                    <div className="[&_button]:border [&_button]:border-black/8 [&_button]:bg-[#F8F9FA] [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-black/12 [&_button]:focus-visible:border-[#00BFA5] [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-[#00BFA5]/10 [&_button]:focus-visible:bg-background">
                      <TagMultiSelect
                        tags={tags}
                        value={selectedTagIds}
                        onValueChange={(values) => {
                          setSelectedTagIds(values);
                        }}
                        placeholder="Select tags..."
                        searchPlaceholder="Search tags..."
                        emptyText="No tags found."
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
                {/* SLA */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium font-[500] text-foreground">
                    SLA
                  </Label>
                  <Select value={slaId ? String(slaId) : ""} onValueChange={(v) => setSlaId(v ? parseInt(v, 10) : null)}>
                    <SelectTrigger 
                      className="h-10 px-4 border border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background"
                    >
                      <SelectValue placeholder="Select SLA (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(slas) && slas.length > 0 ? (
                        slas.filter((s: any) => s.enabled !== false).map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name || `SLA ${s.id}`}</SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-[#6B7280]">No SLAs available</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Approval */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium font-[500] text-foreground">Approval</Label>
                  <Select value={approvalId ? String(approvalId) : ""} onValueChange={(v) => setApprovalId(v ? parseInt(v, 10) : null)}>
                    <SelectTrigger 
                      className="h-10 px-4 border border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background"
                    >
                      <SelectValue placeholder="Select approval (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(approvals) && approvals.length > 0 ? (
                        approvals.filter((a: any) => a.is_active !== false).map((a: any) => (
                          <SelectItem key={a.id} value={String(a.id)}>{a.name || `Approval ${a.id}`}</SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-[#6B7280]">No approvals available</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Due Date */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="due" className="text-sm font-medium font-[500] text-foreground">
                    Due Date
                  </Label>
                  <Input 
                    id="due" 
                    type="date" 
                    value={dueDate} 
                    onChange={(e) => setDueDate(e.target.value)} 
                    className="h-10 px-4 border-black/8 bg-[#F8F9FA] rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-black/12 focus-visible:border-[#00BFA5] focus-visible:ring-[3px] focus-visible:ring-[#00BFA5]/10 focus-visible:bg-background" 
                  />
                </div>

              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Footer Actions - Fixed */}
        <div className={`flex-shrink-0 border-t border-border/40 px-4 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-6 bg-background`}>
          <div className={`flex ${mode === 'create-all' ? 'flex-col sm:flex-row items-stretch sm:items-center' : 'items-center'} justify-end gap-3`}>
            <Button 
              variant={mode === 'create-all' ? 'ghost' : 'outline'}
              onClick={() => onOpenChange(false)} 
              disabled={isSubmitting} 
              className={mode === 'create-all' 
                ? "h-12 px-6 text-[#6B7280] border border-black/20 bg-transparent hover:bg-[#F3F4F6] rounded-[10px] transition-all duration-200 font-medium order-3 sm:order-2"
                : "h-11 px-6 rounded-[10px] font-medium transition-all duration-150"
              }
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!canSubmit || isSubmitting} 
              className={mode === 'create-all'
                ? "h-12 px-8 bg-[#00BFA5] hover:bg-[#00AA92] text-white rounded-[10px] transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-3"
                : "h-11 px-6 rounded-[10px] font-medium bg-[#00BFA5] hover:bg-[#00BFA5]/90 text-white transition-all duration-150"
              }
            >
              {isSubmitting 
                ? (mode === 'edit' ? 'Saving...' : 'Creating...') 
                : (mode === 'edit' ? 'Save Changes' : 'Create Task')
              }
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

