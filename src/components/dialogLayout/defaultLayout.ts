import type { DialogLayout, DialogFieldConfig, DialogTabId, DialogTabConfig } from '@/store/types';
import type { CategoryCustomField, CustomField } from '@/store/types';
import { STANDARD_FIELDS, BUILT_IN_TABS } from './types';

/**
 * Default dialog layout configuration.
 * Used when a category has no custom layout.
 */
export const DEFAULT_DIALOG_LAYOUT: DialogLayout = {
    tabs: {
        basic: { enabled: true, order: 0, label: 'Basic Details', isCustom: false },
        dates: { enabled: true, order: 1, label: 'Date & Timing', isCustom: false },
        additional: { enabled: true, order: 2, label: 'Additional Info', isCustom: false },
    },
    fields: {
        basic: [
            { type: 'standard', id: 'template' },
            { type: 'standard', id: 'description' },
            { type: 'standard', id: 'spot' },
            { type: 'standard', id: 'responsible' },
            { type: 'standard', id: 'priority' },
            { type: 'standard', id: 'tags' },
        ],
        dates: [
            { type: 'standard', id: 'start_date' },
            { type: 'standard', id: 'due_date' },
            { type: 'standard', id: 'recurrence' },
        ],
        additional: [
            { type: 'standard', id: 'sla' },
            { type: 'standard', id: 'approval' },
        ],
    },
};

/**
 * Get the effective layout for a category, merging custom fields with layout.
 * If no layout is set, returns default layout with custom fields added.
 */
export function getEffectiveLayout(
    categoryLayout: DialogLayout | null | undefined,
    categoryCustomFields: CategoryCustomField[],
    customFieldsMap: Map<number, CustomField>
): DialogLayout {
    // Start with the category's layout or the default
    const baseLayout = categoryLayout ?? { ...DEFAULT_DIALOG_LAYOUT };
    
    // Ensure all tabs exist
    const layout: DialogLayout = {
        tabs: {
            basic: baseLayout.tabs?.basic ?? { enabled: true, order: 0 },
            dates: baseLayout.tabs?.dates ?? { enabled: true, order: 1 },
            additional: baseLayout.tabs?.additional ?? { enabled: true, order: 2 },
        },
        fields: {
            basic: [...(baseLayout.fields?.basic ?? DEFAULT_DIALOG_LAYOUT.fields.basic ?? [])],
            dates: [...(baseLayout.fields?.dates ?? DEFAULT_DIALOG_LAYOUT.fields.dates ?? [])],
            additional: [...(baseLayout.fields?.additional ?? DEFAULT_DIALOG_LAYOUT.fields.additional ?? [])],
        },
    };

    // Get all custom field IDs currently in the layout
    const customFieldIdsInLayout = new Set<number>();
    for (const tabId of Object.keys(layout.fields) as DialogTabId[]) {
        const fields = layout.fields[tabId] ?? [];
        for (const field of fields) {
            if (field.type === 'custom' && typeof field.id === 'number') {
                customFieldIdsInLayout.add(field.id);
            }
        }
    }

    // Sort category custom fields by order
    const sortedAssignments = [...categoryCustomFields].sort((a, b) => 
        (a.order ?? 0) - (b.order ?? 0)
    );

    // Add any missing custom fields to the 'basic' tab (or wherever makes sense)
    // These are custom fields assigned to the category but not yet in the layout
    for (const assignment of sortedAssignments) {
        if (!customFieldIdsInLayout.has(assignment.field_id)) {
            // Field not in layout, add it to basic tab by default
            if (!layout.fields.basic) {
                layout.fields.basic = [];
            }
            layout.fields.basic.push({ type: 'custom', id: assignment.field_id });
            customFieldIdsInLayout.add(assignment.field_id);
        }
    }

    // Remove custom fields from layout that are no longer assigned to the category
    const assignedFieldIds = new Set(categoryCustomFields.map(a => a.field_id));
    for (const tabId of Object.keys(layout.fields) as DialogTabId[]) {
        const fields = layout.fields[tabId];
        if (fields) {
            layout.fields[tabId] = fields.filter(field => {
                if (field.type === 'custom' && typeof field.id === 'number') {
                    return assignedFieldIds.has(field.id);
                }
                return true; // Keep standard fields
            });
        }
    }

    return layout;
}

/**
 * Create an empty layout with all standard fields in their default positions.
 * Used as a starting point when creating a new custom layout.
 */
export function createDefaultLayout(): DialogLayout {
    return JSON.parse(JSON.stringify(DEFAULT_DIALOG_LAYOUT));
}

/**
 * Check if a layout differs from the default.
 */
export function isCustomLayout(layout: DialogLayout | null | undefined): boolean {
    if (!layout) return false;
    return JSON.stringify(layout) !== JSON.stringify(DEFAULT_DIALOG_LAYOUT);
}

/**
 * Get fields for a specific tab, sorted by their order in the layout.
 */
export function getFieldsForTab(
    layout: DialogLayout,
    tabId: DialogTabId
): DialogFieldConfig[] {
    return layout.fields[tabId] ?? [];
}

/**
 * Get enabled tabs sorted by order.
 */
export function getSortedTabs(layout: DialogLayout): DialogTabId[] {
    const tabs = Object.entries(layout.tabs ?? {})
        .filter(([_, config]) => config?.enabled !== false)
        .sort((a, b) => (a[1]?.order ?? 0) - (b[1]?.order ?? 0))
        .map(([id]) => id as DialogTabId);
    
    // Ensure at least basic tab is present
    if (tabs.length === 0) {
        return ['basic'];
    }
    
    return tabs;
}
