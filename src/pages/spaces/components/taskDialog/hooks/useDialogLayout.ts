import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import type { 
    DialogLayout, 
    DialogFieldConfig, 
    DialogTabId, 
    Category, 
    CategoryCustomField, 
    CustomField 
} from '@/store/types';
import { 
    DEFAULT_DIALOG_LAYOUT, 
    getEffectiveLayout, 
    getSortedTabs, 
    getFieldsForTab 
} from '@/components/dialogLayout';
import { BUILT_IN_TABS, STANDARD_FIELDS, getStandardFieldMeta, type DraggableFieldItem, createFieldUniqueId, type TabMeta } from '@/components/dialogLayout/types';

export interface UseDialogLayoutOptions {
    categoryId: number | null;
    /**
     * When true (creating from scheduler), date fields are moved to basic tab
     * and the dates tab is hidden.
     */
    isFromScheduler?: boolean;
}

export interface DialogLayoutResult {
    // The computed effective layout
    layout: DialogLayout;
    
    // Sorted tabs (enabled only, sorted by order) with metadata
    tabs: TabMeta[];
    
    // Sorted tab IDs (for backward compatibility)
    tabIds: DialogTabId[];
    
    // Get fields for a specific tab
    getFieldsForTab: (tabId: DialogTabId) => DialogFieldConfig[];
    
    // Get enriched field items for a tab (with metadata)
    getEnrichedFieldsForTab: (tabId: DialogTabId) => EnrichedFieldItem[];
    
    // Check if a tab is enabled
    isTabEnabled: (tabId: DialogTabId) => boolean;
    
    // Get tab label
    getTabLabel: (tabId: DialogTabId) => string;
    
    // Custom fields assigned to this category
    categoryCustomFields: CategoryCustomField[];
    
    // Map of custom field ID to custom field object
    customFieldsMap: Map<number, CustomField>;
    
    // Required custom field IDs
    requiredFieldIds: Set<number>;
    
    // Whether the category has a custom layout
    hasCustomLayout: boolean;
}

export interface EnrichedFieldItem {
    field: DialogFieldConfig;
    label: string;
    isCustom: boolean;
    isRequired: boolean;
    customField?: CustomField;
    customFieldAssignment?: CategoryCustomField;
}

// Date-related field IDs that should move to basic tab when isFromScheduler
const DATE_FIELD_IDS = ['start_date', 'due_date', 'recurrence'];

/**
 * Hook to compute effective dialog layout for a category.
 * 
 * This hook:
 * 1. Gets the category's custom layout (if any)
 * 2. Merges in any custom fields assigned to the category
 * 3. Handles scheduler mode by moving date fields to basic tab
 * 4. Provides helpers to access tabs and fields
 * 
 * @param options - Options including categoryId and isFromScheduler
 * @returns DialogLayoutResult with layout data and helpers
 */
