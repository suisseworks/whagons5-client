import type { ApprovalCondition, CustomField, Status } from "@/store/types";
import type {
  ApprovalFormState,
  ConditionFieldOption,
  ConditionOperator,
  ConditionValueType,
  TranslateFn,
} from "../types";

export const formatTemplate = (template: string, params: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : `{${key}}`
  );

export const CONDITION_OPERATORS_BY_TYPE: Record<ConditionValueType, ConditionOperator[]> = {
  string: ["contains", "eq", "ne", "starts_with", "ends_with"],
  number: ["eq", "ne", "gt", "gte", "lt", "lte"],
  boolean: ["eq", "ne"],
  date: ["eq", "gt", "lt"],
  option: ["eq", "ne"],
};

export const CONDITION_OPERATOR_LABELS = (ta: TranslateFn) => ({
  eq: ta("conditions.operators.eq", "is equal to"),
  ne: ta("conditions.operators.ne", "is not equal to"),
  gt: ta("conditions.operators.gt", "is greater than"),
  gte: ta("conditions.operators.gte", "is greater than or equal to"),
  lt: ta("conditions.operators.lt", "is less than"),
  lte: ta("conditions.operators.lte", "is less than or equal to"),
  contains: ta("conditions.operators.contains", "contains"),
  not_contains: ta("conditions.operators.not_contains", "does not contain"),
  starts_with: ta("conditions.operators.starts_with", "starts with"),
  ends_with: ta("conditions.operators.ends_with", "ends with"),
  is_set: ta("conditions.operators.is_set", "is set"),
  is_not_set: ta("conditions.operators.is_not_set", "is not set"),
});

export const CONDITION_OPERATOR_DISPLAY = (ta: TranslateFn) => ({
  eq: ta("conditions.operatorsShort.eq", "="),
  ne: ta("conditions.operatorsShort.ne", "≠"),
  gt: ta("conditions.operatorsShort.gt", ">"),
  gte: ta("conditions.operatorsShort.gte", "≥"),
  lt: ta("conditions.operatorsShort.lt", "<"),
  lte: ta("conditions.operatorsShort.lte", "≤"),
  contains: ta("conditions.operatorsShort.contains", "contiene"),
  not_contains: ta("conditions.operatorsShort.not_contains", "no contiene"),
  starts_with: ta("conditions.operatorsShort.starts_with", "empieza con"),
  ends_with: ta("conditions.operatorsShort.ends_with", "termina con"),
  is_set: ta("conditions.operatorsShort.is_set", "definido"),
  is_not_set: ta("conditions.operatorsShort.is_not_set", "no definido"),
});

export const DEFAULT_OPERATOR_BY_TYPE: Record<ConditionValueType, ConditionOperator> = {
  string: "contains",
  number: "eq",
  boolean: "eq",
  date: "eq",
  option: "eq",
};

export const createConditionId = () => `cond_${Math.random().toString(36).slice(2, 9)}`;

export const mapCustomFieldTypeToValueType = (fieldType?: string | null): ConditionValueType => {
  const normalized = (fieldType || "").toUpperCase();
  switch (normalized) {
    case "NUMBER":
      return "number";
    case "CHECKBOX":
      return "boolean";
    case "DATE":
    case "TIME":
    case "DATETIME":
      return "date";
    case "LIST":
    case "RADIO":
    case "MULTI_SELECT":
      return "option";
    default:
      return "string";
  }
};

export const normalizeOptionEntries = (options: any): Array<{ value: string | number; label: string }> => {
  if (!options) return [];
  if (Array.isArray(options)) {
    return options.map((opt, index) => {
      if (opt && typeof opt === "object") {
        const val = Object.prototype.hasOwnProperty.call(opt, "value") ? opt.value : (opt.id ?? index);
        const label = opt.label ?? opt.name ?? String(val);
        return { value: val, label: String(label) };
      }
      return { value: opt, label: String(opt) };
    });
  }
  if (typeof options === "string") {
    try {
      return normalizeOptionEntries(JSON.parse(options));
    } catch {
      return [];
    }
  }
  if (typeof options === "object") {
    return Object.entries(options).map(([key, val]) => ({
      value: key,
      label: String(val),
    }));
  }
  return [];
};

