import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { EditableTitle } from "./EditableTitle";
import { EditableTextField } from "./EditableTextField";
import { DraggableField } from "./DraggableField";
import { AddFieldToolbar } from "./AddFieldToolbar";

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
  title?: string;
  description?: string;
}

export interface FormBuilderProps {
  schema: BuilderSchema;
  onChange: (next: BuilderSchema) => void;
  onSaveDraft?: () => void;
  onPublish?: () => void;
  onPreview?: () => void;
}

export function FormBuilder({ schema, onChange }: FormBuilderProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'title' | 'description' | 'field-label' | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const updateSchema = (updates: Partial<BuilderSchema>) => {
    onChange({ ...schema, ...updates });
  };

  const updateField = (index: number, updates: Partial<BuilderSchemaField>) => {
    const next: BuilderSchema = {
      ...schema,
      fields: [...(schema.fields || [])]
    };
    next.fields[index] = { ...next.fields[index], ...updates } as BuilderSchemaField;
    onChange(next);
  };

  const addField = (type: BuilderSchemaField['type'], insertAfterIndex?: number) => {
    const newField: BuilderSchemaField = {
      id: Date.now(),
      type,
      label: '',
      required: false,
      options: type === 'select' ? [''] : undefined,
      placeholder: undefined
    };

    const next: BuilderSchema = {
      ...schema,
      fields: [...(schema.fields || [])]
    };

    if (insertAfterIndex !== undefined) {
      next.fields.splice(insertAfterIndex + 1, 0, newField);
    } else {
      next.fields.push(newField);
    }

    onChange(next);
    setSelectedIndex(insertAfterIndex !== undefined ? insertAfterIndex + 1 : next.fields.length - 1);
  };

  const removeField = (index: number) => {
    const next: BuilderSchema = {
      ...schema,
      fields: [...(schema.fields || [])]
    };
    next.fields.splice(index, 1);
    onChange(next);
    setSelectedIndex(null);
  };


  const handleDragStart = (event: DragEndEvent) => {
    setActiveId(Number(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeIndex = schema.fields?.findIndex(field => field.id === Number(active.id)) ?? -1;
    const overIndex = schema.fields?.findIndex(field => field.id === Number(over.id)) ?? -1;

    if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
      const nextFields = arrayMove(schema.fields || [], activeIndex, overIndex);
      onChange({ ...schema, fields: nextFields });
      setSelectedIndex(overIndex);
    }
  };

  const fields = schema.fields || [];
  const fieldIds = fields.map(field => field.id);

  return (
    <div className="flex gap-3 justify-center w-full">
      {/* Main form container with fixed width */}
      <div className="space-y-3 w-full max-w-3xl pt-1">
        {/* Form Title and Description - Combined in one tile */}
        <div 
          className={`rounded-lg border p-6 bg-card transition-all ${
            editingField === 'title' || editingField === 'description' 
              ? 'ring-2 ring-primary shadow-md' 
              : 'shadow-sm hover:shadow-md'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedIndex(null); // Deselect any field cards
            // Don't auto-focus if clicking elsewhere in the card
          }}
        >
          <div className="space-y-1">
        <EditableTitle
          value={schema.title || ''}
          onChange={(value) => updateSchema({ title: value })}
          placeholder="Untitled form"
          isEditing={editingField === 'title'}
          onEditingChange={(editing) => setEditingField(editing ? 'title' : null)}
        />
        <EditableTextField
          value={schema.description || ''}
          onChange={(value) => updateSchema({ description: value })}
          placeholder="Form description"
          isEditing={editingField === 'description'}
          onEditingChange={(editing) => setEditingField(editing ? 'description' : null)}
        />
          </div>
      </div>

      {/* Form Fields */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-3">
          {fields.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-primary/30 bg-card p-8 text-center shadow-sm">
              <div className="text-muted-foreground mb-4">
                Start building your form by adding your first field
              </div>
                <div className="flex justify-center">
                  <AddFieldToolbar onAddField={(type) => addField(type)} />
                </div>
            </div>
          ) : (
              <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
                {fields.map((field, index) => (
                    <DraggableField
                    key={field.id}
                      field={field}
                      isSelected={selectedIndex === index}
                    isLast={false}
                      onSelect={() => setSelectedIndex(index)}
                      onUpdate={(updates) => updateField(index, updates)}
                      onRemove={() => removeField(index)}
                    />
                ))}
              </SortableContext>
          )}
        </div>

        <DragOverlay>
          {activeId ? (
            <DraggableField
              field={fields.find(f => f.id === activeId)!}
              isSelected={true}
              onSelect={() => {}}
              onUpdate={() => {}}
              onRemove={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Field count */}
      <div className="text-sm text-muted-foreground text-center pt-4">
        {fields.length === 0 ? 'No fields yet' : `${fields.length} field${fields.length === 1 ? '' : 's'}`}
      </div>
      </div>

      {/* Add field toolbar - outside the main container, at the bottom */}
      {fields.length > 0 && (
        <div className="flex-shrink-0 self-end pb-4">
          <AddFieldToolbar onAddField={(type) => addField(type)} />
        </div>
      )}
    </div>
  );
}

export default FormBuilder;


