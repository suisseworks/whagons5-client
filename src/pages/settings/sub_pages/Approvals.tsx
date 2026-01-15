import { useMemo, useCallback, useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { faSquareCheck, faUsers, faPlus, faTrash, faCircleQuestion, faBook, faCheckCircle, faClock, faExclamationTriangle, faInfoCircle, faLock, faGripVertical, faBolt } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Approval, ApprovalApprover, ApprovalCondition, CustomField, Status } from "@/store/types";
import { genericActions } from "@/store/genericSlices";
import type { AppDispatch } from "@/store/store";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/animated/Tabs";
import { UrlTabs } from "@/components/ui/url-tabs";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer,
  ApprovalApproversManager,
  TextField,
  TextAreaField,
  SelectField,
  CheckboxField,
} from "../components";
import { useLanguage } from "@/providers/LanguageProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApprovalActionsDialog } from "./approvals/ApprovalActionsDialog";

// Compact name/description cell similar to Teams with type indicator (S/P)
const NameCell = (props: ICellRendererParams) => {
  const name = props.value as string;
  const description = props.data?.description as string | null | undefined;
  const isActive = props.data?.is_active !== false;
  const typeRaw = String((props.data?.approval_type || '') as string).toUpperCase();
  const isParallel = typeRaw === 'PARALLEL';
  const letter = isParallel ? 'P' : 'S';
  const color = isParallel ? 'bg-emerald-500' : 'bg-blue-500';
  return (
    <div className="flex items-center space-x-3 h-full">
      <div className={`h-6 w-6 rounded-full ${color} text-white text-xs font-semibold flex items-center justify-center shrink-0`}>{letter}</div>
      <div className="flex flex-col leading-tight">
        <span className={`truncate ${isActive ? '' : 'line-through opacity-60'}`}>{name}</span>
        {description ? (
          <span className={`text-xs text-muted-foreground truncate ${isActive ? '' : 'line-through opacity-60'}`}>{description}</span>
        ) : null}
      </div>
    </div>
  );
};

const formatTemplate = (template: string, params: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : `{${key}}`
  );

type TriggerType = 'ON_CREATE' | 'MANUAL' | 'CONDITIONAL';
type ApprovalFlowType = 'SEQUENTIAL' | 'PARALLEL';
type DeadlineType = 'hours' | 'date';
type ConditionValueType = 'string' | 'number' | 'boolean' | 'date' | 'option';
type ConditionOperator = ApprovalCondition['operator'];

type ConditionFieldOption = {
  value: string;
  label: string;
  source: 'task_field' | 'custom_field';
  valueType: ConditionValueType;
  customFieldId?: number;
  options?: Array<{ value: string | number; label: string }>;
};

type TranslateFn = (key: string, fallback: string) => string;

type ApprovalFormState = {
  name: string;
  description: string;
  approval_type: ApprovalFlowType;
  require_all: boolean;
  minimum_approvals: number | string | '';
  trigger_type: TriggerType;
  trigger_conditions: ApprovalCondition[];
  require_rejection_comment: boolean;
  block_editing_during_approval: boolean;
  deadline_type: DeadlineType;
  deadline_value: string;
  order_index: number;
  is_active: boolean;
  on_approved_actions?: any[];
  on_rejected_actions?: any[];
};

const CONDITION_OPERATORS_BY_TYPE: Record<ConditionValueType, ConditionOperator[]> = {
  string: ['contains', 'eq', 'ne', 'starts_with', 'ends_with'],
  number: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],
  boolean: ['eq', 'ne'],
  date: ['eq', 'gt', 'lt'],
  option: ['eq', 'ne'],
};

const CONDITION_OPERATOR_LABELS = (ta: TranslateFn) => ({
  eq: ta('conditions.operators.eq', 'is equal to'),
  ne: ta('conditions.operators.ne', 'is not equal to'),
  gt: ta('conditions.operators.gt', 'is greater than'),
  gte: ta('conditions.operators.gte', 'is greater than or equal to'),
  lt: ta('conditions.operators.lt', 'is less than'),
  lte: ta('conditions.operators.lte', 'is less than or equal to'),
  contains: ta('conditions.operators.contains', 'contains'),
  not_contains: ta('conditions.operators.not_contains', 'does not contain'),
  starts_with: ta('conditions.operators.starts_with', 'starts with'),
  ends_with: ta('conditions.operators.ends_with', 'ends with'),
  is_set: ta('conditions.operators.is_set', 'is set'),
  is_not_set: ta('conditions.operators.is_not_set', 'is not set'),
});

const CONDITION_OPERATOR_DISPLAY = (ta: TranslateFn) => ({
  eq: ta('conditions.operatorsShort.eq', '='),
  ne: ta('conditions.operatorsShort.ne', '≠'),
  gt: ta('conditions.operatorsShort.gt', '>'),
  gte: ta('conditions.operatorsShort.gte', '≥'),
  lt: ta('conditions.operatorsShort.lt', '<'),
  lte: ta('conditions.operatorsShort.lte', '≤'),
  contains: ta('conditions.operatorsShort.contains', 'contiene'),
  not_contains: ta('conditions.operatorsShort.not_contains', 'no contiene'),
  starts_with: ta('conditions.operatorsShort.starts_with', 'empieza con'),
  ends_with: ta('conditions.operatorsShort.ends_with', 'termina con'),
  is_set: ta('conditions.operatorsShort.is_set', 'definido'),
  is_not_set: ta('conditions.operatorsShort.is_not_set', 'no definido'),
});

const DEFAULT_OPERATOR_BY_TYPE: Record<ConditionValueType, ConditionOperator> = {
  string: 'contains',
  number: 'eq',
  boolean: 'eq',
  date: 'eq',
  option: 'eq',
};

const createConditionId = () => `cond_${Math.random().toString(36).slice(2, 9)}`;

const mapCustomFieldTypeToValueType = (fieldType?: string | null): ConditionValueType => {
  const normalized = (fieldType || '').toUpperCase();
  switch (normalized) {
    case 'NUMBER':
      return 'number';
    case 'CHECKBOX':
      return 'boolean';
    case 'DATE':
    case 'TIME':
    case 'DATETIME':
      return 'date';
    case 'LIST':
    case 'RADIO':
    case 'MULTI_SELECT':
      return 'option';
    default:
      return 'string';
  }
};

const normalizeOptionEntries = (options: any): Array<{ value: string | number; label: string }> => {
  if (!options) return [];
  if (Array.isArray(options)) {
    return options.map((opt, index) => {
      if (opt && typeof opt === 'object') {
        const val = Object.prototype.hasOwnProperty.call(opt, 'value') ? opt.value : (opt.id ?? index);
        const label = opt.label ?? opt.name ?? String(val);
        return { value: val, label: String(label) };
      }
      return { value: opt, label: String(opt) };
    });
  }
  if (typeof options === 'string') {
    try {
      return normalizeOptionEntries(JSON.parse(options));
    } catch {
      return [];
    }
  }
  if (typeof options === 'object') {
    return Object.entries(options).map(([key, val]) => ({
      value: key,
      label: String(val),
    }));
  }
  return [];
};

const buildConditionFieldOptions = (
  statuses: Status[],
  customFields: CustomField[],
  ta: TranslateFn,
  extra?: {
    priorities?: Array<{ id: number; name?: string; category_id?: number | null }>;
    categories?: Array<{ id: number; name?: string }>;
    slas?: Array<{ id: number; name?: string }>;
  }
): ConditionFieldOption[] => {
  const fieldOptions: ConditionFieldOption[] = [];

  if ((statuses || []).length) {
    fieldOptions.push({
      value: 'status_id',
      label: ta('conditions.fields.status', 'Task status'),
      source: 'task_field',
      valueType: 'option',
      options: statuses.map((status) => ({
        value: status.id,
        label: status.name || `Status #${status.id}`,
      })),
    });
  }

  if ((extra?.priorities || []).length) {
    fieldOptions.push({
      value: 'priority_id',
      label: ta('conditions.fields.priority', 'Priority'),
      source: 'task_field',
      valueType: 'option',
      options: (extra?.priorities || []).map((p) => ({
        value: p.id,
        label: p.name || `Priority #${p.id}`,
      })),
    });
  }

  if ((extra?.categories || []).length) {
    fieldOptions.push({
      value: 'category_id',
      label: ta('conditions.fields.category', 'Category'),
      source: 'task_field',
      valueType: 'option',
      options: (extra?.categories || []).map((c) => ({
        value: c.id,
        label: c.name || `Category #${c.id}`,
      })),
    });
  }

  if ((extra?.slas || []).length) {
    fieldOptions.push({
      value: 'sla_id',
      label: ta('conditions.fields.sla', 'SLA'),
      source: 'task_field',
      valueType: 'option',
      options: (extra?.slas || []).map((s) => ({
        value: s.id,
        label: s.name || `SLA #${s.id}`,
      })),
    });
  }

  fieldOptions.push(
    {
      value: 'start_date',
      label: ta('conditions.fields.startDate', 'Start date'),
      source: 'task_field',
      valueType: 'date',
    },
    {
      value: 'due_date',
      label: ta('conditions.fields.dueDate', 'Due date'),
      source: 'task_field',
      valueType: 'date',
    },
    {
      value: 'expected_duration',
      label: ta('conditions.fields.expectedDuration', 'Expected duration (min)'),
      source: 'task_field',
      valueType: 'number',
    }
  );

  const customPrefix = ta('conditions.fields.customPrefix', 'Custom field');
  (customFields || []).forEach((field) => {
    fieldOptions.push({
      value: `custom_field:${field.id}`,
      label: field.name || `${customPrefix} #${field.id}`,
      source: 'custom_field',
      valueType: mapCustomFieldTypeToValueType(field.field_type),
      customFieldId: field.id,
      options: normalizeOptionEntries(field.options),
    });
  });

  return fieldOptions;
};