export const buildConditionFieldOptions = (
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
      value: "status_id",
      label: ta("conditions.fields.status", "Task status"),
      source: "task_field",
      valueType: "option",
      options: statuses.map((status) => ({
        value: status.id,
        label: status.name || `Status #${status.id}`,
      })),
    });
  }

  if ((extra?.priorities || []).length) {
    fieldOptions.push({
      value: "priority_id",
      label: ta("conditions.fields.priority", "Priority"),
      source: "task_field",
      valueType: "option",
      options: (extra?.priorities || []).map((p) => ({
        value: p.id,
        label: p.name || `Priority #${p.id}`,
      })),
    });
  }

  if ((extra?.categories || []).length) {
    fieldOptions.push({
      value: "category_id",
      label: ta("conditions.fields.category", "Category"),
      source: "task_field",
      valueType: "option",
      options: (extra?.categories || []).map((c) => ({
        value: c.id,
        label: c.name || `Category #${c.id}`,
      })),
    });
  }

  if ((extra?.slas || []).length) {
    fieldOptions.push({
      value: "sla_id",
      label: ta("conditions.fields.sla", "SLA"),
      source: "task_field",
      valueType: "option",
      options: (extra?.slas || []).map((s) => ({
        value: s.id,
        label: s.name || `SLA #${s.id}`,
      })),
    });
  }

  fieldOptions.push(
    {
      value: "start_date",
      label: ta("conditions.fields.startDate", "Start date"),
      source: "task_field",
      valueType: "date",
    },
    {
      value: "due_date",
      label: ta("conditions.fields.dueDate", "Due date"),
      source: "task_field",
      valueType: "date",
    },
    {
      value: "expected_duration",
      label: ta("conditions.fields.expectedDuration", "Expected duration (min)"),
      source: "task_field",
      valueType: "number",
    }
  );

  const customPrefix = ta("conditions.fields.customPrefix", "Custom field");
  (customFields || []).forEach((field) => {
    fieldOptions.push({
      value: `custom_field:${field.id}`,
      label: field.name || `${customPrefix} #${field.id}`,
      source: "custom_field",
      valueType: mapCustomFieldTypeToValueType(field.field_type),
      customFieldId: field.id,
      options: normalizeOptionEntries((field as any).options),
    });
  });

  return fieldOptions;
};

export const defaultValueForType = (type: ConditionValueType, option?: ConditionFieldOption): any => {
  switch (type) {
    case "boolean":
      return true;
    case "option":
      return option?.options?.[0]?.value ?? null;
    case "number":
    case "date":
      return "";
    default:
      return "";
  }
};

export const normalizeConditionValue = (value: any, valueType?: ConditionValueType) => {
  switch (valueType) {
    case "number":
      if (value === "" || value === null || value === undefined) return null;
      return Number(value);
    case "boolean":
      if (typeof value === "string") return value === "true";
      return Boolean(value);
    case "option":
      if (value === "" || value === null || value === undefined) return null;
      if (typeof value === "number") return value;
      if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
        return Number(value);
      }
      return value;
    case "date":
      return value || "";
    default:
      return value ?? "";
  }
};

export const sanitizeConditionsForSubmit = (conditions: ApprovalCondition[]): ApprovalCondition[] => {
  return (conditions || [])
    .filter((condition) => condition && condition.field && condition.operator)
    .map((condition, index) => {
      const valueType = ((condition as any).value_type as ConditionValueType) ?? "string";
      const normalizedValue = normalizeConditionValue((condition as any).value, valueType);
      return {
        ...(condition as any),
        id: (condition as any).id || createConditionId() || `cond_${index}`,
        value: normalizedValue,
        value_type: valueType,
      } as any;
    })
    .filter((condition) => {
      const valueType = ((condition as any).value_type as ConditionValueType) ?? "string";
      if (valueType === "boolean") return true;
      if (valueType === "option" || valueType === "number") {
        return (condition as any).value !== null && (condition as any).value !== "";
      }
      return (((condition as any).value ?? "") as any) !== "";
    });
};

export const createEmptyFormState = (): ApprovalFormState => ({
  name: "",
  description: "",
  approval_type: "SEQUENTIAL",
  require_all: true,
  minimum_approvals: "",
  trigger_type: "ON_CREATE",
  trigger_conditions: [],
  require_rejection_comment: false,
  block_editing_during_approval: false,
  deadline_type: "hours",
  deadline_value: "",
  order_index: 0,
  is_active: true,
});

