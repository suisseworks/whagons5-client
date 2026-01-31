import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { TagMultiSelect } from '@/components/ui/tag-multi-select';
import { Switch } from '@/components/ui/switch';
import { RecurrenceEditor } from '@/components/recurrence/RecurrenceEditor';
import { RefreshCw, AlertCircle, ChevronUp, Plus } from 'lucide-react';
import { useLanguage } from '@/providers/LanguageProvider';
import type { StandardFieldId, DialogFieldConfig } from '@/store/types';
import { CustomFieldInput } from '../CustomFieldInput';

export interface FieldRendererProps {
    // Field configuration
    field: DialogFieldConfig;
    
    // Mode and state
    mode: 'create' | 'edit' | 'create-all';
    
    // Scheduler mode - when true, date fields are shown in basic tab
    isFromScheduler?: boolean;
    
    // Template/Category props
    templateId: number | null;
    setTemplateId: (id: number | null) => void;
    categoryId: number | null;
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
    
    // Custom field props (for custom field rendering)
    customField?: any;
    customFieldAssignment?: any;
    customFieldValue?: any;
    onCustomFieldChange?: (fieldId: number, value: any) => void;
}

/**
 * DynamicFieldRenderer renders a single field based on its configuration.
 * This component handles both standard fields and custom fields.
 */
export function DynamicFieldRenderer(props: FieldRendererProps) {
    const { t } = useLanguage();
    const { field } = props;
    
    // Handle custom fields
    if (field.type === 'custom') {
        if (!props.customField || !props.customFieldAssignment) {
            return null;
        }
        
        return (
            <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium font-[500] text-foreground">
                    {props.customField.name}
                    {props.customFieldAssignment.is_required && (
                        <span className="text-destructive ml-1">*</span>
                    )}
                </Label>
                <CustomFieldInput
                    field={props.customField}
                    value={props.customFieldValue}
                    onChange={(value) => props.onCustomFieldChange?.(props.customField.id, value)}
                />
            </div>
        );
    }
    
    // Handle standard fields
    const standardFieldId = field.id as StandardFieldId;
    
    switch (standardFieldId) {
        case 'template':
            return <TemplateField {...props} />;
        case 'description':
            return <DescriptionField {...props} />;
        case 'spot':
            return <SpotField {...props} />;
        case 'responsible':
            return <ResponsibleField {...props} />;
        case 'priority':
            return <PriorityField {...props} />;
        case 'tags':
            return <TagsField {...props} />;
        case 'start_date':
            return <StartDateField {...props} />;
        case 'due_date':
            return <DueDateField {...props} />;
        case 'recurrence':
            return <RecurrenceField {...props} />;
        case 'sla':
            return <SlaField {...props} />;
        case 'approval':
            return <ApprovalField {...props} />;
        default:
            return null;
    }
}

