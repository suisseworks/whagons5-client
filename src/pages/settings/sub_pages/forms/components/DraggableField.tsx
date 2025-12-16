import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faGripVertical, faCopy } from "@fortawesome/free-solid-svg-icons";
import { BuilderSchemaField } from "./FormBuilder";
import { AddFieldToolbar } from "./AddFieldToolbar";
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
  CheckboxField,
  DateField,
  TimeField,
  DateTimeField,
  NumberField,
  SignatureField
} from "./field-types";

interface DraggableFieldProps {
  field: BuilderSchemaField;
  index?: number;
  isSelected: boolean;
  isLast?: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<BuilderSchemaField>) => void;
  onRemove: () => void;
  onAddFieldAfter?: (type: BuilderSchemaField['type'], insertAfterIndex: number) => void;
  setContainerRef?: (el: HTMLDivElement | null) => void;
  lockedHeight?: number;
  startOffsetY?: number;
}

export function DraggableField({
  field,
  index,
  isSelected,
  isLast = false,
  onSelect,
  onUpdate,
  onRemove,
  onAddFieldAfter,
  setContainerRef,
  lockedHeight,
  startOffsetY
}: DraggableFieldProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isDrag } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Measure heights to synchronize expand/collapse speeds
  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [measuredHeights, setMeasuredHeights] = useState<{ preview: number; editor: number }>({ preview: 0, editor: 0 });

  useEffect(() => {
    const preview = previewRef.current?.scrollHeight || 0;
    const editor = editorRef.current?.scrollHeight || 0;
    if (preview !== measuredHeights.preview || editor !== measuredHeights.editor) {
      setMeasuredHeights({ preview, editor });
    }
  }, [isSelected, field.type, field.options, field.label]);

  const PREVIEW_HEIGHT = measuredHeights.preview || 240;
  const EDITOR_HEIGHT = measuredHeights.editor || 480;
  const PX_PER_MS = 2.2; // pixels per millisecond
  const previewDurMs = Math.max(120, Math.round(PREVIEW_HEIGHT / PX_PER_MS));
  const editorDurMs = Math.max(120, Math.round(EDITOR_HEIGHT / PX_PER_MS));
  // Ensure both expand and collapse complete at EXACTLY the same time
  const commonDurMs = Math.max(previewDurMs, editorDurMs);

  // Unified container with animated height between preview and edit states
  return (
    <motion.div
      ref={(el) => { setNodeRef(el); setContainerRef?.(el); }}
      style={style}
      className={`relative group rounded-lg border p-4 w-full max-w-3xl bg-card ${!isLast ? 'mx-auto' : ''} ${
        isSelected ? 'ring-2 ring-primary shadow-md' : 'shadow-sm hover:shadow-md'
      } ${isDrag ? 'opacity-0' : ''} transition-all duration-200 cursor-pointer`}
      onClick={onSelect}
      initial={typeof startOffsetY === 'number' ? { y: startOffsetY } : undefined}
      animate={typeof startOffsetY === 'number' ? { y: 0 } : undefined}
      transition={typeof startOffsetY === 'number' ? { duration: 0.2, ease: 'linear' } : undefined}
    >
      {/* Top-center drag handle (shows on hover) */}
      <button
        {...listeners}
        {...attributes}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-1/2 -translate-x-1/2 -top-3 h-7 w-7 rounded-md bg-card border shadow-sm text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex items-center justify-center z-10"
        aria-label="Drag field"
      >
        <FontAwesomeIcon icon={faGripVertical} className="h-4 w-4" />
      </button>
      {/* Floating add-field toolbar */}
      {isSelected && onAddFieldAfter && (
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-10">
          <AddFieldToolbar onAddField={(t) => onAddFieldAfter(t, index ?? 0)} />
        </div>
      )}
      {/* Preview (collapsed) - drag handle also works here via top-center button */}
      <div
        className={`overflow-hidden transition-[max-height,opacity] ${isSelected ? 'opacity-0' : 'opacity-100'}`}
        style={{ maxHeight: isSelected ? (lockedHeight ?? 0) : PREVIEW_HEIGHT, transitionDuration: `${commonDurMs}ms`, transitionTimingFunction: 'linear' }}
      >
        <div ref={previewRef} className="space-y-3">
          <div className="text-sm font-medium text-foreground" dangerouslySetInnerHTML={{ __html: field.label || 'Untitled question' }} />
          {field.type === 'text' && <ShortAnswerField isEditing={false} />}
          {field.type === 'textarea' && <ParagraphField isEditing={false} />}
          {field.type === 'select' && (
            <MultipleChoiceField
              options={field.options || []}
              onOptionsChange={() => {}}
              isEditing={false}
            />
          )}
          {field.type === 'checkbox' && (
            <CheckboxField
              options={field.options || []}
              onOptionsChange={() => {}}
              isEditing={false}
            />
          )}
          {field.type === 'date' && <DateField isEditing={false} />}
          {field.type === 'time' && <TimeField isEditing={false} />}
          {field.type === 'datetime' && <DateTimeField isEditing={false} />}
          {field.type === 'number' && <NumberField isEditing={false} />}
          {field.type === 'signature' && <SignatureField isEditing={false} />}
        </div>
      </div>

      {/* Editor (expanded) */}
      <div
        className={`overflow-hidden transition-[max-height,opacity] ${isSelected ? 'opacity-100' : 'opacity-0'}`}
        style={{ maxHeight: isSelected ? EDITOR_HEIGHT : 0, transitionDuration: `${commonDurMs}ms`, transitionTimingFunction: 'linear' }}
      >
        <div ref={editorRef} className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2" />
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
                  <SelectItem value="checkbox">Multi-select</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="time">Time</SelectItem>
                  <SelectItem value="datetime">Date & Time</SelectItem>
                  <SelectItem value="signature">Signature</SelectItem>
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
            {field.type === 'checkbox' && (
              <CheckboxField
                options={field.options || []}
                onOptionsChange={(options) => onUpdate({ options })}
                isEditing={true}
              />
            )}
            {field.type === 'date' && <DateField isEditing={true} />}
            {field.type === 'time' && <TimeField isEditing={true} />}
            {field.type === 'datetime' && <DateTimeField isEditing={true} />}
            {field.type === 'number' && <NumberField isEditing={true} />}
            {field.type === 'signature' && <SignatureField isEditing={true} />}
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
    </motion.div>
  );
}

