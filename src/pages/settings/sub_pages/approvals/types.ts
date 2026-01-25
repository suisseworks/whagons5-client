import type { ApprovalCondition } from "@/store/types";

export type TriggerType = "ON_CREATE" | "MANUAL" | "CONDITIONAL" | "ON_COMPLETE";
export type ApprovalFlowType = "SEQUENTIAL" | "PARALLEL";
export type DeadlineType = "hours" | "date";
export type ConditionValueType = "string" | "number" | "boolean" | "date" | "option";
export type ConditionOperator = ApprovalCondition["operator"];

export type ConditionFieldOption = {
  value: string;
  label: string;
  source: "task_field" | "custom_field";
  valueType: ConditionValueType;
  customFieldId?: number;
  options?: Array<{ value: string | number; label: string }>;
};

export type TranslateFn = (key: string, fallback: string) => string;

export type ApprovalFormState = {
  name: string;
  description: string;
  approval_type: ApprovalFlowType;
  require_all: boolean;
  minimum_approvals: number | string | "";
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

