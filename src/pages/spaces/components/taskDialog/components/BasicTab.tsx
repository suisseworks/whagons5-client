import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { ChevronUp, Plus, ShieldCheck, Clock } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

export function BasicTab(props: any) {
  const {
    mode,
    workspaceTemplates,
    categories,
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
  } = props;

  return (
    <div className="space-y-4">
      {/* Template Selection */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="template" className="text-sm font-medium font-[500] text-foreground">
          Template
        </Label>
        {mode === 'create-all' ? (
          workspaceTemplates.length === 0 ? (
            <div className="[&_button]:border [&_button]:border-border [&_button]:bg-background [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-border/70 [&_button]:focus-visible:border-primary [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-ring [&_button]:focus-visible:bg-background">
              <Combobox
                options={[]}
                value={undefined}
                onValueChange={() => {}}
                placeholder="No templates available"
                searchPlaceholder="Search templates..."
                emptyText="No templates available"
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
                placeholder="Select template"
                searchPlaceholder="Search templates..."
                emptyText="No templates found."
                className="w-full"
              />
            </div>
          )
        ) : (
          !currentWorkspace || currentWorkspace.type !== "DEFAULT" ? (
            <div className="[&_button]:border [&_button]:border-border [&_button]:bg-background [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-border/70 [&_button]:focus-visible:border-primary [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-ring [&_button]:focus-visible:bg-background">
              <Combobox
                options={[]}
                value={undefined}
                onValueChange={() => {}}
                placeholder="Templates only available for default workspaces"
                searchPlaceholder="Search templates..."
                emptyText="No templates available"
                className="w-full"
              />
            </div>
          ) : workspaceTemplates.length === 0 ? (
            <div className="[&_button]:border [&_button]:border-border [&_button]:bg-background [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-border/70 [&_button]:focus-visible:border-primary [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-ring [&_button]:focus-visible:bg-background">
              <Combobox
                options={[]}
                value={undefined}
                onValueChange={() => {}}
                placeholder="No templates available"
                searchPlaceholder="Search templates..."
                emptyText="No templates available"
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
                    setTemplateId(parseInt(v, 10));
                  }
                }}
                placeholder="Select template"
                searchPlaceholder="Search templates..."
                emptyText="No templates found."
                className="w-full"
              />
            </div>
          )
        )}
        {!workspaceTemplates.length && (
          <p className="text-xs text-muted-foreground mt-1">
            {mode === 'create-all'
              ? 'No templates available. Enable or create templates in default workspaces first.'
              : !currentWorkspace || currentWorkspace.type !== "DEFAULT"
              ? 'Templates are only available for default workspaces.'
              : 'No templates available in this workspace. Enable or create templates first.'
            }
          </p>
        )}
      </div>

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
          <span>{description.trim() ? 'Show description' : 'Add description'}</span>
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="task-desc" className="text-sm font-medium font-[500] text-foreground">
              Description
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
            placeholder="Add a description for this task..." 
            className="min-h-[120px] px-4 py-4 rounded-[12px] text-sm resize-y focus:border-primary focus:ring-[3px] focus:ring-ring transition-all duration-150" 
          />
        </div>
      )}

      {/* Location */}
      {spotsApplicable && (!selectedTemplate || !(selectedTemplate.spots_not_applicable === true || selectedTemplate.spots_not_applicable === 'true' || selectedTemplate.spots_not_applicable === 1 || selectedTemplate.spots_not_applicable === '1')) && (
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium font-[500] text-foreground">Location</Label>
          <div className="[&_button]:border [&_button]:border-border [&_button]:bg-background [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-border/70 [&_button]:focus-visible:border-primary [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-ring [&_button]:focus-visible:bg-background">
            <Combobox
              options={workspaceSpots.map((s: any) => ({
                value: String(s.id),
                label: s.name,
              }))}
              value={spotId ? String(spotId) : undefined}
              onValueChange={(v) => setSpotId(v ? parseInt(v, 10) : null)}
              placeholder={workspaceSpots.length ? 'Select location' : 'No spots'}
              searchPlaceholder="Search locations..."
              emptyText="No locations found."
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* Responsible */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium font-[500] text-foreground">Responsible</Label>
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
            placeholder="Select users..."
            searchPlaceholder="Search users..."
            emptyText="No users found."
            className="w-full"
          />
        </div>
      </div>

      {/* Priority */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium font-[500] text-foreground">Priority</Label>
        <Select value={priorityId ? String(priorityId) : ""} onValueChange={(v) => setPriorityId(v ? parseInt(v, 10) : null)}>
          <SelectTrigger className="h-10 px-4 border border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background">
            <SelectValue placeholder={categoryPriorities.length ? 'Select priority' : 'No priorities'} />
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
    </div>
  );
}
