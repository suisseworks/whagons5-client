import { useMemo, useCallback, useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { faSquareCheck, faUsers, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Approval, ApprovalApprover, ApprovalCondition, CustomField, Status } from "@/store/types";
import { genericActions } from "@/store/genericSlices";
import type { AppDispatch } from "@/store/store";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/animated/Tabs";
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
  is_active: boolean;
};

const CONDITION_OPERATORS_BY_TYPE: Record<ConditionValueType, ConditionOperator[]> = {
  string: ['contains', 'eq', 'ne', 'starts_with', 'ends_with'],
  number: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],
  boolean: ['eq', 'ne'],
  date: ['eq', 'gt', 'lt'],
  option: ['eq', 'ne'],
};

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
  ta: TranslateFn
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

  const customPrefix = ta('conditions.fields.customPrefix', 'Custom field');
  (customFields || []).forEach((field) => {
    fieldOptions.push({
      value: `custom_field:${field.id}`,
      label: `${customPrefix}: ${field.name || `#${field.id}`}`,
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

  const operatorLabels = useMemo(() => ({
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
  }), [ta]);

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
                    label={fieldLabel}
                    value={condition.field}
                    onChange={(val) => handleFieldChange(conditionId, val)}
                    options={selectOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />

                  <SelectField
                    id={`condition-operator-${conditionId}`}
                    label={operatorLabel}
                    value={condition.operator}
                    onChange={(val) => handleOperatorChange(conditionId, val as ConditionOperator)}
                    options={operators.map((operator) => ({
                      value: operator,
                      label: operatorLabels[operator] ?? operator,
                    }))}
                  />

                  {valueType === 'boolean' ? (
                    <CheckboxField
                      id={`condition-value-${conditionId}`}
                      label={valueLabel}
                      checked={Boolean(condition.value ?? true)}
                      onChange={(checked) => handleValueChange(conditionId, checked, fieldOption, valueType)}
                    />
                  ) : valueType === 'option' ? (
                    <SelectField
                      id={`condition-value-${conditionId}`}
                      label={valueLabel}
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
                      label={valueLabel}
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
  const { value: approvalApprovers } = useSelector((s: RootState) => s.approvalApprovers) as { value: ApprovalApprover[] };
  const { value: statuses } = useSelector((s: RootState) => (s as any).statuses || { value: [] }) as { value: Status[] };
  const { value: customFields } = useSelector((s: RootState) => (s as any).customFields || { value: [] }) as { value: CustomField[] };

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
    () => buildConditionFieldOptions(statuses || [], customFields || [], ta),
    [statuses, customFields, ta]
  );

  const openManageApprovers = useCallback((approval: Approval) => {
    setApproversApproval(approval);
    setIsApproversDialogOpen(true);
  }, []);

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

    return [
      {
        field: 'name',
        headerName: columnLabels.approval,
        flex: 1.2,
        minWidth: 220,
        cellRenderer: NameCell,
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
        width: 220,
        cellRenderer: createActionsCellRenderer({
          customActions: [{
            icon: faUsers,
            label: (row: any) => {
              const count = approverCountByApproval.get(Number(row?.id)) || 0;
              return count > 0 ? formatTemplate(manageApproversWithCount, { count }) : manageApproversLabel;
            },
            variant: 'outline',
            onClick: (row: any) => openManageApprovers(row as Approval),
            className: 'p-1 h-7 relative flex items-center justify-center gap-1 min-w-[150px]'
          }],
          onEdit: handleEdit,
        }),
        sortable: false,
        filter: false,
        resizable: false,
        pinned: 'right',
      },
    ];
  }, [handleEdit, renderDeadline, approverCountByApproval, openManageApprovers, ta, getTriggerTypeLabel]);

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

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.name.trim()) throw new Error(nameRequiredError);
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
        <div className="flex h-full flex-col">
          <div className="flex-1 min-h-0">
            <SettingsGrid
              rowData={filteredItems}
              columnDefs={colDefs}
              noRowsMessage={ta('grid.noRows', 'No approvals found')}
              rowSelection="single"
              onRowDoubleClicked={(row: any) => handleQuickEdit(row?.data ?? row)}
            />
          </div>
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
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">{ta('dialog.tabs.general', 'General')}</TabsTrigger>
            <TabsTrigger value="rules">{ta('dialog.tabs.rules', 'Rules')}</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <div className="grid gap-4 min-h-[420px]">
              <TextField id="name" label={ta('fields.name', 'Name')} value={createFormData.name} onChange={(v) => setCreateFormData(p => ({ ...p, name: v }))} required />
              <TextAreaField id="description" label={ta('fields.description', 'Description')} value={createFormData.description} onChange={(v) => setCreateFormData(p => ({ ...p, description: v }))} />
              <CheckboxField id="is_active" label={ta('fields.active', 'Active')} checked={!!createFormData.is_active} onChange={(c) => setCreateFormData(p => ({ ...p, is_active: c }))} />
            </div>
          </TabsContent>
          <TabsContent value="rules">
            <div className="grid gap-4 min-h-[420px]">
              <SelectField id="approval_type" label={ta('fields.approvalType', 'Approval Type')} value={createFormData.approval_type} onChange={(v) => setCreateFormData(p => ({ ...p, approval_type: v as any }))} options={[{ value: 'SEQUENTIAL', label: ta('options.approvalType.sequential', 'Sequential') }, { value: 'PARALLEL', label: ta('options.approvalType.parallel', 'Parallel') }]} />
              <CheckboxField id="require_all" label={ta('fields.requireAll', 'Require all approvers')} checked={!!createFormData.require_all} onChange={(c) => setCreateFormData(p => ({ ...p, require_all: c }))} />
              {!createFormData.require_all && (
                <TextField id="minimum_approvals" label={ta('fields.minimumApprovals', 'Minimum approvals')} type="number" value={String(createFormData.minimum_approvals)} onChange={(v) => setCreateFormData(p => ({ ...p, minimum_approvals: v }))} />
              )}
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
              <CheckboxField id="require_rejection_comment" label={ta('fields.requireRejectionComment', 'Require rejection comment')} checked={!!createFormData.require_rejection_comment} onChange={(c) => setCreateFormData(p => ({ ...p, require_rejection_comment: c }))} />
              <CheckboxField id="block_editing_during_approval" label={ta('fields.blockEditing', 'Block editing during approval')} checked={!!createFormData.block_editing_during_approval} onChange={(c) => setCreateFormData(p => ({ ...p, block_editing_during_approval: c }))} />
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
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">{ta('dialog.tabs.general', 'General')}</TabsTrigger>
            <TabsTrigger value="rules">{ta('dialog.tabs.rules', 'Rules')}</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <div className="grid gap-4 min-h-[420px]">
              <TextField id="edit-name" label={ta('fields.name', 'Name')} value={editFormData.name} onChange={(v) => setEditFormData(p => ({ ...p, name: v }))} required />
              <TextAreaField id="edit-description" label={ta('fields.description', 'Description')} value={editFormData.description} onChange={(v) => setEditFormData(p => ({ ...p, description: v }))} />
              <CheckboxField id="edit-is_active" label={ta('fields.active', 'Active')} checked={!!editFormData.is_active} onChange={(c) => setEditFormData(p => ({ ...p, is_active: c }))} />
            </div>
          </TabsContent>
          <TabsContent value="rules">
            <div className="grid gap-4 min-h-[420px]">
              <SelectField id="edit-approval_type" label={ta('fields.approvalType', 'Approval Type')} value={editFormData.approval_type} onChange={(v) => setEditFormData(p => ({ ...p, approval_type: v as any }))} options={[{ value: 'SEQUENTIAL', label: ta('options.approvalType.sequential', 'Sequential') }, { value: 'PARALLEL', label: ta('options.approvalType.parallel', 'Parallel') }]} />
              <CheckboxField id="edit-require_all" label={ta('fields.requireAll', 'Require all approvers')} checked={!!editFormData.require_all} onChange={(c) => setEditFormData(p => ({ ...p, require_all: c }))} />
              {!editFormData.require_all && (
                <TextField id="edit-minimum_approvals" label={ta('fields.minimumApprovals', 'Minimum approvals')} type="number" value={String(editFormData.minimum_approvals)} onChange={(v) => setEditFormData(p => ({ ...p, minimum_approvals: v }))} />
              )}
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
              <CheckboxField id="edit-require_rejection_comment" label={ta('fields.requireRejectionComment', 'Require rejection comment')} checked={!!editFormData.require_rejection_comment} onChange={(c) => setEditFormData(p => ({ ...p, require_rejection_comment: c }))} />
              <CheckboxField id="edit-block_editing_during_approval" label={ta('fields.blockEditing', 'Block editing during approval')} checked={!!editFormData.block_editing_during_approval} onChange={(c) => setEditFormData(p => ({ ...p, block_editing_during_approval: c }))} />
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
    </div>
  );
}

export default Approvals;


