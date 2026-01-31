import { useState, useMemo, useCallback, useEffect } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragStartEvent,
    type DragEndEvent,
    type DragOverEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useSelector } from 'react-redux';
import { RefreshCw, Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import type { RootState } from '@/store/store';
import type { DialogLayout, DialogFieldConfig, DialogTabId, CustomField, CategoryCustomField, DialogTabConfig } from '@/store/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { TabColumn } from './TabColumn';
import { FieldItem } from './FieldItem';
import {
    STANDARD_FIELDS,
    BUILT_IN_TABS,
    type DraggableFieldItem,
    type TabMeta,
    createFieldUniqueId,
    getStandardFieldMeta,
    generateCustomTabId,
} from './types';
import { createDefaultLayout, getEffectiveLayout } from './defaultLayout';

interface DialogLayoutEditorProps {
    categoryId: number;
    value: DialogLayout | null | undefined;
    onChange: (layout: DialogLayout | null) => void;
}

export function DialogLayoutEditor({
    categoryId,
    value,
    onChange,
}: DialogLayoutEditorProps) {
    // Redux state for custom fields
    const customFields = useSelector((state: RootState) => state.customFields.value);
    const categoryCustomFields = useSelector((state: RootState) => state.categoryCustomFields.value);

    // Filter custom fields assigned to this category
    const assignedCustomFields = useMemo(() => {
        return categoryCustomFields.filter(cf => cf.category_id === categoryId);
    }, [categoryCustomFields, categoryId]);

    const customFieldsMap = useMemo(() => {
        return new Map(customFields.map(cf => [cf.id, cf]));
    }, [customFields]);

    // Required field IDs (from category assignments)
    const requiredFieldIds = useMemo(() => {
        return new Set(
            assignedCustomFields
                .filter(a => a.is_required)
                .map(a => a.field_id)
        );
    }, [assignedCustomFields]);

    // Get effective layout (merging custom fields with existing layout)
    const effectiveLayout = useMemo(() => {
        return getEffectiveLayout(value, assignedCustomFields, customFieldsMap);
    }, [value, assignedCustomFields, customFieldsMap]);

    // Local state for editing
    const [layout, setLayout] = useState<DialogLayout>(effectiveLayout);
    const [activeId, setActiveId] = useState<string | null>(null);

    // State for add/edit tab dialog
    const [tabDialogOpen, setTabDialogOpen] = useState(false);
    const [editingTabId, setEditingTabId] = useState<string | null>(null);
    const [tabName, setTabName] = useState('');

    // Sync with external value changes
    useEffect(() => {
        setLayout(effectiveLayout);
    }, [effectiveLayout]);

    // Get all tabs (built-in + custom) sorted by order
    const allTabs = useMemo((): TabMeta[] => {
        const tabs: TabMeta[] = [];
        
        // Add built-in tabs
        for (const builtIn of BUILT_IN_TABS) {
            const config = layout.tabs[builtIn.id];
            tabs.push({
                id: builtIn.id,
                label: config?.label || builtIn.label,
                icon: builtIn.icon,
                isBuiltIn: true,
            });
        }
        
        // Add custom tabs
        for (const [tabId, config] of Object.entries(layout.tabs)) {
            if (config?.isCustom) {
                tabs.push({
                    id: tabId,
                    label: config.label || 'Custom Tab',
                    isBuiltIn: false,
                });
            }
        }
        
        // Sort by order
        tabs.sort((a, b) => {
            const orderA = layout.tabs[a.id]?.order ?? 999;
            const orderB = layout.tabs[b.id]?.order ?? 999;
            return orderA - orderB;
        });
        
        return tabs;
    }, [layout.tabs]);

    // Convert layout to draggable items per tab
    const tabFields = useMemo(() => {
        const result: Record<string, DraggableFieldItem[]> = {};

        for (const tab of allTabs) {
            const fields = layout.fields[tab.id] ?? [];
            result[tab.id] = fields.map(field => {
                if (field.type === 'standard') {
                    const meta = getStandardFieldMeta(field.id as any);
                    return {
                        uniqueId: createFieldUniqueId(field),
                        field,
                        label: meta?.label ?? String(field.id),
                        icon: meta?.icon,
                        isCustom: false,
                    };
                } else {
                    const customField = customFieldsMap.get(field.id as number);
                    return {
                        uniqueId: createFieldUniqueId(field),
                        field,
                        label: customField?.name ?? `Custom Field #${field.id}`,
                        isCustom: true,
                    };
                }
            });
        }

        return result;
    }, [layout, allTabs, customFieldsMap]);

    // Find which tab a field is currently in
    const findFieldTab = useCallback((uniqueId: string): string | null => {
        for (const tabId of Object.keys(tabFields)) {
            if (tabFields[tabId].some(f => f.uniqueId === uniqueId)) {
                return tabId;
            }
        }
        return null;
    }, [tabFields]);

    // Get the active item for drag overlay
    const activeItem = useMemo(() => {
        if (!activeId) return null;
        for (const fields of Object.values(tabFields)) {
            const item = fields.find(f => f.uniqueId === activeId);
            if (item) return item;
        }
        return null;
    }, [activeId, tabFields]);

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Update layout and notify parent
    const updateLayout = useCallback((newLayout: DialogLayout) => {
        setLayout(newLayout);
        onChange(newLayout);
    }, [onChange]);

    // Handle drag start
    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    }, []);

    // Handle drag over (for cross-container movement)
    const handleDragOver = useCallback((event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        const activeTab = findFieldTab(activeId);
        
        // Check if we're over a tab container or another item
        const isOverTab = allTabs.some(t => t.id === overId);
        const overTab = isOverTab ? overId : findFieldTab(overId);

        if (!activeTab || !overTab || activeTab === overTab) return;

        // Move item from one tab to another
        setLayout(prev => {
            const newLayout = { ...prev };
            newLayout.fields = { ...prev.fields };

            // Get current fields for both tabs
            const activeFields = [...(prev.fields[activeTab] ?? [])];
            const overFields = [...(prev.fields[overTab] ?? [])];

            // Find and remove the active item from its current tab
            const activeIndex = activeFields.findIndex(f => createFieldUniqueId(f) === activeId);
            if (activeIndex === -1) return prev;

            const [movedField] = activeFields.splice(activeIndex, 1);

            // Add to the new tab
            if (isOverTab) {
                // Dropped directly on tab, add at end
                overFields.push(movedField);
            } else {
                // Dropped on another item, insert near it
                const overIndex = overFields.findIndex(f => createFieldUniqueId(f) === overId);
                if (overIndex >= 0) {
                    overFields.splice(overIndex, 0, movedField);
                } else {
                    overFields.push(movedField);
                }
            }

            newLayout.fields[activeTab] = activeFields;
            newLayout.fields[overTab] = overFields;

            return newLayout;
        });
    }, [findFieldTab, allTabs]);

    // Handle drag end
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        if (activeId === overId) return;

        const activeTab = findFieldTab(activeId);
        const overTab = allTabs.some(t => t.id === overId) 
            ? overId 
            : findFieldTab(overId);

        if (!activeTab || !overTab) return;

        if (activeTab === overTab) {
            // Reorder within the same tab
            const newLayout = { ...layout };
            newLayout.fields = { ...layout.fields };

            const fields = [...(layout.fields[activeTab] ?? [])];
            const oldIndex = fields.findIndex(f => createFieldUniqueId(f) === activeId);
            const newIndex = fields.findIndex(f => createFieldUniqueId(f) === overId);

            if (oldIndex !== -1 && newIndex !== -1) {
                newLayout.fields[activeTab] = arrayMove(fields, oldIndex, newIndex);
                updateLayout(newLayout);
            }
        } else {
            // Cross-tab movement already handled in dragOver, just save
            updateLayout(layout);
        }
    }, [findFieldTab, layout, updateLayout, allTabs]);

    // Toggle tab enabled
    const handleToggleTab = useCallback((tabId: string, enabled: boolean) => {
        const newLayout = { ...layout };
        newLayout.tabs = { ...layout.tabs };
        newLayout.tabs[tabId] = {
            ...(layout.tabs[tabId] ?? { order: 0 }),
            enabled,
        };
        updateLayout(newLayout);
    }, [layout, updateLayout]);

    // Remove field from current tab (moves to unassigned)
    const handleRemoveField = useCallback((uniqueId: string) => {
        const tabId = findFieldTab(uniqueId);
        if (!tabId) return;

        const newLayout = { ...layout };
        newLayout.fields = { ...layout.fields };
        newLayout.fields[tabId] = (layout.fields[tabId] ?? []).filter(
            f => createFieldUniqueId(f) !== uniqueId
        );
        updateLayout(newLayout);
    }, [findFieldTab, layout, updateLayout]);

    // Get unassigned fields (fields that are not in any tab)
    const unassignedFields = useMemo(() => {
        const assignedUniqueIds = new Set<string>();
        for (const fields of Object.values(tabFields)) {
            for (const field of fields) {
                assignedUniqueIds.add(field.uniqueId);
            }
        }

        const unassigned: DraggableFieldItem[] = [];

        // Check standard fields
        for (const meta of STANDARD_FIELDS) {
            const uniqueId = `standard-${meta.id}`;
            if (!assignedUniqueIds.has(uniqueId)) {
                unassigned.push({
                    uniqueId,
                    field: { type: 'standard', id: meta.id },
                    label: meta.label,
                    icon: meta.icon,
                    isCustom: false,
                });
            }
        }

        // Check custom fields
        for (const assignment of assignedCustomFields) {
            const uniqueId = `custom-${assignment.field_id}`;
            if (!assignedUniqueIds.has(uniqueId)) {
                const customField = customFieldsMap.get(assignment.field_id);
                unassigned.push({
                    uniqueId,
                    field: { type: 'custom', id: assignment.field_id },
                    label: customField?.name ?? `Custom Field #${assignment.field_id}`,
                    isCustom: true,
                });
            }
        }

        return unassigned;
    }, [tabFields, assignedCustomFields, customFieldsMap]);

    // Add field to a tab
    const handleAddField = useCallback((uniqueId: string, tabId: string) => {
        const field = unassignedFields.find(f => f.uniqueId === uniqueId);
        if (!field) return;

        const newLayout = { ...layout };
        newLayout.fields = { ...layout.fields };
        newLayout.fields[tabId] = [...(layout.fields[tabId] ?? []), field.field];
        updateLayout(newLayout);
    }, [unassignedFields, layout, updateLayout]);

    // Reset to default layout
    const handleReset = useCallback(() => {
        const defaultLayout = createDefaultLayout();
        // Add custom fields to basic tab
        for (const assignment of assignedCustomFields) {
            defaultLayout.fields.basic?.push({ type: 'custom', id: assignment.field_id });
        }
        updateLayout(defaultLayout);
    }, [assignedCustomFields, updateLayout]);

    // Add a new custom tab
    const handleAddTab = useCallback(() => {
        setEditingTabId(null);
        setTabName('');
        setTabDialogOpen(true);
    }, []);

    // Edit tab name
    const handleEditTab = useCallback((tabId: string) => {
        const tab = layout.tabs[tabId];
        setEditingTabId(tabId);
        setTabName(tab?.label || '');
        setTabDialogOpen(true);
    }, [layout.tabs]);

    // Save tab (create or update)
    const handleSaveTab = useCallback(() => {
        if (!tabName.trim()) return;

        const newLayout = { ...layout };
        newLayout.tabs = { ...layout.tabs };
        newLayout.fields = { ...layout.fields };

        if (editingTabId) {
            // Update existing tab
            newLayout.tabs[editingTabId] = {
                ...newLayout.tabs[editingTabId],
                label: tabName.trim(),
            };
        } else {
            // Create new tab
            const newTabId = generateCustomTabId();
            const maxOrder = Math.max(
                ...Object.values(newLayout.tabs)
                    .filter((t): t is DialogTabConfig => t !== undefined)
                    .map(t => t.order ?? 0),
                -1
            );
            
            newLayout.tabs[newTabId] = {
                enabled: true,
                order: maxOrder + 1,
                label: tabName.trim(),
                isCustom: true,
            };
            newLayout.fields[newTabId] = [];
        }

        updateLayout(newLayout);
        setTabDialogOpen(false);
        setEditingTabId(null);
        setTabName('');
    }, [editingTabId, tabName, layout, updateLayout]);

    // Delete custom tab
    const handleDeleteTab = useCallback((tabId: string) => {
        const tab = layout.tabs[tabId];
        if (!tab?.isCustom) return; // Can't delete built-in tabs

        const newLayout = { ...layout };
        newLayout.tabs = { ...layout.tabs };
        newLayout.fields = { ...layout.fields };

        // Move fields from deleted tab to basic tab
        const fieldsToMove = layout.fields[tabId] ?? [];
        newLayout.fields['basic'] = [...(newLayout.fields['basic'] ?? []), ...fieldsToMove];

        // Delete the tab
        delete newLayout.tabs[tabId];
        delete newLayout.fields[tabId];

        updateLayout(newLayout);
    }, [layout, updateLayout]);

    return (
        <div className="space-y-4">
            {/* Header with actions */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-muted-foreground">
                    Drag fields between tabs to customize the task dialog layout.
                </p>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddTab}
                        className="gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Add Tab
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        className="gap-2"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Reset
                    </Button>
                </div>
            </div>

            {/* Unassigned Fields */}
            {unassignedFields.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                        Hidden Fields ({unassignedFields.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {unassignedFields.map(field => (
                            <div
                                key={field.uniqueId}
                                className="flex items-center gap-1 px-2 py-1 bg-background border rounded text-sm"
                            >
                                <span>{field.label}</span>
                                <Select
                                    value=""
                                    onValueChange={(tabId) => handleAddField(field.uniqueId, tabId)}
                                >
                                    <SelectTrigger className="h-6 w-6 p-0 border-0">
                                        <Plus className="h-4 w-4" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {allTabs.map(tab => (
                                            <SelectItem key={tab.id} value={tab.id}>
                                                Add to {tab.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tab Columns */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <ScrollArea className="w-full">
                    <div className="flex gap-4 pb-4">
                        {allTabs.map(tab => (
                            <TabColumn
                                key={tab.id}
                                tab={tab}
                                fields={tabFields[tab.id] || []}
                                enabled={layout.tabs[tab.id]?.enabled !== false}
                                onToggleEnabled={handleToggleTab}
                                onRemoveField={handleRemoveField}
                                onEditTab={handleEditTab}
                                onDeleteTab={tab.isBuiltIn ? undefined : handleDeleteTab}
                                requiredFieldIds={requiredFieldIds}
                            />
                        ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>

                <DragOverlay>
                    {activeItem && (
                        <FieldItem
                            item={activeItem}
                            isRequired={
                                activeItem.field.type === 'custom' &&
                                typeof activeItem.field.id === 'number' &&
                                requiredFieldIds.has(activeItem.field.id)
                            }
                        />
                    )}
                </DragOverlay>
            </DndContext>

            {/* Info */}
            <div className="text-xs text-muted-foreground space-y-1">
                <p>• Drag fields to reorder or move between tabs</p>
                <p>• Custom fields are marked with a blue indicator</p>
                <p>• Required fields are marked with an asterisk (*)</p>
                <p>• Click the pencil icon to rename a tab</p>
                <p>• The Basic tab cannot be disabled or deleted</p>
                <p className="text-amber-600 dark:text-amber-400">
                    • Note: When creating tasks from the scheduler, date fields automatically appear in Basic Details
                </p>
            </div>

            {/* Add/Edit Tab Dialog */}
            <Dialog open={tabDialogOpen} onOpenChange={setTabDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingTabId ? 'Edit Tab' : 'Add Custom Tab'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingTabId 
                                ? 'Change the name of this tab.'
                                : 'Create a new custom tab for organizing fields.'
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={tabName}
                            onChange={(e) => setTabName(e.target.value)}
                            placeholder="Tab name..."
                            className="w-full"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveTab();
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTabDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveTab} disabled={!tabName.trim()}>
                            {editingTabId ? 'Save' : 'Add Tab'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