// Template/Category field
function TemplateField(props: FieldRendererProps) {
    const { t } = useLanguage();
    const { 
        mode, 
        currentWorkspace, 
        workspaceCategories, 
        workspaceTemplates,
        categoryId, setCategoryId,
        templateId, setTemplateId,
        categories 
    } = props;
    
    const isAdHoc = currentWorkspace?.allow_ad_hoc_tasks === true;
    const isProjectWorkspace = currentWorkspace?.type === 'PROJECT';
    
    // PROJECT workspace with adhoc - show category selector
    if (mode !== 'create-all' && isProjectWorkspace && isAdHoc) {
        return (
            <div className="flex flex-col gap-2">
                <Label htmlFor="category" className="text-sm font-medium font-[500] text-foreground">
                    {t('taskDialog.category', 'Category')}
                </Label>
                <div className="[&_button]:border [&_button]:border-border [&_button]:bg-background [&_button]:rounded-[10px] [&_button]:text-sm">
                    <Combobox
                        options={(workspaceCategories || []).map((c: any) => ({
                            value: String(c.id),
                            label: c.name,
                        }))}
                        value={categoryId ? String(categoryId) : undefined}
                        onValueChange={(v) => {
                            if (!v) return;
                            setCategoryId(parseInt(v, 10));
                            setTemplateId(null);
                        }}
                        placeholder={t('taskDialog.selectCategory', 'Select category')}
                        searchPlaceholder={t('taskDialog.searchCategories', 'Search categories...')}
                        emptyText={t('taskDialog.noCategoriesFound', 'No categories found.')}
                        className="w-full"
                    />
                </div>
            </div>
        );
    }
    
    // DEFAULT workspace or PROJECT non-adhoc - show template selector
    return (
        <div className="flex flex-col gap-2">
            <Label htmlFor="template" className="text-sm font-medium font-[500] text-foreground">
                {t('taskDialog.template', 'Template')}
            </Label>
            <div className="[&_button]:border [&_button]:border-border [&_button]:bg-background [&_button]:rounded-[10px] [&_button]:text-sm">
                <Combobox
                    options={workspaceTemplates.map((tpl: any) => {
                        const category = categories.find((c: any) => c.id === tpl.category_id);
                        return {
                            value: String(tpl.id),
                            label: tpl.name,
                            description: category?.name,
                        };
                    })}
                    value={templateId ? String(templateId) : undefined}
                    onValueChange={(v) => {
                        if (v) setTemplateId(parseInt(v, 10));
                    }}
                    placeholder={workspaceTemplates.length ? t('taskDialog.selectTemplate', 'Select template') : t('taskDialog.noTemplatesAvailable', 'No templates available')}
                    searchPlaceholder={t('taskDialog.searchTemplates', 'Search templates...')}
                    emptyText={t('taskDialog.noTemplatesFound', 'No templates found.')}
                    className="w-full"
                    autoFocus={(mode === 'create' || mode === 'create-all') && !templateId}
                />
            </div>
        </div>
    );
}

