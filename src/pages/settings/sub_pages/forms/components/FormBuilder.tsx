import { useCallback, useEffect, useRef, useState } from "react";
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
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'date' | 'number' | 'time' | 'datetime' | 'signature';
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

// In DragOverlay, we want to animate from preview → editing on drop.
// This wrapper mounts as preview, then flips to editing in the next frame
// when `toSelected` is true, so DraggableField's internal transitions run.
function AnimatedOverlayField({ field, toSelected }: { field: BuilderSchemaField; toSelected: boolean }) {
  const [selected, setSelected] = useState<boolean>(false);
  useEffect(() => {
    if (toSelected) {
      const id = requestAnimationFrame(() => setSelected(true));
      return () => cancelAnimationFrame(id);
    } else {
      setSelected(false);
    }
  }, [toSelected]);

  return (
    <DraggableField
      field={field}
      isSelected={selected}
      onSelect={() => {}}
      onUpdate={() => {}}
      onRemove={() => {}}
    />
  );
}

export function FormBuilder({ schema, onChange }: FormBuilderProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [dropAnimatingId, setDropAnimatingId] = useState<number | null>(null);
  const [floatingToolbarStyle, setFloatingToolbarStyle] = useState<{ top: number; left: number } | null>(null);
  const selectedElRef = useRef<HTMLDivElement | null>(null);
  const [editingField, setEditingField] = useState<'title' | 'description' | 'field-label' | null>(null);
  const [lockedCollapse, setLockedCollapse] = useState<{ index: number; height: number } | null>(null);
  const [dropStartOffset, setDropStartOffset] = useState<{ index: number; offset: number } | null>(null);
  const [overlayFromRect, setOverlayFromRect] = useState<DOMRect | null>(null);
  const [overlayToRect, setOverlayToRect] = useState<DOMRect | null>(null);
  const [overlayAnimActive, setOverlayAnimActive] = useState<boolean>(false);

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
    const needsOptions = type === 'select' || type === 'checkbox';
    const newField: BuilderSchemaField = {
      id: Date.now(),
      type,
      label: '',
      required: false,
      options: needsOptions ? [''] : undefined,
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
    const finishedId = Number(active.id);
    setActiveId(null);
    setDropAnimatingId(finishedId);

    if (!over) return;

    const activeIndex = schema.fields?.findIndex(field => field.id === Number(active.id)) ?? -1;
    const overIndex = schema.fields?.findIndex(field => field.id === Number(over.id)) ?? -1;
    const prevSelected = selectedIndex;

    if (activeIndex !== -1 && overIndex !== -1) {
      // Snapshot the old rect (where the overlay thinks it should go)
      const overEl = document.querySelector(`[data-draggable-id="${Number(over.id)}"]`) as HTMLElement | null;
      if (overEl) {
        setOverlayFromRect(overEl.getBoundingClientRect());
      }

      // Commit the final layout immediately
      const nextFields = activeIndex !== overIndex
        ? arrayMove(schema.fields || [], activeIndex, overIndex)
        : (schema.fields || []);
      onChange({ ...schema, fields: nextFields });
      setSelectedIndex(overIndex);

      // If dropping below previously selected, nudge the new card upward from delta height
      if (prevSelected !== null) {
        const prevEl = document.querySelectorAll('[data-draggable-id]')[prevSelected] as HTMLElement | null;
        if (prevEl) {
          const prevExpanded = Number(prevEl.getAttribute('data-expanded-height') || 0);
          const prevCollapsed = Number(prevEl.getAttribute('data-collapsed-height') || 0);
          const delta = Math.max(0, prevExpanded - prevCollapsed);
          const newIndexAfter = nextFields.findIndex(f => f.id === finishedId);
          if (newIndexAfter > prevSelected && delta > 0) {
            setDropStartOffset({ index: newIndexAfter, offset: delta });
            setTimeout(() => setDropStartOffset(null), 220);
          }
        }
      }

      // Next frame, measure the real destination rect and start animating
      requestAnimationFrame(() => {
        const destEl = document.querySelector(`[data-draggable-id="${finishedId}"]`) as HTMLElement | null;
        if (destEl) {
          setOverlayToRect(destEl.getBoundingClientRect());
          // kick animation on next frame so the "from" paint happens first
          requestAnimationFrame(() => setOverlayAnimActive(true));
        }
      });
    }

    // Lock the previous selected card's height to prevent layout shift during overlay return
    if (prevSelected !== null && selectedElRef.current) {
      const rect = selectedElRef.current.getBoundingClientRect();
      setLockedCollapse({ index: prevSelected, height: rect.height });
    }

    // Clear drop animation flag after a short delay (matches DragOverlay default)
    window.setTimeout(() => {
      setDropAnimatingId(null);
      setLockedCollapse(null);
      setOverlayFromRect(null);
      setOverlayToRect(null);
      setOverlayAnimActive(false);
      setDropStartOffset(null);
    }, 250);
  };

  const fields = schema.fields || [];
  const fieldIds = fields.map(field => field.id);

  // Update floating toolbar position whenever selection changes
  const updateFloatingToolbarFromEl = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const top = rect.top + rect.height / 2 + (window.scrollY || document.documentElement.scrollTop);
    const left = rect.right + 12 + (window.scrollX || document.documentElement.scrollLeft);
    setFloatingToolbarStyle(prev => {
      if (!prev || Math.abs(prev.top - top) > 0.5 || Math.abs(prev.left - left) > 0.5) {
        return { top, left };
      }
      return prev;
    });
  }, []);

  const updateFloatingToolbar = (el: HTMLDivElement | null) => {
    // Avoid setState inside ref callback to prevent nested update loops
    selectedElRef.current = el;
  };

  useEffect(() => {
    const onScrollOrResize = () => {
      if (selectedElRef.current) updateFloatingToolbarFromEl(selectedElRef.current);
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [updateFloatingToolbarFromEl]);

  // Recompute toolbar position when selection changes (post-commit)
  useEffect(() => {
    if (selectedElRef.current) updateFloatingToolbarFromEl(selectedElRef.current);
  }, [selectedIndex, updateFloatingToolbarFromEl]);

  // Flip overlay into "editing" immediately when the user releases the pointer
  useEffect(() => {
    if (!activeId) return;
    const handlePointerUp = () => {
      setDropAnimatingId(activeId);
    };
    window.addEventListener('pointerup', handlePointerUp, { capture: true, once: true } as any);
    return () => window.removeEventListener('pointerup', handlePointerUp, true);
  }, [activeId]);

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
        <div className="space-y-3 will-change-transform">
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
                      onAddFieldAfter={(type) => addField(type, index)}
                      setContainerRef={selectedIndex === index ? updateFloatingToolbar : undefined}
                      lockedHeight={lockedCollapse?.index === index ? lockedCollapse.height : undefined}
                      startOffsetY={dropStartOffset?.index === index ? dropStartOffset.offset : undefined}
                    />
                ))}
              </SortableContext>
          )}
        </div>

      <DragOverlay>
        {(() => {
          const overlayId = activeId ?? dropAnimatingId;
          if (!overlayId) return null;
          const overlayIndex = fields.findIndex(f => f.id === overlayId);
          const overlayField = fields[overlayIndex]!;
          const shouldAnimateToSelected = Boolean(dropAnimatingId);
          const hasRects = overlayFromRect && overlayToRect;
          const fromT = overlayFromRect ? `translate(${overlayFromRect.left + (window.scrollX||0)}px, ${overlayFromRect.top + (window.scrollY||0)}px)` : undefined;
          const toT = overlayToRect ? `translate(${overlayToRect.left + (window.scrollX||0)}px, ${overlayToRect.top + (window.scrollY||0)}px)` : undefined;
          const style = hasRects ? {
            position: 'fixed' as const,
            left: 0,
            top: 0,
            transform: overlayAnimActive ? toT : fromT,
            transition: overlayAnimActive ? 'transform 180ms linear' : 'none'
          } : undefined;
          return (
            <div style={style}>
              <AnimatedOverlayField
                key={`animated-${overlayId}-${shouldAnimateToSelected ? 'to-selected' : 'static'}`}
                field={overlayField}
                toSelected={shouldAnimateToSelected}
              />
            </div>
          );
        })()}
      </DragOverlay>
      </DndContext>

      {/* Field count */}
      <div className="text-sm text-muted-foreground text-center pt-4">
        {fields.length === 0 ? 'No fields yet' : `${fields.length} field${fields.length === 1 ? '' : 's'}`}
      </div>
      </div>

      {/* Add field toolbars */}
      {fields.length > 0 && (
        <>
          {/* Floating toolbar that follows the selected field. Hidden with display:none when no selection */}
          <div
            className={`${selectedIndex !== null ? 'fixed z-20 transition-transform duration-200 will-change-transform' : ''}`}
            style={
              selectedIndex !== null && floatingToolbarStyle
                ? { transform: `translate(${floatingToolbarStyle.left}px, ${floatingToolbarStyle.top}px) translateY(-50%)`, display: 'block' }
                : { display: 'none' }
            }
          >
            <AddFieldToolbar onAddField={(type) => addField(type, selectedIndex ?? undefined)} />
          </div>

          {/* Bottom-right toolbar when no field is selected (e.g., title/description selected) */}
          {selectedIndex === null && (
            <div className="flex-shrink-0 self-end pb-4">
              <AddFieldToolbar onAddField={(type) => addField(type)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

