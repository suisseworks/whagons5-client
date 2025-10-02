import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faGripVertical, faCopy } from "@fortawesome/free-solid-svg-icons";
import { BuilderSchemaField } from "./FormBuilder";
import { EditableTextField } from "./EditableTextField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ShortAnswerField,
  ParagraphField,
  MultipleChoiceField,
  CheckboxField
} from "./field-types";

interface DraggableFieldProps {
  field: BuilderSchemaField;
  index?: number;
  isSelected: boolean;
  isLast?: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<BuilderSchemaField>) => void;
  onRemove: () => void;
}

export function DraggableField({
  field,
  isSelected,
  isLast = false,
  onSelect,
  onUpdate,
  onRemove
}: DraggableFieldProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isDrag } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Rendered view when not selected - shows how the form will look to users
  if (!isSelected) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`rounded-lg border p-4 w-full max-w-3xl bg-card ${!isLast ? 'mx-auto' : ''} shadow-sm hover:shadow-md ${isDrag ? 'opacity-0' : ''} transition-shadow cursor-pointer`}
        onClick={onSelect}
      >
        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">
            {field.label || 'Untitled question'}
          </div>
          {field.type === 'text' && <ShortAnswerField isEditing={false} />}
          {field.type === 'textarea' && <ParagraphField isEditing={false} />}
          {field.type === 'select' && (
            <MultipleChoiceField
              options={field.options || []}
              onOptionsChange={() => {}}
              isEditing={false}
            />
          )}
          {field.type === 'checkbox' && <CheckboxField isEditing={false} />}
        </div>
      </div>
    );
  }

  // Edit view when selected - shows all editing controls
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border p-4 w-full max-w-3xl bg-card ${!isLast ? 'mx-auto' : ''} ${
        isSelected ? 'ring-2 ring-primary shadow-md' : 'shadow-sm hover:shadow-md'
      } ${isDrag ? 'opacity-0' : ''} transition-shadow`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                {...listeners}
                {...attributes}
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex-shrink-0"
              >
                <FontAwesomeIcon icon={faGripVertical} className="h-4 w-4" />
              </button>
            </div>
            <Select
              value={field.type}
              onValueChange={(value) => onUpdate({ type: value as BuilderSchemaField['type'] })}
            >
              <SelectTrigger className="w-[180px]" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Short answer</SelectItem>
                <SelectItem value="textarea">Paragraph</SelectItem>
                <SelectItem value="select">Multiple choice</SelectItem>
                <SelectItem value="checkbox">Checkbox</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <EditableTextField
            value={field.label}
            onChange={(value) => onUpdate({ label: value })}
            placeholder="Untitled question"
          />
          {field.type === 'text' && <ShortAnswerField isEditing={true} />}
          {field.type === 'textarea' && <ParagraphField isEditing={true} />}
          {field.type === 'select' && (
            <MultipleChoiceField
              options={field.options || []}
              onOptionsChange={(options) => onUpdate({ options })}
              isEditing={true}
            />
          )}
          {field.type === 'checkbox' && <CheckboxField isEditing={true} />}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Implement duplicate functionality
                  console.log('Duplicate field');
                }}
                title="Duplicate"
              >
                <FontAwesomeIcon icon={faCopy} className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                title="Delete"
              >
                <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor={`required-${field.id}`} className="text-sm">Required</Label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id={`required-${field.id}`}
                  checked={!!field.required}
                  onChange={(e) => onUpdate({ required: e.target.checked })}
                  className="sr-only peer"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

