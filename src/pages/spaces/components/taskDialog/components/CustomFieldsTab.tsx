import { Label } from '@/components/ui/label';
import { CustomFieldInput } from './CustomFieldInput';
import { isCustomFieldValueFilled } from '../utils/customFieldSerialization';

export function CustomFieldsTab(props: any) {
  const { categoryId, categoryFields, customFieldValues, handleCustomFieldValueChange } = props;

  if (!categoryId) {
    return <p className="text-sm text-muted-foreground">Selecciona una categoría para ver los campos personalizados.</p>;
  }

  if (categoryFields.length === 0) {
    return <p className="text-sm text-muted-foreground">Esta categoría no tiene campos personalizados asignados.</p>;
  }

  return (
    <div className="space-y-4">
      {categoryFields.map(({ assignment, field }: { assignment: any; field: any }) => {
        const fieldId = Number(field?.id);
        const required = assignment?.is_required;
        const currentValue = customFieldValues[fieldId];
        const showError = required && !isCustomFieldValueFilled(field, currentValue);

        return (
          <div key={fieldId} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium font-[500] text-foreground">
                {field?.name ?? 'Campo'}
              </Label>
              {required && (
                <span className="text-[11px] text-red-500 font-semibold">Requerido</span>
              )}
            </div>
            <CustomFieldInput
              field={field}
              value={currentValue}
              onChange={(v) => handleCustomFieldValueChange(fieldId, v)}
            />
            {showError && (
              <p className="text-xs text-red-500">Completa este campo para continuar.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
