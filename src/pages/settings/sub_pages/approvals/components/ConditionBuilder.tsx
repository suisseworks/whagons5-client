import { useMemo } from "react";
import type { ApprovalCondition } from "@/store/types";
import { Button } from "@/components/ui/button";
import { CheckboxField, SelectField, TextField } from "../../../components";
import type { ConditionFieldOption, ConditionOperator, ConditionValueType, TranslateFn } from "../types";
import {
  CONDITION_OPERATORS_BY_TYPE,
  CONDITION_OPERATOR_DISPLAY,
  CONDITION_OPERATOR_LABELS,
  DEFAULT_OPERATOR_BY_TYPE,
  createConditionId,
  defaultValueForType,
} from "../utils/conditions";

type ConditionBuilderProps = {
  conditions: ApprovalCondition[];
  onChange: (next: ApprovalCondition[]) => void;
  fieldOptions: ConditionFieldOption[];
  ta: TranslateFn;
};

export const ConditionBuilder = ({ conditions, onChange, fieldOptions, ta }: ConditionBuilderProps) => {
  const { optionsByValue, selectOptions } = useMemo(() => {
    const map = new Map<string, ConditionFieldOption>();
    const combined = [...fieldOptions];
    fieldOptions.forEach((option) => map.set(option.value, option));
    conditions.forEach((condition, index) => {
      const key = (condition as any).field || `missing-${index}`;
      if (!map.has(key) && (condition as any).field) {
        const fallbackOption: ConditionFieldOption = {
          value: (condition as any).field,
          label: (condition as any).label || (condition as any).field,
          source: ((condition as any).source as any) || "task_field",
          valueType: (((condition as any).value_type as ConditionValueType) || "string") as any,
          customFieldId: (condition as any).custom_field_id ?? undefined,
        };
        map.set((condition as any).field, fallbackOption);
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
    const firstField = fieldOptions.find((option) => !option.value.startsWith("__divider__"));
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
      } as any,
    ]);
  };

  const updateCondition = (id: string, updates: Partial<ApprovalCondition>) => {
    onChange(
      conditions.map((condition) =>
        ((condition as any).id || (condition as any).field) === id ? ({ ...(condition as any), ...(updates as any) } as any) : condition
      )
    );
  };

  const removeCondition = (id: string) => {
    onChange(conditions.filter((condition) => ((condition as any).id || (condition as any).field) !== id));
  };

  const handleFieldChange = (id: string, nextValue: string) => {
    const fieldOption = optionsByValue.get(nextValue);
    const valueType = fieldOption?.valueType ?? "string";
    updateCondition(id, {
      field: nextValue,
      label: fieldOption?.label,
      source: fieldOption?.source as any,
      custom_field_id: fieldOption?.customFieldId as any,
      value_type: valueType as any,
      operator: DEFAULT_OPERATOR_BY_TYPE[valueType] as any,
      value: defaultValueForType(valueType, fieldOption),
      value_label: fieldOption?.options?.[0]?.label as any,
    } as any);
  };

  const handleOperatorChange = (id: string, nextOperator: ConditionOperator) => {
    updateCondition(id, { operator: nextOperator } as any);
  };

  const handleValueChange = (
    id: string,
    rawValue: string | number | boolean,
    fieldOption?: ConditionFieldOption,
    valueType?: ConditionValueType
  ) => {
    const resolvedType = valueType ?? "string";
    if (resolvedType === "boolean") {
      updateCondition(id, { value: Boolean(rawValue) } as any);
      return;
    }

    if (resolvedType === "option") {
      const optionValue = String(rawValue);
      const matched = fieldOption?.options?.find((opt) => String(opt.value) === optionValue);
      updateCondition(id, {
        value: (matched?.value ?? optionValue) as any,
        value_label: (matched?.label ?? optionValue) as any,
      } as any);
      return;
    }

    updateCondition(id, { value: rawValue as any } as any);
  };

  const valueLabel = ta("conditions.valueLabel", "Value");
  const operatorLabel = ta("conditions.operatorLabel", "Operator");
  const fieldLabel = ta("conditions.fieldLabel", "Field");
  const helper = ta("conditions.helper", "All conditions must be met to trigger this approval.");
  const emptyCopy = ta("conditions.empty", "Add at least one condition to define when this approval should run.");
  const sectionTitle = ta("conditions.sectionTitle", "Conditions");
  const addLabel = ta("conditions.add", "Add condition");
  const removeLabel = ta("conditions.remove", "Remove");

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
        <div className="text-sm text-muted-foreground border border-dashed rounded-md p-4">{emptyCopy}</div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3 text-xs font-semibold text-muted-foreground px-1">
            <span>{fieldLabel}</span>
            <span>{operatorLabel}</span>
            <span>{valueLabel}</span>
          </div>
          {conditions.map((condition, index) => {
            const conditionId = (condition as any).id || `${(condition as any).field}-${index}`;
            const fieldOption = optionsByValue.get((condition as any).field);
            const valueType =
              (((condition as any).value_type as ConditionValueType) ?? fieldOption?.valueType ?? "string") as ConditionValueType;
            const operators = CONDITION_OPERATORS_BY_TYPE[valueType] ?? CONDITION_OPERATORS_BY_TYPE.string;

            return (
              <div key={conditionId} className="rounded-md border border-border bg-background p-3 space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <SelectField
                    id={`condition-field-${conditionId}`}
                    label=""
                    value={(condition as any).field}
                    onChange={(val) => handleFieldChange(conditionId, val)}
                    options={selectOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />

                  <SelectField
                    id={`condition-operator-${conditionId}`}
                    label=""
                    value={(condition as any).operator}
                    onChange={(val) => handleOperatorChange(conditionId, val as ConditionOperator)}
                    options={operators.map((operator) => ({
                      value: operator,
                      label: (operatorDisplayLabels as any)[operator] ?? (operatorLabels as any)[operator] ?? operator,
                    }))}
                  />

                  {valueType === "boolean" ? (
                    <CheckboxField
                      id={`condition-value-${conditionId}`}
                      label={valueLabel}
                      checked={Boolean(((condition as any).value ?? true) as any)}
                      onChange={(checked) => handleValueChange(conditionId, checked, fieldOption, valueType)}
                      hideFieldLabel
                    />
                  ) : valueType === "option" ? (
                    <SelectField
                      id={`condition-value-${conditionId}`}
                      label=""
                      value={String(((condition as any).value ?? "") as any)}
                      onChange={(val) => handleValueChange(conditionId, val, fieldOption, valueType)}
                      options={(fieldOption?.options || []).map((opt) => ({
                        value: opt.value,
                        label: opt.label,
                      }))}
                      placeholder={ta("conditions.valuePlaceholder", "Select a value")}
                    />
                  ) : (
                    <TextField
                      id={`condition-value-${conditionId}`}
                      label=""
                      type={valueType === "number" ? "number" : valueType === "date" ? "date" : "text"}
                      value={String(((condition as any).value ?? "") as any)}
                      onChange={(val) => handleValueChange(conditionId, val, fieldOption, valueType)}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{ta("conditions.logicHint", "All conditions are evaluated with AND logic.")}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeCondition(conditionId)}>
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

