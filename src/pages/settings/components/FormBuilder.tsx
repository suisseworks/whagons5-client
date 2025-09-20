import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFloppyDisk, faTrash, faArrowUp, faArrowDown } from "@fortawesome/free-solid-svg-icons";

export interface BuilderSchemaField {
  id: number;
  type: 'text' | 'textarea' | 'select' | 'checkbox';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

export interface BuilderSchema {
  fields: BuilderSchemaField[];
  form_id?: number;
}

export interface FormBuilderProps {
  schema: BuilderSchema;
  onChange: (next: BuilderSchema) => void;
  onSaveDraft?: () => void;
  onPublish?: () => void;
  onPreview?: () => void;
}

export function FormBuilder({ schema, onChange, onSaveDraft, onPublish, onPreview }: FormBuilderProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const addField = (type: BuilderSchemaField['type']) => {
    const next: BuilderSchema = {
      ...schema,
      fields: [
        ...(schema.fields || []),
        {
          id: Date.now(),
          type,
          label: type === 'checkbox' ? 'Untitled checkbox' : 'Untitled question',
          required: false,
          options: type === 'select' ? ['Option 1', 'Option 2'] : undefined,
          placeholder: type === 'text' ? 'Your answer' : undefined
        },
      ],
    };
    onChange(next);
    setSelectedIndex((schema.fields?.length || 0));
  };

  const updateField = (index: number, updates: Partial<BuilderSchemaField>) => {
    const next: BuilderSchema = { ...schema, fields: [...(schema.fields || [])] };
    next.fields[index] = { ...next.fields[index], ...updates } as BuilderSchemaField;
    onChange(next);
  };

  const removeField = (index: number) => {
    const next: BuilderSchema = { ...schema, fields: [...(schema.fields || [])] };
    next.fields.splice(index, 1);
    onChange(next);
    setSelectedIndex(null);
  };

  const moveField = (index: number, dir: -1 | 1) => {
    const next: BuilderSchema = { ...schema, fields: [...(schema.fields || [])] };
    const target = index + dir;
    if (target < 0 || target >= next.fields.length) return;
    const [f] = next.fields.splice(index, 1);
    next.fields.splice(target, 0, f);
    onChange(next);
    setSelectedIndex(target);
  };

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Palette */}
      <div className="col-span-12 lg:col-span-3">
        <div className="rounded-lg border p-3 space-y-3">
          <div className="text-sm font-medium">Add fields</div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => addField('text')}>Text</Button>
            <Button variant="outline" size="sm" onClick={() => addField('textarea')}>Paragraph</Button>
            <Button variant="outline" size="sm" onClick={() => addField('select')}>Select</Button>
            <Button variant="outline" size="sm" onClick={() => addField('checkbox')}>Checkbox</Button>
          </div>
          <div className="pt-2 flex gap-2">
            {onSaveDraft && (
              <Button size="sm" onClick={onSaveDraft}>
                <FontAwesomeIcon icon={faFloppyDisk} className="mr-2" />Save draft
              </Button>
            )}
            {onPublish && (
              <Button size="sm" variant="secondary" onClick={onPublish}>Publish</Button>
            )}
          </div>
          {onPreview && (
            <div className="pt-2">
              <Button size="sm" variant="outline" onClick={onPreview}>Preview</Button>
            </div>
          )}
        </div>
      </div>

      {/* Canvas with inline editing */}
      <div className="col-span-12 lg:col-span-9">
        <div className="space-y-3">
          {(schema.fields || []).length === 0 && (
            <div className="rounded-lg border p-6 text-center text-muted-foreground">
              Start by adding fields from the left.
            </div>
          )}
          {(schema.fields || []).map((field, idx) => (
            <div
              key={field.id}
              className={`rounded-lg border p-4 ${selectedIndex === idx ? 'ring-2 ring-ring' : ''}`}
              onClick={() => setSelectedIndex(idx)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="text-xs text-muted-foreground">{field.type}</div>
                  <input
                    className="w-full px-3 py-2 border rounded text-sm"
                    value={field.label}
                    onChange={(e) => updateField(idx, { label: e.target.value })}
                  />
                  {field.type === 'text' && (
                    <input
                      className="w-full px-3 py-2 border rounded text-sm"
                      placeholder={field.placeholder || 'Your answer'}
                      value={field.placeholder || ''}
                      onChange={(e) => updateField(idx, { placeholder: e.target.value })}
                    />
                  )}
                  {field.type === 'textarea' && (
                    <textarea
                      className="w-full px-3 py-2 border rounded text-sm"
                      placeholder={field.placeholder || 'Your answer'}
                      value={field.placeholder || ''}
                      onChange={(e) => updateField(idx, { placeholder: e.target.value })}
                    />
                  )}
                  {field.type === 'select' && (
                    <textarea
                      className="w-full px-3 py-2 border rounded text-sm"
                      placeholder={'Options (one per line)'}
                      value={(field.options || []).join('\n')}
                      onChange={(e) => updateField(idx, { options: e.target.value.split('\n').filter(Boolean) })}
                    />
                  )}
                  {field.type === 'checkbox' && (
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" disabled />
                      Checkbox preview
                    </label>
                  )}
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={!!field.required}
                      onChange={(e) => updateField(idx, { required: e.target.checked })}
                    />
                    Required
                  </label>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" onClick={() => moveField(idx, -1)}>
                      <FontAwesomeIcon icon={faArrowUp} />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => moveField(idx, 1)}>
                      <FontAwesomeIcon icon={faArrowDown} />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => removeField(idx)}>
                      <FontAwesomeIcon icon={faTrash} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FormBuilder;


