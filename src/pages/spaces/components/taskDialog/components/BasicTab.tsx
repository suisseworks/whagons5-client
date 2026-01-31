import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { TagMultiSelect } from '@/components/ui/tag-multi-select';
import { Switch } from '@/components/ui/switch';
import { RecurrenceEditor } from '@/components/recurrence/RecurrenceEditor';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { ChevronUp, Plus, ShieldCheck, Clock } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '@/providers/LanguageProvider';

export function BasicTab(props: any) {
  const { t } = useLanguage();
  const {
    mode,
    name,
    setName,
    workspaceTemplates,
    workspaceCategories,
    categories,
    categoryId,
    setCategoryId,
    templateId,
    setTemplateId,
    currentWorkspace,
    selectedApprovalId,
    selectedApproval,
    isReportingCategory,
    currentCategory,
    showDescription,
    setShowDescription,
    description,
    setDescription,
    spotsApplicable,
    selectedTemplate,
    workspaceSpots,
    spotId,
    setSpotId,
    workspaceUsers,
    selectedUserIds,
    setSelectedUserIds,
    categoryPriorities,
    priorityId,
    setPriorityId,
    // Tags
    tags,
    selectedTagIds,
    setSelectedTagIds,
    // Date and recurrence fields (only shown when from scheduler)
    isFromScheduler,
    startDate,
    setStartDate,
    startTime,
    setStartTime,
    dueDate,
    setDueDate,
    dueTime,
    setDueTime,
    recurrenceSettings,
    setRecurrenceSettings,
    isExistingRecurringTask,
  } = props;

  const isAdHoc = currentWorkspace?.allow_ad_hoc_tasks === true;
  const isProjectWorkspace = currentWorkspace?.type === 'PROJECT';

  return (
    <div className="space-y-4 pb-2">
      {/* Name - Only show for adhoc workspaces */}
      {isAdHoc && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="task-name" className="text-sm font-medium font-[500] text-foreground">
            {t('taskDialog.name', 'Name')}
          </Label>
          <Input
            id="task-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('taskDialog.namePlaceholder', 'Enter task name...')}
            className="h-10 px-4 border border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background"
          />
        </div>
      )}

      {/* Category Selection (PROJECT workspaces - adhoc only) */}
      {mode !== 'create-all' && isProjectWorkspace && isAdHoc ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="category" className="text-sm font-medium font-[500] text-foreground">
            {t('taskDialog.category', 'Category')}
          </Label>
          {workspaceCategories?.length ? (
            <div className="[&_button]:border [&_button]:border-border [&_button]:bg-background [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-border/70 [&_button]:focus-visible:border-primary [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-ring [&_button]:focus-visible:bg-background">
              <Combobox
                options={workspaceCategories.map((c: any) => ({
                  value: String(c.id),
                  label: c.name,
                }))}
                value={categoryId ? String(categoryId) : undefined}
                onValueChange={(v) => {
                  if (!v) return;
                  const newCategoryId = parseInt(v, 10);
                  setCategoryId(newCategoryId);
                  setTemplateId(null);
                }}
                placeholder={t('taskDialog.selectCategory', 'Select category')}
                searchPlaceholder={t('taskDialog.searchCategories', 'Search categories...')}
                emptyText={t('taskDialog.noCategoriesFound', 'No categories found.')}
                className="w-full"
              />
            </div>
          ) : (
            <div className="[&_button]:border [&_button]:border-border [&_button]:bg-background [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-border/70 [&_button]:focus-visible:border-primary [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-ring [&_button]:focus-visible:bg-background">
              <Combobox
                options={[]}
                value={undefined}
                onValueChange={() => {}}
                placeholder={t('taskDialog.noCategoriesConfigured', 'No categories configured')}
                searchPlaceholder={t('taskDialog.searchCategories', 'Search categories...')}
                emptyText={t('taskDialog.noCategoriesConfigured', 'No categories configured')}
                className="w-full"
              />
            </div>
          )}
          {!workspaceCategories?.length && (
            <p className="text-xs text-muted-foreground mt-1">
              {t(
                'taskDialog.noAllowedCategoriesHint',
                'This workspace has no allowed categories configured. Configure allowed categories in Workspace settings.'
              )}
            </p>
          )}
        </div>
      ) : (
        /* Template Selection (DEFAULT workspaces / PROJECT non-adhoc / create-all mode) */
        <div className="flex flex-col gap-2">
          <Label htmlFor="template" className="text-sm font-medium font-[500] text-foreground">
            {t('taskDialog.template', 'Template')}
          </Label>
          {workspaceTemplates.length === 0 ? (
            <div className="[&_button]:border [&_button]:border-border [&_button]:bg-background [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-border/70 [&_button]:focus-visible:border-primary [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-ring [&_button]:focus-visible:bg-background">
              <Combobox
                options={[]}
                value={undefined}
                onValueChange={() => {}}
                placeholder={t('taskDialog.noTemplatesAvailable', 'No templates available')}
                searchPlaceholder={t('taskDialog.searchTemplates', 'Search templates...')}
                emptyText={t('taskDialog.noTemplatesAvailable', 'No templates available')}
                className="w-full"
              />
            </div>
          ) : (
            <div className="[&_button]:border [&_button]:border-border [&_button]:bg-background [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-border/70 [&_button]:focus-visible:border-primary [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-ring [&_button]:focus-visible:bg-background">
              <Combobox
                options={workspaceTemplates.map((t: any) => {
                  const category = categories.find((c: any) => c.id === t.category_id);
                  return {
                    value: String(t.id),
                    label: t.name,
                    description: category ? category.name : undefined,
                  };
                })}
                value={templateId ? String(templateId) : undefined}
                onValueChange={(v) => {
                  if (v) {
                    const newTemplateId = parseInt(v, 10);
                    setTemplateId(newTemplateId);
                  }
                }}
                placeholder={t('taskDialog.selectTemplate', 'Select template')}
                searchPlaceholder={t('taskDialog.searchTemplates', 'Search templates...')}
                emptyText={t('taskDialog.noTemplatesFound', 'No templates found.')}
                className="w-full"
                autoFocus={(mode === 'create' || mode === 'create-all') && !templateId}
              />
            </div>
          )}
          {!workspaceTemplates.length && (
            <p className="text-xs text-muted-foreground mt-1">
              {mode === 'create-all'
                ? 'No templates available. Enable or create templates in default workspaces first.'
                : 'No templates available in this workspace. Enable or create templates first.'}
            </p>
          )}
        </div>
      )}

      {/* Approval Info */}
      {(mode === 'create' || mode === 'create-all' || mode === 'edit') && selectedApprovalId && (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-100 bg-blue-50 text-sm text-blue-900">
          <div className="mt-0.5">
            {selectedApproval ? (
              <ShieldCheck className="w-4 h-4 text-blue-600" />
            ) : (
              <Clock className="w-4 h-4 text-blue-600 animate-spin" />
            )}
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase tracking-wide font-semibold text-blue-700">Approval required</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-card text-card-foreground border border-border font-semibold">Pending</span>
            </div>
            <div className="font-semibold truncate">
              {selectedApproval?.name || `Approval #${selectedApprovalId}`}
            </div>
            <div className="text-xs text-blue-800 truncate">
              {selectedApproval?.trigger_type
                ? `Trigger: ${String(selectedApproval.trigger_type).replace(/_/g, ' ').toLowerCase()}`
                : 'Will start once the task is created'}
            </div>
            {selectedApproval?.deadline_value && (
              <div className="text-xs text-blue-800 truncate">
                Deadline: {selectedApproval.deadline_value} {selectedApproval.deadline_type || 'hours'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Workspace Destination Info */}
      {isReportingCategory && currentCategory && currentWorkspace && (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-100 bg-blue-50 text-sm text-blue-900">
          <div className="mt-0.5">
            <FontAwesomeIcon icon={faInfoCircle} className="w-4 h-4 text-blue-600" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase tracking-wide font-semibold text-blue-700">Destination Workspace</span>
            </div>
            <div className="font-semibold truncate">{currentWorkspace.name}</div>
            <div className="text-xs text-blue-800 truncate">
              Tasks created for this category will be assigned to the category's default workspace.
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      {!showDescription ? (
        <button
          type="button"
          onClick={() => setShowDescription(true)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 py-2"
        >
          <Plus className="w-4 h-4" />
          <span>{description.trim() ? t('taskDialog.showDescription', 'Show description') : t('taskDialog.addDescription', 'Add description')}</span>
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="task-desc" className="text-sm font-medium font-[500] text-foreground">
              {t('taskDialog.description', 'Description')}
            </Label>
            <button
              type="button"
              onClick={() => {
                setShowDescription(false);
                if (!description.trim()) setDescription('');
              }}
              className="text-muted-foreground hover:text-foreground transition-colors duration-150 p-1"
              aria-label="Hide description"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
          <Textarea 
            id="task-desc" 
            value={description} 
            onChange={(e) => {
              setDescription(e.target.value);
              if (e.target.value.trim() && !showDescription) setShowDescription(true);
            }}
            placeholder={t('workspace.taskDialog.addDescription', 'Add a description for this task...')} 
            className="min-h-[120px] px-4 py-4 rounded-[12px] text-sm resize-y focus:border-primary focus:ring-[3px] focus:ring-ring transition-all duration-150" 
          />
        </div>
      )}

      {/* Location */}
      {spotsApplicable && (!selectedTemplate || !(selectedTemplate.spots_not_applicable === true || selectedTemplate.spots_not_applicable === 'true' || selectedTemplate.spots_not_applicable === 1 || selectedTemplate.spots_not_applicable === '1')) && (
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium font-[500] text-foreground">{t('taskDialog.location', 'Location')}</Label>
          <div className="[&_button]:border [&_button]:border-border [&_button]:bg-background [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-border/70 [&_button]:focus-visible:border-primary [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-ring [&_button]:focus-visible:bg-background">
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
      )}

      {/* Responsible */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium font-[500] text-foreground">{t('taskDialog.responsible', 'Responsible')}</Label>
        <div className="[&_button]:border [&_button]:border-border [&_button]:bg-background [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-border/70 [&_button]:focus-visible:border-primary [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-ring [&_button]:focus-visible:bg-background">
          <MultiSelectCombobox
            options={workspaceUsers.map((u: any) => ({
              value: String(u.id),
              label: u.name || u.email || `User ${u.id}`,
            }))}
            value={selectedUserIds.map((id: number) => String(id))}
            onValueChange={(values) => {
              setSelectedUserIds(values.map((v) => parseInt(v, 10)).filter((n) => Number.isFinite(n)));
            }}
            placeholder={t('taskDialog.selectUsers', 'Select users...')}
            searchPlaceholder={t('taskDialog.searchUsers', 'Search users...')}
            emptyText={t('taskDialog.noUsersFound', 'No users found.')}
            className="w-full"
          />
        </div>
      </div>

      {/* Priority and Tags - Same line */}
      {(mode === 'create' || mode === 'edit') && tags ? (
        <div className="grid grid-cols-2 gap-4">
          {/* Priority */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium font-[500] text-foreground">{t('taskDialog.priority', 'Priority')}</Label>
            <Select value={priorityId ? String(priorityId) : ""} onValueChange={(v) => setPriorityId(v ? parseInt(v, 10) : null)}>
              <SelectTrigger className="h-10 px-4 border border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background">
                <SelectValue placeholder={categoryPriorities.length ? t('taskDialog.selectPriority', 'Select priority') : t('taskDialog.noPriorities', 'No priorities')} />
              </SelectTrigger>
              <SelectContent>
                {categoryPriorities.map((p: any) => (
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

          {/* Tags */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium font-[500] text-foreground">Tags</Label>
            <div className="[&_button]:border [&_button]:border-border [&_button]:bg-background [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-border/70 [&_button]:focus-visible:border-primary [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-ring [&_button]:focus-visible:bg-background">
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
        </div>
      ) : (
        /* Priority only - full width when Tags not available */
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium font-[500] text-foreground">{t('taskDialog.priority', 'Priority')}</Label>
          <Select value={priorityId ? String(priorityId) : ""} onValueChange={(v) => setPriorityId(v ? parseInt(v, 10) : null)}>
            <SelectTrigger className="h-10 px-4 border border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background">
              <SelectValue placeholder={categoryPriorities.length ? t('taskDialog.selectPriority', 'Select priority') : t('taskDialog.noPriorities', 'No priorities')} />
            </SelectTrigger>
            <SelectContent>
              {categoryPriorities.map((p: any) => (
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
      )}

      {/* Date and Recurrence Fields - Only shown when creating from scheduler */}
      {isFromScheduler && (
        <>
          {/* Start Date & Time */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="start" className="text-sm font-medium font-[500] text-foreground">
              {t("taskDialog.startDate", "Start Date")}
            </Label>
            <div className="flex gap-2">
              <Input 
                id="start" 
                type="date" 
                value={startDate || ''} 
                onChange={(e) => setStartDate?.(e.target.value)} 
                className="flex-1 h-10 px-4 border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background" 
              />
              <Input 
                id="start-time" 
                type="time" 
                value={startTime || ''} 
                onChange={(e) => setStartTime?.(e.target.value)} 
                className="w-32 h-10 px-4 border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background" 
              />
            </div>
          </div>

          {/* Due Date & Time */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="due" className="text-sm font-medium font-[500] text-foreground">
              {t("taskDialog.dueDate", "Due Date")}
            </Label>
            <div className="flex gap-2">
              <Input 
                id="due" 
                type="date" 
                value={dueDate || ''} 
                onChange={(e) => setDueDate?.(e.target.value)} 
                className="flex-1 h-10 px-4 border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background" 
              />
              <Input 
                id="due-time" 
                type="time" 
                value={dueTime || ''} 
                onChange={(e) => setDueTime?.(e.target.value)} 
                className="w-32 h-10 px-4 border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background" 
              />
            </div>
          </div>

          {/* Recurrence Section */}
          {recurrenceSettings && setRecurrenceSettings && (
            <div className="flex flex-col gap-3 pt-4 mt-3 border-t border-border/40 pb-3">
              {/* Recurrence Toggle */}
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
                    setRecurrenceSettings?.((prev: any) => ({
                      ...prev,
                      enabled,
                    }));
                  }}
                />
              </div>

              {/* Recurrence Editor - shown when enabled */}
              {recurrenceSettings.enabled && mode === 'create' && (
                <div className="pl-6 pb-2">
                  <RecurrenceEditor
                    initialRRule={recurrenceSettings.rrule}
                    dtstart={startDate && startTime 
                      ? `${startDate}T${startTime}:00` 
                      : startDate 
                        ? `${startDate}T09:00:00`
                        : undefined}
                    onChange={(rrule: string, humanReadable: string) => {
                      setRecurrenceSettings?.((prev: any) => ({
                        ...prev,
                        rrule,
                        humanReadable,
                      }));
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
