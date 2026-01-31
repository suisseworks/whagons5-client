import { useDroppable } from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { DraggableFieldItem, TabMeta } from './types';
import { FieldItem } from './FieldItem';

interface TabColumnProps {
    tab: TabMeta;
    fields: DraggableFieldItem[];
    enabled: boolean;
    onToggleEnabled: (tabId: string, enabled: boolean) => void;
    onRemoveField: (uniqueId: string) => void;
    onEditTab?: (tabId: string) => void;
    onDeleteTab?: (tabId: string) => void;
    requiredFieldIds?: Set<number>;
}

export function TabColumn({
    tab,
    fields,
    enabled,
    onToggleEnabled,
    onRemoveField,
    onEditTab,
    onDeleteTab,
    requiredFieldIds,
}: TabColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: tab.id,
    });

    const fieldIds = fields.map(f => f.uniqueId);
    const isBasicTab = tab.id === 'basic';

    return (
        <div className="flex flex-col h-full min-w-[220px] w-[260px]">
            {/* Tab Header */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted rounded-t-lg border border-b-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Label htmlFor={`tab-${tab.id}-toggle`} className="text-sm font-medium truncate">
                        {tab.label}
                    </Label>
                    {!tab.isBuiltIn && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded shrink-0">
                            Custom
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {onEditTab && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => onEditTab(tab.id)}
                            title="Edit tab name"
                        >
                            <Pencil className="h-3 w-3" />
                        </Button>
                    )}
                    {onDeleteTab && !tab.isBuiltIn && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => onDeleteTab(tab.id)}
                            title="Delete tab"
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    )}
                    <Switch
                        id={`tab-${tab.id}-toggle`}
                        checked={enabled}
                        onCheckedChange={(checked) => onToggleEnabled(tab.id, checked)}
                        disabled={isBasicTab}
                        className="ml-1"
                    />
                </div>
            </div>

            {/* Droppable Area */}
            <div
                ref={setNodeRef}
                className={cn(
                    'flex-1 p-2 border rounded-b-lg space-y-2 min-h-[200px]',
                    'transition-colors duration-200',
                    isOver && 'bg-primary/5 border-primary/50',
                    !enabled && 'opacity-50 bg-muted/50'
                )}
            >
                <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
                    {fields.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                            <p className="text-sm text-muted-foreground text-center px-4">
                                Drag fields here
                            </p>
                        </div>
                    ) : (
                        fields.map((field) => (
                            <FieldItem
                                key={field.uniqueId}
                                item={field}
                                onRemove={onRemoveField}
                                isRequired={
                                    field.field.type === 'custom' &&
                                    typeof field.field.id === 'number' &&
                                    requiredFieldIds?.has(field.field.id)
                                }
                                disabled={!enabled}
                            />
                        ))
                    )}
                </SortableContext>
            </div>
        </div>
    );
}