const defaultValueForType = (type: ConditionValueType, option?: ConditionFieldOption): any => {
  switch (type) {
    case 'boolean':
      return true;
    case 'option':
      return option?.options?.[0]?.value ?? null;
    case 'number':
    case 'date':
      return '';
    default:
      return '';
  }
};

const normalizeConditionValue = (value: any, valueType?: ConditionValueType) => {
  switch (valueType) {
    case 'number':
      if (value === '' || value === null || value === undefined) return null;
      return Number(value);
    case 'boolean':
      if (typeof value === 'string') return value === 'true';
      return Boolean(value);
    case 'option':
      if (value === '' || value === null || value === undefined) return null;
      if (typeof value === 'number') return value;
      if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
        return Number(value);
      }
      return value;
    case 'date':
      return value || '';
    default:
      return value ?? '';
  }
};

const sanitizeConditionsForSubmit = (conditions: ApprovalCondition[]): ApprovalCondition[] => {
  return (conditions || [])
    .filter((condition) => condition && condition.field && condition.operator)
    .map((condition, index) => {
      const valueType = (condition.value_type as ConditionValueType) ?? 'string';
      const normalizedValue = normalizeConditionValue(condition.value, valueType);
      return {
        ...condition,
        id: condition.id || createConditionId() || `cond_${index}`,
        value: normalizedValue,
        value_type: valueType,
      };
    })
    .filter((condition) => {
      if (condition.value_type === 'boolean') return true;
      if (condition.value_type === 'option' || condition.value_type === 'number') {
        return condition.value !== null && condition.value !== '';
      }
      return (condition.value ?? '') !== '';
    });
};

const createEmptyFormState = (): ApprovalFormState => ({
  name: '',
  description: '',
  approval_type: 'SEQUENTIAL',
  require_all: true,
  minimum_approvals: '',
  trigger_type: 'ON_CREATE',
  trigger_conditions: [],
  require_rejection_comment: false,
  block_editing_during_approval: false,
  deadline_type: 'hours',
  deadline_value: '',
  order_index: 0,
  is_active: true,
});

type ConditionBuilderProps = {
  conditions: ApprovalCondition[];
  onChange: (next: ApprovalCondition[]) => void;
  fieldOptions: ConditionFieldOption[];
  ta: TranslateFn;
};