// Description field
function DescriptionField(props: FieldRendererProps) {
    const { t } = useLanguage();
    const { showDescription, setShowDescription, description, setDescription } = props;
    
    if (!showDescription) {
        return (
            <button
                type="button"
                onClick={() => setShowDescription(true)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 py-2"
            >
                <Plus className="w-4 h-4" />
                <span>{description?.trim() ? t('taskDialog.showDescription', 'Show description') : t('taskDialog.addDescription', 'Add description')}</span>
            </button>
        );
    }
    
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <Label htmlFor="task-desc" className="text-sm font-medium font-[500] text-foreground">
                    {t('taskDialog.description', 'Description')}
                </Label>
                <button
                    type="button"
                    onClick={() => {
                        setShowDescription(false);
                        if (!description?.trim()) setDescription('');
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors duration-150 p-1"
                >
                    <ChevronUp className="w-4 h-4" />
                </button>
            </div>
            <Textarea 
                id="task-desc" 
                value={description || ''} 
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('workspace.taskDialog.addDescription', 'Add a description for this task...')} 
                className="min-h-[120px] px-4 py-4 rounded-[12px] text-sm resize-y" 
            />
        </div>
    );
}

// Spot/Location field
function SpotField(props: FieldRendererProps) {
    const { t } = useLanguage();
    const { spotsApplicable, selectedTemplate, workspaceSpots, spotId, setSpotId } = props;
    
    // Check if spots should be hidden based on template settings
    const spotsHidden = selectedTemplate && (
        selectedTemplate.spots_not_applicable === true || 
        selectedTemplate.spots_not_applicable === 'true' ||
        selectedTemplate.spots_not_applicable === 1 ||
        selectedTemplate.spots_not_applicable === '1'
    );
    
    if (!spotsApplicable || spotsHidden) {
        return null;
    }
    
    return (
        <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium font-[500] text-foreground">
                {t('taskDialog.location', 'Location')}
            </Label>
            <div className="[&_button]:border [&_button]:border-border [&_button]:bg-background [&_button]:rounded-[10px] [&_button]:text-sm">
                <Combobox
                    options={workspaceSpots.map((s: any) => ({
                        value: String(s.id),
                        label: s.name,
                    }))}
                    value={spotId ? String(spotId) : undefined}
                    onValueChange={(v) => setSpotId(v ? parseInt(v, 10) : null)}
                    placeholder={workspaceSpots.length ? t('taskDialog.selectLocation', 'Select location') : t('taskDialog.noSpots', 'No spots')}
                    searchPlaceholder={t('taskDialog.searchLocations', 'Search locations...')}
                    emptyText={t('taskDialog.noLocationsFound', 'No locations found.')}
                    className="w-full"
                />
            </div>
        </div>
    );
}

// Responsible users field
function ResponsibleField(props: FieldRendererProps) {
    const { t } = useLanguage();
    const { workspaceUsers, selectedUserIds, setSelectedUserIds } = props;
    
    return (
        <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium font-[500] text-foreground">
                {t('taskDialog.responsible', 'Responsible')}
            </Label>
            <div className="[&_button]:border [&_button]:border-border [&_button]:bg-background [&_button]:rounded-[10px] [&_button]:text-sm">
                <MultiSelectCombobox
                    options={workspaceUsers.map((u: any) => ({
                        value: String(u.id),
                        label: u.name || u.email || `User ${u.id}`,
                    }))}
                    value={(selectedUserIds || []).map((id: number) => String(id))}
                    onValueChange={(values) => {
                        setSelectedUserIds(values.map(v => parseInt(v, 10)).filter(n => Number.isFinite(n)));
                    }}
                    placeholder={t('taskDialog.selectUsers', 'Select users...')}
                    searchPlaceholder={t('taskDialog.searchUsers', 'Search users...')}
                    emptyText={t('taskDialog.noUsersFound', 'No users found.')}
                    className="w-full"
                />
            </div>
        </div>
    );
}

// Priority field
function PriorityField(props: FieldRendererProps) {
    const { t } = useLanguage();
    const { categoryPriorities, priorityId, setPriorityId } = props;
    
    return (
        <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium font-[500] text-foreground">
                {t('taskDialog.priority', 'Priority')}
            </Label>
            <Select 
                value={priorityId ? String(priorityId) : ""} 
                onValueChange={(v) => setPriorityId(v ? parseInt(v, 10) : null)}
            >
                <SelectTrigger className="h-10 px-4 border border-border bg-background rounded-[10px] text-sm">
                    <SelectValue placeholder={categoryPriorities?.length ? t('taskDialog.selectPriority', 'Select priority') : t('taskDialog.noPriorities', 'No priorities')} />
                </SelectTrigger>
                <SelectContent>
                    {(categoryPriorities || []).map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                                <span>{p.name}</span>
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

// Tags field
function TagsField(props: FieldRendererProps) {
    const { tags, selectedTagIds, setSelectedTagIds } = props;
    
    if (!tags || tags.length === 0) {
        return null;
    }
    
    return (
        <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium font-[500] text-foreground">Tags</Label>
            <div className="[&_button]:border [&_button]:border-border [&_button]:bg-background [&_button]:rounded-[10px] [&_button]:text-sm">
                <TagMultiSelect
                    tags={tags}
                    value={selectedTagIds || []}
                    onValueChange={(values) => setSelectedTagIds?.(values)}
                    placeholder="Select tags..."
                    searchPlaceholder="Search tags..."
                    emptyText="No tags found."
                    className="w-full"
                />
            </div>
        </div>
    );
}

// Start date field
function StartDateField(props: FieldRendererProps) {
    const { t } = useLanguage();
    const { startDate, setStartDate, startTime, setStartTime } = props;
    
    return (
        <div className="flex flex-col gap-2">
            <Label htmlFor="start" className="text-sm font-medium font-[500] text-foreground">
                {t("taskDialog.startDate", "Start Date")}
            </Label>
            <div className="flex gap-2">
                <Input 
                    id="start" 
                    type="date" 
                    value={startDate || ''} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    className="flex-1 h-10 px-4 border-border bg-background rounded-[10px] text-sm" 
                />
                <Input 
                    id="start-time" 
                    type="time" 
                    value={startTime || ''} 
                    onChange={(e) => setStartTime(e.target.value)} 
                    className="w-32 h-10 px-4 border-border bg-background rounded-[10px] text-sm" 
                />
            </div>
        </div>
    );
}

// Due date field
function DueDateField(props: FieldRendererProps) {
    const { t } = useLanguage();
    const { dueDate, setDueDate, dueTime, setDueTime } = props;
    
    return (
        <div className="flex flex-col gap-2">
            <Label htmlFor="due" className="text-sm font-medium font-[500] text-foreground">
                {t("taskDialog.dueDate", "Due Date")}
            </Label>
            <div className="flex gap-2">
                <Input 
                    id="due" 
                    type="date" 
                    value={dueDate || ''} 
                    onChange={(e) => setDueDate(e.target.value)} 
                    className="flex-1 h-10 px-4 border-border bg-background rounded-[10px] text-sm" 
                />
                <Input 
                    id="due-time" 
                    type="time" 
                    value={dueTime || ''} 
                    onChange={(e) => setDueTime(e.target.value)} 
                    className="w-32 h-10 px-4 border-border bg-background rounded-[10px] text-sm" 
                />
            </div>
        </div>
    );
}

// Recurrence field
function RecurrenceField(props: FieldRendererProps) {
    const { t } = useLanguage();
    const { 
        mode, 
        recurrenceSettings, 
        setRecurrenceSettings, 
        isExistingRecurringTask,
        startDate,
        startTime 
    } = props;
    
    if (!recurrenceSettings || !setRecurrenceSettings) {
        return null;
    }
    
    const dtstart = startDate && startTime 
        ? `${startDate}T${startTime}:00` 
        : startDate 
            ? `${startDate}T09:00:00`
            : undefined;
    
    return (
        <div className="flex flex-col gap-3 pt-2 border-t">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm font-medium font-[500] text-foreground">
                        {t("recurrence.repeatTask") || "Repeat Task"}
                    </Label>
                </div>
                <Switch
                    checked={recurrenceSettings.enabled}
                    onCheckedChange={(enabled) => {
                        setRecurrenceSettings((prev: any) => ({
                            ...prev,
                            enabled,
                            editScope: enabled ? 'future' : prev.editScope,
                        }));
                    }}
                    disabled={mode === 'edit' && isExistingRecurringTask}
                />
            </div>
            
            {recurrenceSettings.enabled && (mode === 'create' || (mode === 'edit' && !isExistingRecurringTask)) && (
                <div className="pl-6">
                    <RecurrenceEditor
                        initialRRule={recurrenceSettings.rrule}
                        dtstart={dtstart}
                        onChange={(rrule: string, humanReadable: string) => {
                            setRecurrenceSettings((prev: any) => ({
                                ...prev,
                                rrule,
                                humanReadable,
                            }));
                        }}
                    />
                </div>
            )}
        </div>
    );
}

// SLA field
function SlaField(props: FieldRendererProps) {
    const { slas, slaId, setSlaId } = props;
    
    return (
        <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium font-[500] text-foreground">SLA</Label>
            <Select 
                value={slaId ? String(slaId) : ""} 
                onValueChange={(v) => setSlaId(v ? parseInt(v, 10) : null)}
            >
                <SelectTrigger className="h-10 px-4 border border-border bg-background rounded-[10px] text-sm">
                    <SelectValue placeholder="Select SLA (optional)" />
                </SelectTrigger>
                <SelectContent>
                    {Array.isArray(slas) && slas.filter((s: any) => s.enabled !== false).map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                            {s.name || `SLA ${s.id}`}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

// Approval field
function ApprovalField(props: FieldRendererProps) {
    const { approvals, approvalId, setApprovalId } = props;
    
    return (
        <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium font-[500] text-foreground">Approval</Label>
            <Select 
                value={approvalId ? String(approvalId) : ""} 
                onValueChange={(v) => setApprovalId(v ? parseInt(v, 10) : null)}
            >
                <SelectTrigger className="h-10 px-4 border border-border bg-background rounded-[10px] text-sm">
                    <SelectValue placeholder="Select approval (optional)" />
                </SelectTrigger>
                <SelectContent>
                    {Array.isArray(approvals) && approvals.filter((a: any) => a.is_active !== false).map((a: any) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                            {a.name || `Approval ${a.id}`}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

export default DynamicFieldRenderer;
