import { useMemo } from 'react';
import { useDialogLayout, type EnrichedFieldItem } from '../hooks/useDialogLayout';
import { DynamicFieldRenderer, type FieldRendererProps } from './fields';
import type { DialogTabId, DialogFieldConfig } from '@/store/types';

interface DynamicTabContentProps {
    // Tab to render
    tabId: DialogTabId;
    
    // Category ID for layout lookup
    categoryId: number | null;
    
    // Mode
    mode: 'create' | 'edit' | 'create-all';
    
    // All the field props (passed through to DynamicFieldRenderer)
    // Template/Category props
    templateId: number | null;
    setTemplateId: (id: number | null) => void;
    setCategoryId: (id: number | null) => void;
    workspaceTemplates: any[];
    workspaceCategories: any[];
    categories: any[];
    currentWorkspace: any;
    
    // Description props
    showDescription: boolean;
    setShowDescription: (show: boolean) => void;
    description: string;
    setDescription: (desc: string) => void;
    
    // Spot props
    spotsApplicable: boolean;
    selectedTemplate: any;
    workspaceSpots: any[];
    spotId: number | null;
    setSpotId: (id: number | null) => void;
    
    // Responsible users props
    workspaceUsers: any[];
    selectedUserIds: number[];
    setSelectedUserIds: (ids: number[]) => void;
    
    // Priority props
    categoryPriorities: any[];
    priorityId: number | null;
    setPriorityId: (id: number | null) => void;
    
    // Tags props
    tags: any[];
    selectedTagIds: number[];
    setSelectedTagIds: (ids: number[]) => void;
    
    // Date/time props
    startDate: string;
    setStartDate: (date: string) => void;
    startTime: string;
    setStartTime: (time: string) => void;
    dueDate: string;
    setDueDate: (date: string) => void;
    dueTime: string;
    setDueTime: (time: string) => void;
    
    // Recurrence props
    recurrenceSettings: any;
    setRecurrenceSettings: (settings: any) => void;
    isExistingRecurringTask: boolean;
    
    // SLA/Approval props
    slas: any[];
    slaId: number | null;
    setSlaId: (id: number | null) => void;
    approvals: any[];
    approvalId: number | null;
    setApprovalId: (id: number | null) => void;
    
    // Custom field values and handler
    customFieldValues: Record<number, any>;
    onCustomFieldChange: (fieldId: number, value: any) => void;
}

/**
 * DynamicTabContent renders fields for a specific tab based on the category's dialog layout.
 * 
 * When a category has a custom dialog_layout, this component renders fields in the order
 * specified by the layout. Otherwise, it falls back to showing nothing (the regular tabs
 * will handle rendering).
 */
export function DynamicTabContent(props: DynamicTabContentProps) {
    const { tabId, categoryId, customFieldValues, onCustomFieldChange } = props;
    
    // Get the layout for this category
    const { 
        layout, 
        getEnrichedFieldsForTab, 
        isTabEnabled, 
        hasCustomLayout,
        customFieldsMap,
        categoryCustomFields 
    } = useDialogLayout({ categoryId });
    
    // Get enriched fields for this tab
    const fields = useMemo(() => {
        return getEnrichedFieldsForTab(tabId);
    }, [getEnrichedFieldsForTab, tabId]);
    
    // If no custom layout or tab is disabled, render nothing
    // (the regular tabs will handle rendering)
    if (!hasCustomLayout || !isTabEnabled(tabId)) {
        return null;
    }
    
    // Build props for the field renderer
    const fieldRendererProps: Omit<FieldRendererProps, 'field' | 'customField' | 'customFieldAssignment' | 'customFieldValue' | 'onCustomFieldChange'> = {
        mode: props.mode,
        templateId: props.templateId,
        setTemplateId: props.setTemplateId,
        categoryId: props.categoryId,
        setCategoryId: props.setCategoryId,
        workspaceTemplates: props.workspaceTemplates,
        workspaceCategories: props.workspaceCategories,
        categories: props.categories,
        currentWorkspace: props.currentWorkspace,
        showDescription: props.showDescription,
        setShowDescription: props.setShowDescription,
        description: props.description,
        setDescription: props.setDescription,
        spotsApplicable: props.spotsApplicable,
        selectedTemplate: props.selectedTemplate,
        workspaceSpots: props.workspaceSpots,
        spotId: props.spotId,
        setSpotId: props.setSpotId,
        workspaceUsers: props.workspaceUsers,
        selectedUserIds: props.selectedUserIds,
        setSelectedUserIds: props.setSelectedUserIds,
        categoryPriorities: props.categoryPriorities,
        priorityId: props.priorityId,
        setPriorityId: props.setPriorityId,
        tags: props.tags,
        selectedTagIds: props.selectedTagIds,
        setSelectedTagIds: props.setSelectedTagIds,
        startDate: props.startDate,
        setStartDate: props.setStartDate,
        startTime: props.startTime,
        setStartTime: props.setStartTime,
        dueDate: props.dueDate,
        setDueDate: props.setDueDate,
        dueTime: props.dueTime,
        setDueTime: props.setDueTime,
        recurrenceSettings: props.recurrenceSettings,
        setRecurrenceSettings: props.setRecurrenceSettings,
        isExistingRecurringTask: props.isExistingRecurringTask,
        slas: props.slas,
        slaId: props.slaId,
        setSlaId: props.setSlaId,
        approvals: props.approvals,
        approvalId: props.approvalId,
        setApprovalId: props.setApprovalId,
    };
    
    return (
        <div className="space-y-4 pb-2">
            {fields.map((enrichedField, index) => {
                const { field, customField, customFieldAssignment } = enrichedField;
                
                // Get custom field value if this is a custom field
                const customFieldValue = field.type === 'custom' 
                    ? customFieldValues[field.id as number] 
                    : undefined;
                
                return (
                    <DynamicFieldRenderer
                        key={`${field.type}-${field.id}-${index}`}
                        field={field}
                        {...fieldRendererProps}
                        customField={customField}
                        customFieldAssignment={customFieldAssignment}
                        customFieldValue={customFieldValue}
                        onCustomFieldChange={onCustomFieldChange}
                    />
                );
            })}
        </div>
    );
}

export default DynamicTabContent;