const ConditionBuilder = ({ conditions, onChange, fieldOptions, ta }: ConditionBuilderProps) => {
  const { optionsByValue, selectOptions } = useMemo(() => {
    const map = new Map<string, ConditionFieldOption>();
    const combined = [...fieldOptions];
    fieldOptions.forEach((option) => map.set(option.value, option));
    conditions.forEach((condition, index) => {
      const key = condition.field || `missing-${index}`;
      if (!map.has(key) && condition.field) {
        const fallbackOption: ConditionFieldOption = {
          value: condition.field,
          label: condition.label || condition.field,
          source: (condition.source as any) || 'task_field',
          valueType: (condition.value_type as ConditionValueType) || 'string',
          customFieldId: condition.custom_field_id ?? undefined,
        };
        map.set(condition.field, fallbackOption);
        combined.push(fallbackOption);
      }
    });
    return {
      optionsByValue: map,
      selectOptions: combined,
    };
  }, [fieldOptions, conditions]);

  const operatorLabels = useMemo(() => CONDITION_OPERATOR_LABELS(ta), [ta]);
  const operatorDisplayLabels = useMemo(() => CONDITION_OPERATOR_DISPLAY(ta), [ta]);

  const addCondition = () => {
    const firstField = fieldOptions.find((option) => !option.value.startsWith('__divider__'));
    if (!firstField) return;
    onChange([
      ...conditions,
      {
        id: createConditionId(),
        field: firstField.value,
        label: firstField.label,
        source: firstField.source,
        custom_field_id: firstField.customFieldId,
        operator: DEFAULT_OPERATOR_BY_TYPE[firstField.valueType],
        value: defaultValueForType(firstField.valueType, firstField),
        value_type: firstField.valueType,
        value_label: undefined,
        metadata: undefined,
      },
    ]);
  };

  const updateCondition = (id: string, updates: Partial<ApprovalCondition>) => {
    onChange(
      conditions.map((condition) =>
        (condition.id || condition.field) === id
          ? { ...condition, ...updates }
          : condition
      )
    );
  };

  const removeCondition = (id: string) => {
    onChange(conditions.filter((condition) => (condition.id || condition.field) !== id));
  };

  const handleFieldChange = (id: string, nextValue: string) => {
    const fieldOption = optionsByValue.get(nextValue);
    const valueType = fieldOption?.valueType ?? 'string';
    updateCondition(id, {
      field: nextValue,
      label: fieldOption?.label,
      source: fieldOption?.source,
      custom_field_id: fieldOption?.customFieldId,
      value_type: valueType,
      operator: DEFAULT_OPERATOR_BY_TYPE[valueType],
      value: defaultValueForType(valueType, fieldOption),
      value_label: fieldOption?.options?.[0]?.label,
    });
  };

  const handleOperatorChange = (id: string, nextOperator: ConditionOperator) => {
    updateCondition(id, { operator: nextOperator });
  };

  const handleValueChange = (
    id: string,
    rawValue: string | number | boolean,
    fieldOption?: ConditionFieldOption,
    valueType?: ConditionValueType
  ) => {
    const resolvedType = valueType ?? 'string';
    if (resolvedType === 'boolean') {
      updateCondition(id, { value: Boolean(rawValue) });
      return;
    }

    if (resolvedType === 'option') {
      const optionValue = String(rawValue);
      const matched = fieldOption?.options?.find((opt) => String(opt.value) === optionValue);
      updateCondition(id, {
        value: matched?.value ?? optionValue,
        value_label: matched?.label ?? optionValue,
      });
      return;
    }

    updateCondition(id, { value: rawValue });
  };

  const valueLabel = ta('conditions.valueLabel', 'Value');
  const operatorLabel = ta('conditions.operatorLabel', 'Operator');
  const fieldLabel = ta('conditions.fieldLabel', 'Field');
  const helper = ta('conditions.helper', 'All conditions must be met to trigger this approval.');
  const emptyCopy = ta('conditions.empty', 'Add at least one condition to define when this approval should run.');
  const sectionTitle = ta('conditions.sectionTitle', 'Conditions');
  const addLabel = ta('conditions.add', 'Add condition');
  const removeLabel = ta('conditions.remove', 'Remove');

  return (
    <div className="rounded-md border border-border p-4 space-y-4 bg-muted/20">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-medium">{sectionTitle}</p>
            <p className="text-sm text-muted-foreground">{helper}</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addCondition} disabled={!fieldOptions.length}>
            {addLabel}
          </Button>
        </div>
      </div>

      {!conditions.length ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-md p-4">
          {emptyCopy}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3 text-xs font-semibold text-muted-foreground px-1">
            <span>{fieldLabel}</span>
            <span>{operatorLabel}</span>
            <span>{valueLabel}</span>
          </div>
          {conditions.map((condition, index) => {
            const conditionId = condition.id || `${condition.field}-${index}`;
            const fieldOption = optionsByValue.get(condition.field);
            const valueType = (condition.value_type as ConditionValueType) ?? fieldOption?.valueType ?? 'string';
            const operators = CONDITION_OPERATORS_BY_TYPE[valueType] ?? CONDITION_OPERATORS_BY_TYPE.string;

            return (
              <div key={conditionId} className="rounded-md border border-border bg-background p-3 space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <SelectField
                    id={`condition-field-${conditionId}`}
                    label=""
                    value={condition.field}
                    onChange={(val) => handleFieldChange(conditionId, val)}
                    options={selectOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />

                  <SelectField
                    id={`condition-operator-${conditionId}`}
                    label=""
                    value={condition.operator}
                    onChange={(val) => handleOperatorChange(conditionId, val as ConditionOperator)}
                    options={operators.map((operator) => ({
                      value: operator,
                      label: operatorDisplayLabels[operator] ?? operatorLabels[operator] ?? operator,
                    }))}
                  />

                  {valueType === 'boolean' ? (
                    <CheckboxField
                      id={`condition-value-${conditionId}`}
                      label={valueLabel}
                      checked={Boolean(condition.value ?? true)}
                      onChange={(checked) => handleValueChange(conditionId, checked, fieldOption, valueType)}
                      hideFieldLabel
                    />
                  ) : valueType === 'option' ? (
                    <SelectField
                      id={`condition-value-${conditionId}`}
                      label=""
                      value={String(condition.value ?? '')}
                      onChange={(val) => handleValueChange(conditionId, val, fieldOption, valueType)}
                      options={(fieldOption?.options || []).map((opt) => ({
                        value: opt.value,
                        label: opt.label,
                      }))}
                      placeholder={ta('conditions.valuePlaceholder', 'Select a value')}
                    />
                  ) : (
                    <TextField
                      id={`condition-value-${conditionId}`}
                      label=""
                      type={valueType === 'number' ? 'number' : valueType === 'date' ? 'date' : 'text'}
                      value={String(condition.value ?? '')}
                      onChange={(val) => handleValueChange(conditionId, val, fieldOption, valueType)}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {ta('conditions.logicHint', 'All conditions are evaluated with AND logic.')}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCondition(conditionId)}
                  >
                    {removeLabel}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

function Approvals() {
  const dispatch = useDispatch<AppDispatch>();
  const { t } = useLanguage();
  const ta = useCallback(
    (key: string, fallback: string) => t(`settings.approvals.${key}`, fallback),
    [t]
  );

  const {
    filteredItems,
    loading,
    error,
    handleEdit,
    deleteItem,
    isDeleteDialogOpen,
    handleDelete,
    handleCloseDeleteDialog,
    deletingItem,
    isSubmitting,
    formError,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    setEditingItem,
    editingItem,
    createItem,
    updateItem,
  } = useSettingsState<Approval>({
    entityName: 'approvals',
    searchFields: ['name', 'description'] as any,
  });

  const renderDeadline = useCallback((type: string, value?: string | null) => {
    if (!value) return '-';
    if (type === 'hours') return `${value} h`;
    if (type === 'date') return value;
    return value;
  }, []);

  const nameRequiredError = ta('general.errors.nameRequired', 'Name is required');
  const emptyValueLabel = ta('grid.values.none', 'None');

  const triggerTypeLabelMap = useMemo(
    () => ({
      ON_CREATE: ta('options.triggerType.onCreate', 'On Create'),
      MANUAL: ta('options.triggerType.manual', 'Manual'),
      CONDITIONAL: ta('options.triggerType.conditional', 'Conditional'),
    }),
    [ta]
  );

  const getTriggerTypeLabel = useCallback(
    (type?: string | null) => {
      const normalized = String(type || '').toUpperCase();
      return triggerTypeLabelMap[normalized as keyof typeof triggerTypeLabelMap] ?? (type ? type : emptyValueLabel);
    },
    [triggerTypeLabelMap, emptyValueLabel]
  );

  const getApprovalTypeLabel = useCallback(
    (type?: string | null) => {
      const normalized = String(type || '').toUpperCase();
      return normalized === 'PARALLEL'
        ? ta('grid.values.parallel', 'Parallel')
        : ta('grid.values.sequential', 'Sequential');
    },
    [ta]
  );

  const deleteDialogTitle = ta('dialog.delete.title', 'Delete Approval');
  const deleteDescriptionTemplate = ta(
    'dialog.delete.description',
    'Are you sure you want to delete the approval "{name}"? This action cannot be undone.'
  );
  const deleteEntityName = ta('dialog.delete.entityName', 'approval');
  const previewTypeLabel = ta('preview.typeLabel', 'Type');
  const previewTriggerLabel = ta('preview.triggerLabel', 'Trigger');
  const previewConditionsLabel = ta('preview.conditionsLabel', 'Conditions');
  const deleteDescription = deletingItem ? formatTemplate(deleteDescriptionTemplate, { name: deletingItem.name ?? '' }) : undefined;
  const deleteSectionDescription = editingItem
    ? formatTemplate(deleteDescriptionTemplate, { name: editingItem.name ?? '' })
    : ta('dialog.delete.description', 'Are you sure you want to delete this approval? This action cannot be undone.');

  const [isApproversDialogOpen, setIsApproversDialogOpen] = useState(false);
  const [approversApproval, setApproversApproval] = useState<Approval | null>(null);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [summaryApproval, setSummaryApproval] = useState<Approval | null>(null);
  const [isActionsDialogOpen, setIsActionsDialogOpen] = useState(false);
  const [actionsApproval, setActionsApproval] = useState<Approval | null>(null);
  const { value: approvalApprovers } = useSelector((s: RootState) => s.approvalApprovers) as { value: ApprovalApprover[] };
  const { value: statuses } = useSelector((s: RootState) => (s as any).statuses || { value: [] }) as { value: Status[] };
  const { value: customFields } = useSelector((s: RootState) => (s as any).customFields || { value: [] }) as { value: CustomField[] };
  const { value: priorities } = useSelector((s: RootState) => (s as any).priorities || { value: [] }) as { value: Array<{ id: number; name?: string; category_id?: number | null }> };
  const { value: categories } = useSelector((s: RootState) => (s as any).categories || { value: [] }) as { value: Array<{ id: number; name?: string; approval_id?: number | null }> };
  const { value: slas } = useSelector((s: RootState) => (s as any).slas || { value: [] }) as { value: Array<{ id: number; name?: string }> };
  const { value: users } = useSelector((s: RootState) => (s as any).users || { value: [] }) as { value: any[] };
  const { value: roles } = useSelector((s: RootState) => (s as any).roles || { value: [] }) as { value: any[] };
  const tasks = useSelector((s: any) => (s?.tasks?.value) || []) as any[];
  const { value: approvalsStateValue } = useSelector((s: RootState) => (s as any).approvals || { value: [] }) as { value: Approval[] };

  const approverCountByApproval = useMemo(() => {
    const map = new Map<number, number>();
    for (const a of (approvalApprovers || [])) {
      const aid = Number((a as any)?.approval_id ?? (a as any)?.approvalId);
      if (!Number.isFinite(aid)) continue;
      map.set(aid, (map.get(aid) || 0) + 1);
    }
    return map;
  }, [approvalApprovers]);

  const conditionFieldOptions = useMemo(
    () => buildConditionFieldOptions(
      statuses || [],
      customFields || [],
      ta,
      { priorities, categories, slas }
    ),
    [statuses, customFields, priorities, categories, slas, ta]
  );

  const openManageApprovers = useCallback((approval: Approval) => {
    setApproversApproval(approval);
    setIsApproversDialogOpen(true);
  }, []);

  const openManageActions = useCallback((approval: Approval) => {
    setActionsApproval(approval);
    setIsActionsDialogOpen(true);
  }, []);

  const openSummary = useCallback((approval: Approval) => {
    setSummaryApproval(approval);
    setIsSummaryDialogOpen(true);
  }, []);

  const requirementLabel = useCallback((a?: Approval | null) => {
    if (!a) return '';
    if (a.require_all) return ta('grid.requirement.all', 'All approvers');
    if (a.minimum_approvals) return formatTemplate(ta('grid.requirement.minimum', 'Minimum {count}'), { count: a.minimum_approvals });
    return ta('grid.requirement.minimumFallback', 'Minimum N/A');
  }, [ta]);

  const summaryApprovers = useMemo(() => {
    const aid = Number(summaryApproval?.id);
    if (!summaryApproval || !Number.isFinite(aid)) return [];
    return (approvalApprovers || []).filter((a: any) => Number(a?.approval_id ?? a?.approvalId) === aid);
  }, [summaryApproval, approvalApprovers]);

  const formattedConditions = useMemo(() => {
    if (!summaryApproval || summaryApproval.trigger_type !== 'CONDITIONAL') return [];
    const ops = CONDITION_OPERATOR_LABELS(ta);
    return (summaryApproval.trigger_conditions || []).map((c, idx) => {
      const label = c.label || c.field || `${ta('summary.condition', 'Condition')} ${idx + 1}`;
      const opLabel = ops[c.operator as keyof typeof ops] || c.operator;
      let valueText = '';
      if (c.value_label) valueText = String(c.value_label);
      else if (Array.isArray(c.value)) valueText = c.value.join(', ');
      else if (c.value !== undefined && c.value !== null) valueText = String(c.value);
      return `${label} ${opLabel}${valueText ? ` ${valueText}` : ''}`;
    });
  }, [summaryApproval, ta]);

  const requiredCount = useMemo(() => summaryApprovers.filter((a: any) => !!(a as any).required).length, [summaryApprovers]);

  const approverName = useCallback((a: any) => {
    if (!a) return '';
    const id = Number(a.approver_id);
    if (a.approver_type === 'user') {
      return users.find(u => u.id === id)?.name || `User #${id}`;
    }
    return roles.find(r => r.id === id)?.name || `Role #${id}`;
  }, [users, roles]);

  const usageCount = useMemo(() => {
    const aid = Number(summaryApproval?.id);
    if (!Number.isFinite(aid) || !Array.isArray(tasks)) return 0;
    return tasks.filter((t: any) => Number((t as any).approval_id) === aid).length;
  }, [summaryApproval, tasks]);

  const orderedItems = useMemo(() => {
    return [...filteredItems].sort((a: any, b: any) => {
      const ao = Number(a?.order_index ?? 0);
      const bo = Number(b?.order_index ?? 0);
      if (ao !== bo) return ao - bo;
      return Number(a?.id ?? 0) - Number(b?.id ?? 0);
    });
  }, [filteredItems]);

  const colDefs = useMemo<ColDef[]>(() => {
    const columnLabels = {
      approval: ta('grid.columns.approval', 'Approval'),
      requirement: ta('grid.columns.requirement', 'Requirement'),
      approvalType: ta('grid.columns.approvalType', 'Approval Type'),
      trigger: ta('grid.columns.trigger', 'Trigger'),
      requireComment: ta('grid.columns.requireComment', 'Require Comment'),
      blockEditing: ta('grid.columns.blockEditing', 'Block Editing'),
      deadline: ta('grid.columns.deadline', 'Deadline'),
      actions: ta('grid.columns.actions', 'Actions'),
    };
    const requirementAllLabel = ta('grid.requirement.all', 'All approvers');
    const requirementMinimumTemplate = ta('grid.requirement.minimum', 'Minimum {count}');
    const requirementMinimumFallback = ta('grid.requirement.minimumFallback', 'Minimum N/A');
    const sequentialLabel = ta('grid.values.sequential', 'Sequential');
    const parallelLabel = ta('grid.values.parallel', 'Parallel');
    const yesLabel = ta('grid.values.yes', 'Yes');
    const noLabel = ta('grid.values.no', 'No');
    const manageApproversLabel = ta('actions.manageApprovers', 'Approvers');
    const manageApproversWithCount = ta('actions.manageApproversWithCount', 'Approvers ({count})');
    const manageActionsLabel = ta('actions.manageActions', 'Actions');

    return [
      {
        field: 'drag',
        headerName: '',
        width: 52,
        suppressMovable: true,
        rowDrag: true,
        cellRenderer: () => (
          <div className="flex items-center justify-center text-muted-foreground">
            <FontAwesomeIcon icon={faGripVertical} className="w-3.5 h-3.5" />
          </div>
        ),
      },
      {
        field: 'name',
        headerName: columnLabels.approval,
        flex: 1.2,
        minWidth: 220,
        cellRenderer: NameCell,
      },
      {
        field: 'summary',
        headerName: '',
        width: 70,
        suppressMovable: true,
        cellRenderer: (p: ICellRendererParams) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => openSummary(p?.data as Approval)}
            title={ta('actions.summary', 'Summary')}
            aria-label={ta('actions.summary', 'Summary')}
          >
            <FontAwesomeIcon icon={faInfoCircle} className="w-4 h-4 text-muted-foreground" />
          </Button>
        ),
      },
      {
        field: 'require_all',
        headerName: columnLabels.requirement,
        flex: 1,
        minWidth: 150,
        cellRenderer: (p: ICellRendererParams) => {
          const requireAll = !!p?.data?.require_all;
          const min = p?.data?.minimum_approvals as number | null | undefined;
          return requireAll
            ? requirementAllLabel
            : (min ? formatTemplate(requirementMinimumTemplate, { count: min }) : requirementMinimumFallback);
        },
      },
      {
        field: 'approval_type',
        headerName: columnLabels.approvalType,
        width: 130,
        cellRenderer: (p: ICellRendererParams) => {
          const type = String(p?.data?.approval_type || '').toUpperCase();
          return type === 'PARALLEL' ? parallelLabel : sequentialLabel;
        },
      },
      {
        field: 'trigger_type',
        headerName: columnLabels.trigger,
        width: 140,
        cellRenderer: (p: ICellRendererParams) => getTriggerTypeLabel(p?.data?.trigger_type),
      },
      {
        field: 'require_rejection_comment',
        headerName: columnLabels.requireComment,
        width: 130,
        cellRenderer: (p: ICellRendererParams) => (p?.data?.require_rejection_comment ? yesLabel : noLabel),
      },
      {
        field: 'block_editing_during_approval',
        headerName: columnLabels.blockEditing,
        width: 120,
        cellRenderer: (p: ICellRendererParams) => (p?.data?.block_editing_during_approval ? yesLabel : noLabel),
      },
      {
        field: 'deadline_type',
        headerName: columnLabels.deadline,
        flex: 1,
        minWidth: 140,
        cellRenderer: (p: ICellRendererParams) => renderDeadline(p?.data?.deadline_type, p?.data?.deadline_value),
      },
      {
        field: 'actions',
        headerName: columnLabels.actions,
        width: 280,
        cellRenderer: createActionsCellRenderer({
          customActions: [
            {
              icon: faUsers,
              label: (row: any) => {
                const count = approverCountByApproval.get(Number(row?.id)) || 0;
                return count > 0 ? formatTemplate(manageApproversWithCount, { count }) : manageApproversLabel;
              },
              variant: 'outline',
              onClick: (row: any) => openManageApprovers(row as Approval),
              className: 'p-1 h-7 relative flex items-center justify-center gap-1 min-w-[120px]'
            },
            {
              icon: faBolt,
              label: manageActionsLabel,
              variant: 'outline',
              onClick: (row: any) => openManageActions(row as Approval),
              className: 'p-1 h-7 relative flex items-center justify-center gap-1 min-w-[90px]'
            }
          ],
        }),
        sortable: false,
        filter: false,
        resizable: false,
        pinned: 'right',
      },
    ];
  }, [handleEdit, renderDeadline, approverCountByApproval, openManageApprovers, openManageActions, ta, getTriggerTypeLabel]);

  // Form state
  const [createFormData, setCreateFormData] = useState<ApprovalFormState>(() => createEmptyFormState());

  const [editFormData, setEditFormData] = useState<ApprovalFormState>(() => createEmptyFormState());

  // Populate edit form when editingItem changes
  useEffect(() => {
    const item = editingItem as Approval | null;
    if (!item) return;
    setEditFormData({
      name: item.name || '',
      description: item.description || '',
      approval_type: (item.approval_type as any) || 'SEQUENTIAL',
      require_all: !!item.require_all,
      minimum_approvals: item.minimum_approvals ?? '',
      trigger_type: (item.trigger_type as any) || 'ON_CREATE',
      trigger_conditions: Array.isArray(item.trigger_conditions) ? item.trigger_conditions : [],
      require_rejection_comment: !!item.require_rejection_comment,
      block_editing_during_approval: !!item.block_editing_during_approval,
      deadline_type: (item.deadline_type as any) || 'hours',
      deadline_value: item.deadline_value || '',
      order_index: item.order_index ?? 0,
      is_active: !!item.is_active,
    });
  }, [editingItem]);

  const handleQuickEdit = useCallback((item: Approval) => {
    if (!item) return;
    setEditFormData({
      name: item.name || '',
      description: item.description || '',
      approval_type: (item.approval_type as any) || 'SEQUENTIAL',
      require_all: !!item.require_all,
      minimum_approvals: item.minimum_approvals ?? '',
      trigger_type: (item.trigger_type as any) || 'ON_CREATE',
      trigger_conditions: Array.isArray(item.trigger_conditions) ? item.trigger_conditions : [],
      require_rejection_comment: !!item.require_rejection_comment,
      block_editing_during_approval: !!item.block_editing_during_approval,
      deadline_type: (item.deadline_type as any) || 'hours',
      deadline_value: item.deadline_value || '',
      order_index: item.order_index ?? 0,
      is_active: !!item.is_active,
    });
    setEditingItem(item);
    setIsEditDialogOpen(true);
  }, [setEditingItem, setIsEditDialogOpen]);

  const openDeleteFromEdit = useCallback(() => {
    if (!editingItem) return;
    setIsEditDialogOpen(false);
    handleDelete(editingItem);
  }, [editingItem, handleDelete, setIsEditDialogOpen]);

  const handleRowDragEnd = useCallback(async (event: any) => {
    const api = event?.api;
    if (!api) return;
    const updates: Array<{ id: number; order_index: number }> = [];
    api.forEachNode((node: any, index: number) => {
      const id = Number(node?.data?.id);
      if (!Number.isFinite(id)) return;
      const current = Number(node?.data?.order_index ?? 0);
      if (current !== index) {
        updates.push({ id, order_index: index });
      }
    });
    if (!updates.length) return;
    // Apply sequentially to preserve order updates
    for (const u of updates) {
      await updateItem(u.id, { order_index: u.order_index } as any);
    }
  }, [updateItem]);

  const getRowId = useCallback((params: any) => String(params?.data?.id ?? params?.id ?? ''), []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.name.trim()) throw new Error(nameRequiredError);
    const maxOrder = Math.max(0, ...(approvalsStateValue || []).map((a: any) => Number(a?.order_index ?? 0)));
    const normalizedConditions = createFormData.trigger_type === 'CONDITIONAL'
      ? sanitizeConditionsForSubmit(createFormData.trigger_conditions)
      : [];
    if (createFormData.trigger_type === 'CONDITIONAL' && normalizedConditions.length === 0) {
      throw new Error(ta('conditions.errors.required', 'Add at least one condition to use the conditional trigger.'));
    }
    const payload: any = {
      name: createFormData.name.trim(),
      description: createFormData.description?.trim() || null,
      approval_type: createFormData.approval_type,
      require_all: !!createFormData.require_all,
      minimum_approvals: createFormData.require_all ? null : (createFormData.minimum_approvals === '' ? null : Number(createFormData.minimum_approvals)),
      trigger_type: createFormData.trigger_type,
      trigger_conditions: createFormData.trigger_type === 'CONDITIONAL' ? normalizedConditions : null,
      require_rejection_comment: !!createFormData.require_rejection_comment,
      block_editing_during_approval: !!createFormData.block_editing_during_approval,
      deadline_type: createFormData.deadline_type,
      deadline_value: createFormData.deadline_value || null,
      order_index: maxOrder + 1,
      is_active: !!createFormData.is_active,
      deleted_at: null,
    };
    await createItem(payload);
    setCreateFormData(createEmptyFormState());
  };

  const handleEditSubmit = async (e: React.FormEvent, editingItem?: Approval | null) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editFormData.name.trim()) throw new Error(nameRequiredError);
    const normalizedConditions = editFormData.trigger_type === 'CONDITIONAL'
      ? sanitizeConditionsForSubmit(editFormData.trigger_conditions)
      : [];
    if (editFormData.trigger_type === 'CONDITIONAL' && normalizedConditions.length === 0) {
      throw new Error(ta('conditions.errors.required', 'Add at least one condition to use the conditional trigger.'));
    }
    const updates: any = {
      name: editFormData.name.trim(),
      description: editFormData.description?.trim() || null,
      approval_type: editFormData.approval_type,
      require_all: !!editFormData.require_all,
      minimum_approvals: editFormData.require_all ? null : (editFormData.minimum_approvals === '' ? null : Number(editFormData.minimum_approvals)),
      trigger_type: editFormData.trigger_type,
      trigger_conditions: editFormData.trigger_type === 'CONDITIONAL' ? normalizedConditions : null,
      require_rejection_comment: !!editFormData.require_rejection_comment,
      block_editing_during_approval: !!editFormData.block_editing_during_approval,
      deadline_type: editFormData.deadline_type,
      deadline_value: editFormData.deadline_value || null,
      order_index: editFormData.order_index ?? (editingItem as any).order_index ?? 0,
      is_active: !!editFormData.is_active,
    };
    await updateItem((editingItem as any).id, updates);
  };

  // Initial load: hydrate from IndexedDB then refresh from API
  useEffect(() => {
    dispatch(genericActions.approvals.getFromIndexedDB());
    dispatch(genericActions.approvals.fetchFromAPI());
    // Load approvers for counts and manager
    dispatch(genericActions.approvalApprovers.getFromIndexedDB());
    dispatch(genericActions.approvalApprovers.fetchFromAPI());
    // Load users and roles for approver selection UI
    dispatch(genericActions.users.getFromIndexedDB());
    dispatch(genericActions.users.fetchFromAPI());
    dispatch(genericActions.roles.getFromIndexedDB());
    dispatch(genericActions.roles.fetchFromAPI());
    dispatch(genericActions.statuses.getFromIndexedDB());
    dispatch(genericActions.statuses.fetchFromAPI());
    dispatch(genericActions.customFields.getFromIndexedDB());
    dispatch(genericActions.customFields.fetchFromAPI());
    dispatch(genericActions.priorities.getFromIndexedDB());
    dispatch(genericActions.priorities.fetchFromAPI());
    dispatch(genericActions.categories.getFromIndexedDB());
    dispatch(genericActions.categories.fetchFromAPI());
    dispatch(genericActions.slas.getFromIndexedDB());
    dispatch(genericActions.slas.fetchFromAPI());
    dispatch(genericActions.templates.getFromIndexedDB());
    dispatch(genericActions.templates.fetchFromAPI());
  }, [dispatch]);

  return (
    <div className="p-4 pt-0 h-full">
      <SettingsLayout
        title={ta('title', 'Approvals')}
        description={ta('description', 'Configure task approvals')}
        icon={faSquareCheck}
        iconColor="#10b981"
        loading={{ isLoading: loading, message: ta('loading', 'Loading approvals...') }}
        error={error ? { message: error, onRetry: () => window.location.reload() } : undefined}
        headerActions={
          <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
            <FontAwesomeIcon icon={faPlus} className="mr-2" />
            {ta('headerActions.add', 'Add Approval')}
          </Button>
        }
      >
        <div className="flex h-full flex-col min-h-0">
          <UrlTabs
            className="flex-1 min-h-0"
            tabs={[
            {
              value: "approvals",
              label: (
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faSquareCheck} className="w-4 h-4" />
                  <span>{ta('tabs.approvals', 'Approvals')}</span>
                </div>
              ),
              content: (
                <div className="flex h-full flex-col">
                  <div className="flex-1 min-h-0">
                    <SettingsGrid
                    rowData={orderedItems}
                      columnDefs={colDefs}
                      noRowsMessage={ta('grid.noRows', 'No approvals found')}
                      rowSelection="single"
                      onRowDoubleClicked={(row: any) => handleQuickEdit(row?.data ?? row)}
                    onRowDragEnd={handleRowDragEnd}
                    getRowId={getRowId}
                    gridOptions={{
                      rowDragManaged: true,
                      suppressMoveWhenRowDragging: true,
                      animateRows: true,
                      rowDragMultiRow: false,
                    }}
                    />
                  </div>
                </div>
              ),
            },
              {
                value: "help",
                label: (
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faCircleQuestion} className="w-4 h-4" />
                    <span>{ta('tabs.help', 'Help & Documentation')}</span>
                  </div>
                ),
                content: (
                  <div className="h-full min-h-0 overflow-y-auto p-6 space-y-6 pb-12">
                  {/* Header */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <FontAwesomeIcon icon={faBook} className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h1 className="text-3xl font-bold text-foreground">Approvals Documentation</h1>
                        <p className="text-muted-foreground mt-1">Complete guide to configuring and using task approvals</p>
                      </div>
                    </div>
                  </div>

                  {/* Overview Section */}
                  <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                        <FontAwesomeIcon icon={faInfoCircle} className="w-5 h-5" />
                        What are Approvals?
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <p className="text-foreground">
                        Approvals allow you to require specific users or roles to review and approve tasks before they can proceed. 
                        This ensures proper oversight and control over critical operations.
                      </p>
                      <div className="grid md:grid-cols-2 gap-3 mt-4">
                        <div className="p-3 bg-white dark:bg-gray-900 rounded-md border border-blue-200 dark:border-blue-800">
                          <div className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Use Cases</div>
                          <ul className="text-muted-foreground space-y-1 text-xs list-disc list-inside">
                            <li>Expense approvals</li>
                            <li>Work order authorization</li>
                            <li>Policy compliance checks</li>
                            <li>Quality control reviews</li>
                            <li>Budget approvals</li>
                          </ul>
                        </div>
                        <div className="p-3 bg-white dark:bg-gray-900 rounded-md border border-blue-200 dark:border-blue-800">
                          <div className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Benefits</div>
                          <ul className="text-muted-foreground space-y-1 text-xs list-disc list-inside">
                            <li>Enforce business rules</li>
                            <li>Maintain audit trails</li>
                            <li>Prevent unauthorized actions</li>
                            <li>Ensure compliance</li>
                            <li>Improve accountability</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Start */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                        <FontAwesomeIcon icon={faCheckCircle} className="w-5 h-5" />
                        Quick Start Guide
                      </CardTitle>
                      <CardDescription>Follow these steps to set up your first approval</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex gap-4">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center font-bold text-emerald-700 dark:text-emerald-300">
                            1
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-foreground mb-1">Create Approval Configuration</div>
                            <p className="text-sm text-muted-foreground">
                              Click <Badge variant="outline" className="mx-1">Add Approval</Badge> and fill in the General tab with a name and description. 
                              Then configure the Rules tab with your approval type, trigger, and requirements.
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-4">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center font-bold text-emerald-700 dark:text-emerald-300">
                            2
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-foreground mb-1">Assign Approvers</div>
                            <p className="text-sm text-muted-foreground">
                              Click the <Badge variant="outline" className="mx-1">Approvers</Badge> button in the Actions column. 
                              Add users or roles who can approve tasks. You can mark approvers as required or optional.
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-4">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center font-bold text-emerald-700 dark:text-emerald-300">
                            3
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-foreground mb-1">Assign to Category or Template</div>
                            <p className="text-sm text-muted-foreground">
                              Go to <Badge variant="outline" className="mx-1">Settings → Categories</Badge> or 
                              <Badge variant="outline" className="mx-1">Settings → Templates</Badge> and assign your approval 
                              to the appropriate category or template. Tasks created with that category/template will require approval.
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-4">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center font-bold text-emerald-700 dark:text-emerald-300">
                            4
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-foreground mb-1">Create Tasks</div>
                            <p className="text-sm text-muted-foreground">
                              When you create a task with the assigned category or template, the approval workflow will automatically 
                              start (if trigger is set to "ON_CREATE") or can be triggered manually.
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Approval Types */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">Approval Types</CardTitle>
                      <CardDescription>Choose how approvers review tasks</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 border-2 border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-blue-600">S</Badge>
                            <span className="font-semibold text-foreground">Sequential</span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            Approvers review tasks one after another in order. Each approver must complete their review 
                            before the next one can begin.
                          </p>
                          <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Best for:</div>
                          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                            <li>Hierarchical approval chains</li>
                            <li>Department → Manager → Director</li>
                            <li>When order matters</li>
                          </ul>
                        </div>

                        <div className="p-4 border-2 border-emerald-200 dark:border-emerald-800 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-emerald-600">P</Badge>
                            <span className="font-semibold text-foreground">Parallel</span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            All approvers can review simultaneously. The approval completes when the required number 
                            of approvals is reached.
                          </p>
                          <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1">Best for:</div>
                          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                            <li>Team-based approvals</li>
                            <li>Multiple stakeholders</li>
                            <li>Faster turnaround needed</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Trigger Types */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">Trigger Types</CardTitle>
                      <CardDescription>When should the approval workflow start?</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="p-4 border rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2 mb-2">
                            <FontAwesomeIcon icon={faCheckCircle} className="w-4 h-4 text-green-600" />
                            <span className="font-semibold text-foreground">ON_CREATE</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Approval workflow starts automatically when a task is created with the assigned category or template. 
                            This is the most common trigger type.
                          </p>
                        </div>

                        <div className="p-4 border rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2 mb-2">
                            <FontAwesomeIcon icon={faClock} className="w-4 h-4 text-blue-600" />
                            <span className="font-semibold text-foreground">MANUAL</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Approval must be started manually by a user with appropriate permissions. Useful when you want 
                            to control exactly when approvals begin.
                          </p>
                        </div>

                        <div className="p-4 border rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2 mb-2">
                            <FontAwesomeIcon icon={faExclamationTriangle} className="w-4 h-4 text-amber-600" />
                            <span className="font-semibold text-foreground">CONDITIONAL</span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Approval starts when specific conditions are met. You can configure conditions based on task fields 
                            or custom fields.
                          </p>
                          <div className="text-xs text-muted-foreground bg-background p-2 rounded border">
                            <strong>Example:</strong> Start approval when task status equals "Pending Review" or when a custom 
                            field "Amount" is greater than $1000.
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Approval Statuses */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">Approval Statuses</CardTitle>
                      <CardDescription>Understanding task approval states</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="p-3 border rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">pending</Badge>
                            <span className="font-medium text-foreground">Pending</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Waiting for approver(s) to review</p>
                        </div>

                        <div className="p-3 border rounded-lg bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">approved</Badge>
                            <span className="font-medium text-foreground">Approved</span>
                          </div>
                          <p className="text-xs text-muted-foreground">All required approvers have approved</p>
                        </div>

                        <div className="p-3 border rounded-lg bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">rejected</Badge>
                            <span className="font-medium text-foreground">Rejected</span>
                          </div>
                          <p className="text-xs text-muted-foreground">One or more approvers rejected the task</p>
                        </div>

                        <div className="p-3 border rounded-lg bg-gray-50/50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">cancelled</Badge>
                            <span className="font-medium text-foreground">Cancelled</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Approval workflow was cancelled</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Configuration Options */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">Configuration Options</CardTitle>
                      <CardDescription>Fine-tune your approval workflow</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="p-3 border rounded-lg">
                          <div className="font-semibold text-foreground mb-1 flex items-center gap-2">
                            <FontAwesomeIcon icon={faUsers} className="w-4 h-4 text-blue-600" />
                            Require All Approvers
                          </div>
                          <p className="text-sm text-muted-foreground">
                            When enabled, all assigned approvers must approve. When disabled, you can set a minimum number 
                            of approvals required (useful for parallel approvals).
                          </p>
                        </div>

                        <div className="p-3 border rounded-lg">
                          <div className="font-semibold text-foreground mb-1 flex items-center gap-2">
                            <FontAwesomeIcon icon={faExclamationTriangle} className="w-4 h-4 text-red-600" />
                            Require Rejection Comment
                          </div>
                          <p className="text-sm text-muted-foreground">
                            When enabled, approvers must provide a comment explaining why they rejected the task. 
                            This helps maintain clear communication and audit trails.
                          </p>
                        </div>

                        <div className="p-3 border rounded-lg">
                          <div className="font-semibold text-foreground mb-1 flex items-center gap-2">
                            <FontAwesomeIcon icon={faLock} className="w-4 h-4 text-amber-600" />
                            Block Editing During Approval
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Prevents task modifications while approval is pending. This ensures approvers review the exact 
                            task state and prevents mid-review changes.
                          </p>
                        </div>

                        <div className="p-3 border rounded-lg">
                          <div className="font-semibold text-foreground mb-1 flex items-center gap-2">
                            <FontAwesomeIcon icon={faClock} className="w-4 h-4 text-purple-600" />
                            Deadline
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Set a deadline for approval completion. Can be specified in hours (e.g., 24 hours) or as a specific 
                            date. Helps ensure timely reviews.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Assigning Approvals */}
                  <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-purple-900 dark:text-purple-100">
                        <FontAwesomeIcon icon={faSquareCheck} className="w-5 h-5" />
                        Assigning Approvals to Tasks
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-purple-200 dark:border-purple-800">
                          <div className="font-semibold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
                            <Badge className="bg-purple-600">Option 1</Badge>
                            Category-Based Approval
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Assign an approval to a category. All tasks created with that category will require approval.
                          </p>
                          <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                            <strong>Steps:</strong> Settings → Categories → Edit Category → Select Approval → Save
                          </div>
                        </div>

                        <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-purple-200 dark:border-purple-800">
                          <div className="font-semibold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
                            <Badge className="bg-purple-600">Option 2</Badge>
                            Template-Based Approval
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Assign an approval to a template. Tasks created from that template will require approval.
                          </p>
                          <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                            <strong>Steps:</strong> Settings → Templates → Edit Template → Rules Tab → Select Approval → Save
                          </div>
                        </div>

                        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <div className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-1">💡 Tip</div>
                          <p className="text-xs text-muted-foreground">
                            If both category and template have approvals assigned, the template's approval typically takes precedence.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Example Workflow */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">Example: AC Repair Approval</CardTitle>
                      <CardDescription>Complete walkthrough for setting up an approval workflow</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3 text-sm">
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                            1
                          </div>
                          <div>
                            <strong className="text-foreground">Create Approval:</strong> Name it "Manager Approval for AC Repairs", 
                            set type to Sequential, trigger to ON_CREATE, and enable "Require all approvers".
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                            2
                          </div>
                          <div>
                            <strong className="text-foreground">Assign Approvers:</strong> Click "Approvers" button, add the Manager role 
                            (or specific manager users), mark as required.
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                            3
                          </div>
                          <div>
                            <strong className="text-foreground">Assign to Category:</strong> Go to Categories, edit "Maintenance" category, 
                            select the approval from the dropdown, save.
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                            4
                          </div>
                          <div>
                            <strong className="text-foreground">Create Task:</strong> Create "Repair AC" task with "Maintenance" category. 
                            Approval workflow starts automatically, task status becomes "pending".
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-300">
                            5
                          </div>
                          <div>
                            <strong className="text-foreground">Manager Reviews:</strong> Manager receives notification, reviews task, 
                            approves or rejects. Task status updates to "approved" or "rejected" accordingly.
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Best Practices */}
                  <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-100">
                        <FontAwesomeIcon icon={faCheckCircle} className="w-5 h-5" />
                        Best Practices
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm">
                        <li className="flex gap-2">
                          <span className="text-green-600 dark:text-green-400">✓</span>
                          <span className="text-muted-foreground">
                            <strong className="text-foreground">Use clear names:</strong> Name approvals descriptively so users understand their purpose.
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-green-600 dark:text-green-400">✓</span>
                          <span className="text-muted-foreground">
                            <strong className="text-foreground">Set deadlines:</strong> Always set reasonable deadlines to ensure timely approvals.
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-green-600 dark:text-green-400">✓</span>
                          <span className="text-muted-foreground">
                            <strong className="text-foreground">Require comments:</strong> Enable rejection comments to maintain clear communication.
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-green-600 dark:text-green-400">✓</span>
                          <span className="text-muted-foreground">
                            <strong className="text-foreground">Use roles when possible:</strong> Assign approvals to roles rather than individual users 
                            for easier maintenance.
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-green-600 dark:text-green-400">✓</span>
                          <span className="text-muted-foreground">
                            <strong className="text-foreground">Test workflows:</strong> Create test tasks to verify approval workflows work as expected.
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-green-600 dark:text-green-400">✓</span>
                          <span className="text-muted-foreground">
                            <strong className="text-foreground">Document conditions:</strong> If using conditional triggers, document the conditions 
                            clearly for future reference.
                          </span>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Troubleshooting */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">Troubleshooting</CardTitle>
                      <CardDescription>Common issues and solutions</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="p-3 border rounded-lg bg-muted/30">
                        <div className="font-semibold text-foreground mb-1">Approval not starting automatically</div>
                        <p className="text-sm text-muted-foreground">
                          Check that the trigger type is set to "ON_CREATE" and the approval is assigned to the task's category or template. 
                          Ensure the approval is marked as "Active".
                        </p>
                      </div>

                      <div className="p-3 border rounded-lg bg-muted/30">
                        <div className="font-semibold text-foreground mb-1">Approvers not receiving notifications</div>
                        <p className="text-sm text-muted-foreground">
                          Verify that approvers are correctly assigned to the approval. Check user notification settings and ensure 
                          the approval workflow has started.
                        </p>
                      </div>

                      <div className="p-3 border rounded-lg bg-muted/30">
                        <div className="font-semibold text-foreground mb-1">Task stuck in pending status</div>
                        <p className="text-sm text-muted-foreground">
                          Ensure all required approvers have reviewed the task. Check if any approvers are missing or if the approval 
                          requirements are configured correctly.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                ),
              },
            ]}
            defaultValue="approvals"
          />
        </div>
      </SettingsLayout>

      {/* Create Approval Dialog */}
      <SettingsDialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            setCreateFormData(createEmptyFormState());
          }
        }}
        type="create"
        title={ta('dialog.create.title', 'Add New Approval')}
        description={ta('dialog.create.description', 'Define an approval configuration.')}
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting}
      >
        <div className="rounded-xl bg-gradient-to-r from-sky-50 via-white to-emerald-50 dark:from-sky-900/30 dark:via-slate-900 dark:to-emerald-900/20 border border-sky-100 dark:border-slate-800 px-4 py-3 mb-4 flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/80 dark:bg-slate-800/70 border border-sky-100 dark:border-slate-700 flex items-center justify-center">
            <FontAwesomeIcon icon={faSquareCheck} className="text-sky-600 dark:text-sky-300 w-4 h-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{ta('dialog.create.heroTitle', 'Create an approval')}</p>
            <p className="text-xs text-muted-foreground">
              {ta('dialog.create.heroSubtitle', 'Set the basics, then define rules and approvers. Deadlines are optional—leave blank to skip.')}
            </p>
          </div>
        </div>
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">{ta('dialog.tabs.general', 'General')}</TabsTrigger>
            <TabsTrigger value="rules">{ta('dialog.tabs.rules', 'Rules')}</TabsTrigger>
            <TabsTrigger value="trigger">{ta('dialog.tabs.trigger', 'Trigger')}</TabsTrigger>
            <TabsTrigger value="timeline">{ta('dialog.tabs.timeline', 'Timeline')}</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <div className="grid gap-4 min-h-[320px]">
              <TextField id="name" label={ta('fields.name', 'Name')} value={createFormData.name} onChange={(v) => setCreateFormData(p => ({ ...p, name: v }))} required />
              <TextAreaField id="description" label={ta('fields.description', 'Description')} value={createFormData.description} onChange={(v) => setCreateFormData(p => ({ ...p, description: v }))} />
              <CheckboxField id="is_active" label={ta('fields.active', 'Active')} checked={!!createFormData.is_active} onChange={(c) => setCreateFormData(p => ({ ...p, is_active: c }))} hideFieldLabel />
            </div>
          </TabsContent>
          <TabsContent value="rules">
            <div className="grid gap-4 min-h-[320px]">
              <SelectField id="approval_type" label={ta('fields.approvalType', 'Approval Type')} value={createFormData.approval_type} onChange={(v) => setCreateFormData(p => ({ ...p, approval_type: v as any }))} options={[{ value: 'SEQUENTIAL', label: ta('options.approvalType.sequential', 'Sequential') }, { value: 'PARALLEL', label: ta('options.approvalType.parallel', 'Parallel') }]} />
              <CheckboxField id="require_all" label={ta('fields.requireAll', 'Require all approvers')} checked={!!createFormData.require_all} onChange={(c) => setCreateFormData(p => ({ ...p, require_all: c }))} hideFieldLabel />
              {!createFormData.require_all && (
                <TextField id="minimum_approvals" label={ta('fields.minimumApprovals', 'Minimum approvals')} type="number" value={String(createFormData.minimum_approvals)} onChange={(v) => setCreateFormData(p => ({ ...p, minimum_approvals: v }))} />
              )}
              <CheckboxField id="require_rejection_comment" label={ta('fields.requireRejectionComment', 'Require rejection comment')} checked={!!createFormData.require_rejection_comment} onChange={(c) => setCreateFormData(p => ({ ...p, require_rejection_comment: c }))} hideFieldLabel />
              <CheckboxField id="block_editing_during_approval" label={ta('fields.blockEditing', 'Block editing during approval')} checked={!!createFormData.block_editing_during_approval} onChange={(c) => setCreateFormData(p => ({ ...p, block_editing_during_approval: c }))} hideFieldLabel />
            </div>
          </TabsContent>
          <TabsContent value="trigger">
            <div className="grid gap-4 min-h-[260px]">
              <SelectField id="trigger_type" label={ta('fields.triggerType', 'Trigger Type')} value={createFormData.trigger_type} onChange={(v) => setCreateFormData(p => ({ ...p, trigger_type: v as any }))} options={[
                { value: 'ON_CREATE', label: ta('options.triggerType.onCreate', 'On Create') },
                { value: 'MANUAL', label: ta('options.triggerType.manual', 'Manual') },
                { value: 'CONDITIONAL', label: ta('options.triggerType.conditional', 'Conditional') },
              ]} />
              {createFormData.trigger_type === 'CONDITIONAL' && (
                <ConditionBuilder
                  conditions={createFormData.trigger_conditions}
                  onChange={(next) => setCreateFormData((prev) => ({ ...prev, trigger_conditions: next }))}
                  fieldOptions={conditionFieldOptions}
                  ta={ta}
                />
              )}
            </div>
          </TabsContent>
          <TabsContent value="timeline">
            <div className="grid gap-4 min-h-[260px]">
              <SelectField id="deadline_type" label={ta('fields.deadlineType', 'Deadline Type')} value={createFormData.deadline_type} onChange={(v) => setCreateFormData(p => ({ ...p, deadline_type: v as any }))} options={[
                { value: 'hours', label: ta('options.deadlineType.hours', 'Hours') },
                { value: 'date', label: ta('options.deadlineType.date', 'Date') },
              ]} />
              <TextField
                id="deadline_value"
                label={createFormData.deadline_type === 'hours' ? ta('fields.deadlineHours', 'Deadline (hours)') : ta('fields.deadlineDate', 'Deadline (date)')}
                type={createFormData.deadline_type === 'hours' ? 'number' : 'date'}
                value={createFormData.deadline_value}
                onChange={(v) => setCreateFormData(p => ({ ...p, deadline_value: v }))}
              />
            </div>
          </TabsContent>
        </Tabs>
      </SettingsDialog>

      {/* Edit Approval Dialog */}
      <SettingsDialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditFormData(createEmptyFormState());
          }
        }}
        type="edit"
        title={ta('dialog.edit.title', 'Edit Approval')}
        description={ta('dialog.edit.description', 'Update the approval configuration.')}
        onSubmit={(e) => handleEditSubmit(e, editingItem as any)}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting}
        footerActions={editingItem ? (
          <Button
            type="button"
            variant="destructive"
            onClick={openDeleteFromEdit}
            title={deleteSectionDescription}
          >
            <FontAwesomeIcon icon={faTrash} className="mr-2" />
            {deleteDialogTitle}
          </Button>
        ) : undefined}
      >
        <div className="rounded-xl bg-gradient-to-r from-sky-50 via-white to-emerald-50 dark:from-sky-900/30 dark:via-slate-900 dark:to-emerald-900/20 border border-sky-100 dark:border-slate-800 px-4 py-3 mb-4 flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/80 dark:bg-slate-800/70 border border-sky-100 dark:border-slate-700 flex items-center justify-center">
            <FontAwesomeIcon icon={faSquareCheck} className="text-sky-600 dark:text-sky-300 w-4 h-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{ta('dialog.edit.heroTitle', 'Update approval')}</p>
            <p className="text-xs text-muted-foreground">
              {ta('dialog.edit.heroSubtitle', 'Adjust rules, approvers, or deadlines. Leave deadline empty if not needed.')}
            </p>
          </div>
        </div>
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">{ta('dialog.tabs.general', 'General')}</TabsTrigger>
            <TabsTrigger value="rules">{ta('dialog.tabs.rules', 'Rules')}</TabsTrigger>
            <TabsTrigger value="trigger">{ta('dialog.tabs.trigger', 'Trigger')}</TabsTrigger>
            <TabsTrigger value="timeline">{ta('dialog.tabs.timeline', 'Timeline')}</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <div className="grid gap-4 min-h-[320px]">
              <TextField id="edit-name" label={ta('fields.name', 'Name')} value={editFormData.name} onChange={(v) => setEditFormData(p => ({ ...p, name: v }))} required />
              <TextAreaField id="edit-description" label={ta('fields.description', 'Description')} value={editFormData.description} onChange={(v) => setEditFormData(p => ({ ...p, description: v }))} />
              <CheckboxField id="edit-is_active" label={ta('fields.active', 'Active')} checked={!!editFormData.is_active} onChange={(c) => setEditFormData(p => ({ ...p, is_active: c }))} hideFieldLabel />
            </div>
          </TabsContent>
          <TabsContent value="rules">
            <div className="grid gap-4 min-h-[320px]">
              <SelectField id="edit-approval_type" label={ta('fields.approvalType', 'Approval Type')} value={editFormData.approval_type} onChange={(v) => setEditFormData(p => ({ ...p, approval_type: v as any }))} options={[{ value: 'SEQUENTIAL', label: ta('options.approvalType.sequential', 'Sequential') }, { value: 'PARALLEL', label: ta('options.approvalType.parallel', 'Parallel') }]} />
              <CheckboxField id="edit-require_all" label={ta('fields.requireAll', 'Require all approvers')} checked={!!editFormData.require_all} onChange={(c) => setEditFormData(p => ({ ...p, require_all: c }))} hideFieldLabel />
              {!editFormData.require_all && (
                <TextField id="edit-minimum_approvals" label={ta('fields.minimumApprovals', 'Minimum approvals')} type="number" value={String(editFormData.minimum_approvals)} onChange={(v) => setEditFormData(p => ({ ...p, minimum_approvals: v }))} />
              )}
              <CheckboxField id="edit-require_rejection_comment" label={ta('fields.requireRejectionComment', 'Require rejection comment')} checked={!!editFormData.require_rejection_comment} onChange={(c) => setEditFormData(p => ({ ...p, require_rejection_comment: c }))} hideFieldLabel />
              <CheckboxField id="edit-block_editing_during_approval" label={ta('fields.blockEditing', 'Block editing during approval')} checked={!!editFormData.block_editing_during_approval} onChange={(c) => setEditFormData(p => ({ ...p, block_editing_during_approval: c }))} hideFieldLabel />
            </div>
          </TabsContent>
          <TabsContent value="trigger">
            <div className="grid gap-4 min-h-[260px]">
              <SelectField id="edit-trigger_type" label={ta('fields.triggerType', 'Trigger Type')} value={editFormData.trigger_type} onChange={(v) => setEditFormData(p => ({ ...p, trigger_type: v as any }))} options={[
                { value: 'ON_CREATE', label: ta('options.triggerType.onCreate', 'On Create') },
                { value: 'MANUAL', label: ta('options.triggerType.manual', 'Manual') },
                { value: 'CONDITIONAL', label: ta('options.triggerType.conditional', 'Conditional') },
              ]} />
              {editFormData.trigger_type === 'CONDITIONAL' && (
                <ConditionBuilder
                  conditions={editFormData.trigger_conditions}
                  onChange={(next) => setEditFormData((prev) => ({ ...prev, trigger_conditions: next }))}
                  fieldOptions={conditionFieldOptions}
                  ta={ta}
                />
              )}
            </div>
          </TabsContent>
          <TabsContent value="timeline">
            <div className="grid gap-4 min-h-[260px]">
              <SelectField id="edit-deadline_type" label={ta('fields.deadlineType', 'Deadline Type')} value={editFormData.deadline_type} onChange={(v) => setEditFormData(p => ({ ...p, deadline_type: v as any }))} options={[
                { value: 'hours', label: ta('options.deadlineType.hours', 'Hours') },
                { value: 'date', label: ta('options.deadlineType.date', 'Date') },
              ]} />
              <TextField
                id="edit-deadline_value"
                label={editFormData.deadline_type === 'hours' ? ta('fields.deadlineHours', 'Deadline (hours)') : ta('fields.deadlineDate', 'Deadline (date)')}
                type={editFormData.deadline_type === 'hours' ? 'number' : 'date'}
                value={editFormData.deadline_value}
                onChange={(v) => setEditFormData(p => ({ ...p, deadline_value: v }))}
              />
            </div>
          </TabsContent>
        </Tabs>
      </SettingsDialog>

      {/* Delete Approval Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title={deleteDialogTitle}
        description={deleteDescription}
        onConfirm={() => deletingItem ? deleteItem(deletingItem.id) : undefined}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={!deletingItem}
        entityName={deleteEntityName}
        entityData={deletingItem}
        renderEntityPreview={(a: Approval) => (
          <div>
            <div className="font-medium">{a.name}</div>
            {a.description && (
              <div className="text-sm text-muted-foreground">{a.description}</div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              {previewTypeLabel}: {getApprovalTypeLabel(a.approval_type)} • {previewTriggerLabel}: {getTriggerTypeLabel(a.trigger_type)}
            </div>
            {a.trigger_type === 'CONDITIONAL' && Array.isArray(a.trigger_conditions) && a.trigger_conditions.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                {previewConditionsLabel}: {a.trigger_conditions.map((condition) => condition.label || condition.field).join(', ')}
              </div>
            )}
          </div>
        )}
      />

      {/* Manage Approvers Dialog */}
      <ApprovalApproversManager
        open={isApproversDialogOpen}
        onOpenChange={(open) => { if (!open) { setIsApproversDialogOpen(false); setApproversApproval(null); } else { setIsApproversDialogOpen(true); } }}
        approval={approversApproval}
      />

      {/* Manage Actions Dialog */}
      <ApprovalActionsDialog
        open={isActionsDialogOpen}
        onOpenChange={(open) => { if (!open) { setIsActionsDialogOpen(false); setActionsApproval(null); } else { setIsActionsDialogOpen(true); } }}
        approval={actionsApproval}
      />

      {/* Summary Dialog */}
      <Dialog open={isSummaryDialogOpen} onOpenChange={(open) => { setIsSummaryDialogOpen(open); if (!open) setSummaryApproval(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FontAwesomeIcon icon={faInfoCircle} className="text-sky-600 w-4 h-4" />
              {summaryApproval?.name || ta('summary.title', 'Approval Summary')}
            </DialogTitle>
            <DialogDescription>
              {summaryApproval?.description || ta('summary.description', 'Overview and key details')}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">{ta('summary.tabs.overview', 'Overview')}</TabsTrigger>
              <TabsTrigger value="approvers">{ta('summary.tabs.approvers', 'Approvers')}</TabsTrigger>
              <TabsTrigger value="stats">{ta('summary.tabs.stats', 'Stats')}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-3 pt-3">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">{ta('summary.approvalType', 'Approval type')}</div>
                  <div className="font-medium">{summaryApproval?.approval_type === 'PARALLEL' ? ta('grid.values.parallel', 'Parallel') : ta('grid.values.sequential', 'Sequential')}</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">{ta('summary.trigger', 'Trigger')}</div>
                  <div className="font-medium">{getTriggerTypeLabel(summaryApproval?.trigger_type)}</div>
                </div>
                {formattedConditions.length > 0 && (
                  <div className="p-3 border rounded-lg md:col-span-2 space-y-2">
                    <div className="text-xs text-muted-foreground">{ta('summary.conditions', 'Conditions')}</div>
                    <div className="space-y-1">
                      {formattedConditions.map((text, idx) => (
                        <div key={idx} className="text-sm text-foreground">{text}</div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">{ta('summary.requirement', 'Requirement')}</div>
                  <div className="font-medium">{requirementLabel(summaryApproval)}</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">{ta('summary.deadline', 'Deadline')}</div>
                  <div className="font-medium">
                    {summaryApproval?.deadline_value
                      ? renderDeadline(summaryApproval?.deadline_type as any, summaryApproval?.deadline_value as any)
                      : ta('summary.noDeadline', 'None')}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="approvers" className="space-y-3 pt-3">
              {summaryApprovers.length === 0 ? (
                <div className="p-3 border rounded-lg text-sm text-muted-foreground">
                  {ta('summary.noApprovers', 'No approvers assigned yet.')}
                </div>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {summaryApprovers.map((a: any) => (
                    <div key={a.id ?? `${a.approver_type}-${a.approver_id}`} className="p-3 border rounded-lg flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{approverName(a)}</div>
                        <div className="text-xs text-muted-foreground capitalize">{a.approver_type}</div>
                      </div>
                      <Badge variant={a.required ? 'default' : 'outline'}>
                        {a.required ? ta('summary.required', 'Required') : ta('summary.optional', 'Optional')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="stats" className="space-y-3 pt-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div className="p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">{ta('summary.approvers', 'Approvers')}</div>
                  <div className="font-medium">{summaryApprovers.length}</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">{ta('summary.requiredCount', 'Required approvers')}</div>
                  <div className="font-medium">{requiredCount}</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">{ta('summary.usage', 'Times used')}</div>
                  <div className="font-medium">{usageCount}</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">{ta('summary.conditions', 'Conditions')}</div>
                  <div className="font-medium">
                    {summaryApproval?.trigger_type === 'CONDITIONAL'
                      ? ((summaryApproval?.trigger_conditions || []).length || 0)
                      : ta('summary.notApplicable', 'N/A')}
                  </div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">{ta('summary.deadline', 'Deadline')}</div>
                  <div className="font-medium">
                    {summaryApproval?.deadline_value
                      ? renderDeadline(summaryApproval?.deadline_type as any, summaryApproval?.deadline_value as any)
                      : ta('summary.noDeadline', 'None')}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Approvals;


