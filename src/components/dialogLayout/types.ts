import type { DialogLayout, DialogFieldConfig, DialogTabId, StandardFieldId, BuiltInTabId } from '@/store/types';

// Standard field metadata for display in the editor
export interface StandardFieldMeta {
    id: StandardFieldId;
    label: string;
    defaultTab: BuiltInTabId;
    icon?: string;
}

// All available standard fields
export const STANDARD_FIELDS: StandardFieldMeta[] = [
    // Basic tab fields
    { id: 'template', label: 'Template/Category', defaultTab: 'basic', icon: 'file-text' },
    { id: 'description', label: 'Description', defaultTab: 'basic', icon: 'align-left' },
    { id: 'spot', label: 'Location/Spot', defaultTab: 'basic', icon: 'map-pin' },
    { id: 'responsible', label: 'Responsible Users', defaultTab: 'basic', icon: 'users' },
    { id: 'priority', label: 'Priority', defaultTab: 'basic', icon: 'flag' },
    { id: 'tags', label: 'Tags', defaultTab: 'basic', icon: 'tag' },
    // Dates tab fields
    { id: 'start_date', label: 'Start Date & Time', defaultTab: 'dates', icon: 'calendar' },
    { id: 'due_date', label: 'Due Date & Time', defaultTab: 'dates', icon: 'calendar-check' },
    { id: 'recurrence', label: 'Recurrence', defaultTab: 'dates', icon: 'repeat' },
    // Additional tab fields
    { id: 'sla', label: 'SLA', defaultTab: 'additional', icon: 'clock' },
    { id: 'approval', label: 'Approval', defaultTab: 'additional', icon: 'check-circle' },
];

// Tab metadata for display
export interface TabMeta {
    id: DialogTabId;
    label: string;
    icon?: string;
    isBuiltIn: boolean;
}

// Built-in tabs that cannot be deleted
export const BUILT_IN_TABS: TabMeta[] = [
    { id: 'basic', label: 'Basic Details', icon: 'file-text', isBuiltIn: true },
    { id: 'dates', label: 'Date & Timing', icon: 'calendar', isBuiltIn: true },
    { id: 'additional', label: 'Additional Info', icon: 'info', isBuiltIn: true },
];

// For backward compatibility
export const TABS = BUILT_IN_TABS;

// Generate a unique ID for a new custom tab
export function generateCustomTabId(): string {
    return `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper to get standard field metadata by ID
export function getStandardFieldMeta(id: StandardFieldId): StandardFieldMeta | undefined {
    return STANDARD_FIELDS.find(f => f.id === id);
}

// Helper to get tab metadata by ID
export function getTabMeta(id: DialogTabId): TabMeta | undefined {
    return TABS.find(t => t.id === id);
}

// Draggable item type for dnd-kit
export interface DraggableFieldItem {
    uniqueId: string; // Unique ID for dnd-kit (e.g., "standard-template" or "custom-5")
    field: DialogFieldConfig;
    label: string;
    icon?: string;
    isCustom: boolean;
}

// Create unique ID for a field
export function createFieldUniqueId(field: DialogFieldConfig): string {
    return `${field.type}-${field.id}`;
}

// Parse unique ID back to field config
export function parseFieldUniqueId(uniqueId: string): DialogFieldConfig | null {
    const [type, ...idParts] = uniqueId.split('-');
    const id = idParts.join('-');
    if (type === 'standard') {
        return { type: 'standard', id: id as StandardFieldId };
    } else if (type === 'custom') {
        const numId = parseInt(id, 10);
        if (!isNaN(numId)) {
            return { type: 'custom', id: numId };
        }
    }
    return null;
}