export function useDialogLayout({ categoryId, isFromScheduler = false }: UseDialogLayoutOptions): DialogLayoutResult {
    // Get categories from Redux
    const categories = useSelector((state: RootState) => state.categories.value);
    const categoryCustomFieldsAll = useSelector((state: RootState) => state.categoryCustomFields.value);
    const customFields = useSelector((state: RootState) => state.customFields.value);
    
    // Get the current category
    const category = useMemo(() => {
        if (!categoryId) return null;
        return categories.find(c => c.id === categoryId) || null;
    }, [categories, categoryId]);
    
    // Filter custom field assignments for this category
    const categoryCustomFields = useMemo(() => {
        if (!categoryId) return [];
        return categoryCustomFieldsAll.filter(cf => cf.category_id === categoryId);
    }, [categoryCustomFieldsAll, categoryId]);
    
    // Create a map of custom fields for quick lookup
    const customFieldsMap = useMemo(() => {
        return new Map(customFields.map(cf => [cf.id, cf]));
    }, [customFields]);
    
    // Get required field IDs
    const requiredFieldIds = useMemo(() => {
        return new Set(
            categoryCustomFields
                .filter(a => a.is_required)
                .map(a => a.field_id)
        );
    }, [categoryCustomFields]);
    
    // Compute effective layout
    const layout = useMemo(() => {
        const baseLayout = getEffectiveLayout(
            category?.dialog_layout ?? null,
            categoryCustomFields,
            customFieldsMap
        );
        
        // When creating from scheduler, move date fields to basic tab and hide dates tab
        if (isFromScheduler) {
            const modifiedLayout = { ...baseLayout };
            modifiedLayout.tabs = { ...baseLayout.tabs };
            modifiedLayout.fields = { ...baseLayout.fields };
            
            // Disable the dates tab
            if (modifiedLayout.tabs.dates) {
                modifiedLayout.tabs.dates = { ...modifiedLayout.tabs.dates, enabled: false };
            }
            
            // Find and remove date fields from all tabs, then add to basic
            const dateFieldsToMove: DialogFieldConfig[] = [];
            
            for (const tabId of Object.keys(modifiedLayout.fields)) {
                const fields = modifiedLayout.fields[tabId];
                if (!fields) continue;
                
                // Separate date fields from other fields
                const nonDateFields: DialogFieldConfig[] = [];
                for (const field of fields) {
                    if (field.type === 'standard' && DATE_FIELD_IDS.includes(field.id as string)) {
                        dateFieldsToMove.push(field);
                    } else {
                        nonDateFields.push(field);
                    }
                }
                
                modifiedLayout.fields[tabId] = nonDateFields;
            }
            
            // Add date fields to the end of basic tab (after other fields)
            modifiedLayout.fields.basic = [
                ...(modifiedLayout.fields.basic ?? []),
                ...dateFieldsToMove,
            ];
            
            return modifiedLayout;
        }
        
        return baseLayout;
    }, [category?.dialog_layout, categoryCustomFields, customFieldsMap, isFromScheduler]);
    
    // Get sorted tabs with metadata
    const tabs = useMemo((): TabMeta[] => {
        const result: TabMeta[] = [];
        
        // Collect all tabs from the layout
        for (const [tabId, config] of Object.entries(layout.tabs)) {
            if (!config || config.enabled === false) continue;
            
            // Check if it's a built-in tab
            const builtIn = BUILT_IN_TABS.find(t => t.id === tabId);
            
            result.push({
                id: tabId,
                label: config.label || builtIn?.label || tabId,
                icon: builtIn?.icon,
                isBuiltIn: !config.isCustom,
            });
        }
        
        // Sort by order
        result.sort((a, b) => {
            const orderA = layout.tabs[a.id]?.order ?? 999;
            const orderB = layout.tabs[b.id]?.order ?? 999;
            return orderA - orderB;
        });
        
        // Ensure at least basic tab is present
        if (result.length === 0) {
            const basicBuiltIn = BUILT_IN_TABS.find(t => t.id === 'basic')!;
            result.push({
                id: 'basic',
                label: basicBuiltIn.label,
                icon: basicBuiltIn.icon,
                isBuiltIn: true,
            });
        }
        
        return result;
    }, [layout]);
    
    // Tab IDs for backward compatibility
    const tabIds = useMemo(() => {
        return tabs.map(t => t.id);
    }, [tabs]);
    
    // Check if category has a custom layout
    const hasCustomLayout = useMemo(() => {
        return category?.dialog_layout != null;
    }, [category?.dialog_layout]);
    
    // Helper to get fields for a tab
    const getFieldsForTabFn = useMemo(() => {
        return (tabId: DialogTabId): DialogFieldConfig[] => {
            return getFieldsForTab(layout, tabId);
        };
    }, [layout]);
    
    // Helper to check if tab is enabled
    const isTabEnabled = useMemo(() => {
        return (tabId: DialogTabId): boolean => {
            return layout.tabs[tabId]?.enabled !== false;
        };
    }, [layout]);
    
    // Helper to get tab label
    const getTabLabel = useMemo(() => {
        return (tabId: DialogTabId): string => {
            const config = layout.tabs[tabId];
            if (config?.label) return config.label;
            
            const builtIn = BUILT_IN_TABS.find(t => t.id === tabId);
            return builtIn?.label || tabId;
        };
    }, [layout]);
    
    // Helper to get enriched field items for a tab
    const getEnrichedFieldsForTab = useMemo(() => {
        return (tabId: DialogTabId): EnrichedFieldItem[] => {
            const fields = getFieldsForTab(layout, tabId);
            
            return fields.map(field => {
                if (field.type === 'custom') {
                    const customField = customFieldsMap.get(field.id as number);
                    const assignment = categoryCustomFields.find(
                        a => a.field_id === field.id
                    );
                    
                    return {
                        field,
                        label: customField?.name ?? `Custom Field #${field.id}`,
                        isCustom: true,
                        isRequired: assignment?.is_required ?? false,
                        customField,
                        customFieldAssignment: assignment,
                    };
                } else {
                    const meta = getStandardFieldMeta(field.id as any);
                    return {
                        field,
                        label: meta?.label ?? String(field.id),
                        isCustom: false,
                        isRequired: false, // Standard fields don't have required flag in this context
                    };
                }
            });
        };
    }, [layout, customFieldsMap, categoryCustomFields]);
    
    return {
        layout,
        tabs,
        tabIds,
        getFieldsForTab: getFieldsForTabFn,
        getEnrichedFieldsForTab,
        isTabEnabled,
        getTabLabel,
        categoryCustomFields,
        customFieldsMap,
        requiredFieldIds,
        hasCustomLayout,
    };
}

export default useDialogLayout;
