import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClipboardList, faTrash, faShieldAlt, faFilePdf } from "@fortawesome/free-solid-svg-icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/animated/Tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { SettingsDialog, SelectField, CheckboxField } from "../../../components";
import { Template, Category } from "@/store/types";
import { TemplateFormData } from "../types";
import { renderSlaSummary, renderApprovalSummary } from "../utils/renderHelpers";

interface EditTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTemplate: Template | null;
  formData: TemplateFormData;
  setFormData: React.Dispatch<React.SetStateAction<TemplateFormData>>;
  defaultUserValues: string[];
  setDefaultUserValues: React.Dispatch<React.SetStateAction<string[]>>;
  categoryPriorities: any[];
  categories: Category[];
  priorities: any[];
  slas: any[];
  slaById: Map<number, any>;
  approvals: any[];
  approvalById: Map<number, any>;
  forms: any[];
  spots: any[];
  userOptions: Array<{ label: string; value: string }>;
  requirements: any[];
  templateMappings: any[];
  selectedRequirement: string;
  setSelectedRequirement: (value: string) => void;
  onAddMapping: () => Promise<void>;
  onRemoveMapping: (mappingId: number) => Promise<void>;
  onDownloadSOP: () => void;
  onDelete: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
  translate: (key: string, fallback: string) => string;
}

export function EditTemplateDialog({
  open,
  onOpenChange,
  editingTemplate,
  formData,
  setFormData,
  defaultUserValues,
  setDefaultUserValues,
  categoryPriorities,
  categories,
  priorities,
  slaById,
  approvals,
  approvalById,
  forms,
  spots,
  userOptions,
  requirements,
  templateMappings,
  selectedRequirement,
  setSelectedRequirement,
  onAddMapping,
  onRemoveMapping,
  onDownloadSOP,
  onDelete,
  onSubmit,
  isSubmitting,
  error,
  translate
}: EditTemplateDialogProps) {
  const tt = (key: string, fallback: string) => translate(`dialogs.edit.${key}`, fallback);

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      type="edit"
      title={tt('title', 'Edit Template')}
      description={editingTemplate ? (
        <span>
          {tt('editing', 'Editing')}: <span className="font-medium text-foreground">{editingTemplate.name}</span>
        </span>
      ) : tt('description', 'Update the template information.')}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      error={error}
      submitDisabled={isSubmitting || !editingTemplate}
      footerActions={editingTemplate ? (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          onClick={onDelete}
          disabled={isSubmitting}
          title={tt('delete', 'Delete')}
          aria-label={tt('delete', 'Delete')}
        >
          <FontAwesomeIcon icon={faTrash} />
        </Button>
      ) : undefined}
    >
      <div className="rounded-xl bg-gradient-to-r from-sky-50 via-white to-emerald-50 dark:from-sky-900/30 dark:via-slate-900 dark:to-emerald-900/20 border border-sky-100 dark:border-slate-800 px-4 py-3 mb-4 flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-white/80 dark:bg-slate-800/70 border border-sky-100 dark:border-slate-700 flex items-center justify-center">
          <FontAwesomeIcon icon={faClipboardList} className="text-sky-600 dark:text-sky-300 w-4 h-4" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{tt('helper.title', 'Edit template')}</p>
          <p className="text-xs text-muted-foreground">
            {tt('helper.description', 'Update details, defaults, and rules. Approvals, SLA, and defaults can be changed here.')}
          </p>
        </div>
      </div>
      {editingTemplate && (
        <div className="max-h-[75vh] overflow-y-auto pr-1">
          <Tabs defaultValue="general" className="w-full">
            <TabsList>
              <TabsTrigger value="general">{tt('tabs.general', 'General')}</TabsTrigger>
              <TabsTrigger value="defaults">{tt('tabs.defaults', 'Defaults')}</TabsTrigger>
              <TabsTrigger value="rules">{tt('tabs.rules', 'Rules')}</TabsTrigger>
              <TabsTrigger value="compliance">{tt('tabs.compliance', 'Compliance')}</TabsTrigger>
            </TabsList>
            <TabsContent value="general">
              <div className="grid gap-4 min-h-[320px]">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-name" className="text-right">{tt('fields.name', 'Name *')}</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="edit-description" className="text-right pt-2">{tt('fields.description', 'Description')}</Label>
                  <textarea
                    id="edit-description"
                    name="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-h-[80px]"
                  />
                </div>
                <SelectField
                  id="edit-category"
                  label={tt('fields.category', 'Category')}
                  value={formData.category_id}
                  onChange={(value) => {
                    setFormData(prev => {
                      const newCategoryId = value;
                      const newCategoryPriorities = newCategoryId 
                        ? priorities.filter((p: any) => p.category_id === parseInt(newCategoryId))
                        : [];
                      const currentPriority = prev.priority_id ? priorities.find((p: any) => p.id === parseInt(prev.priority_id)) : null;
                      const isCurrentPriorityGlobal = currentPriority && (currentPriority.category_id === null || currentPriority.category_id === undefined);
                      
                      let shouldResetPriority = false;
                      if (prev.priority_id) {
                        if (newCategoryPriorities.length > 0) {
                          shouldResetPriority = !newCategoryPriorities.find((p: any) => p.id === parseInt(prev.priority_id));
                        } else {
                          shouldResetPriority = !isCurrentPriorityGlobal;
                        }
                      }
                      
                      return {
                        ...prev,
                        category_id: value,
                        priority_id: shouldResetPriority ? '' : prev.priority_id
                      };
                    });
                  }}
                  placeholder={tt('fields.categoryPlaceholder', 'Select Category')}
                  options={categories.map((category: Category) => ({
                    value: category.id.toString(),
                    label: category.name
                  }))}
                />
                <SelectField
                  id="edit-priority"
                  label={tt('fields.priority', 'Priority')}
                  value={formData.priority_id || 'none'}
                  onChange={(value) => setFormData(prev => ({ ...prev, priority_id: value === 'none' ? '' : value }))}
                  placeholder={tt('fields.priorityNone', 'None')}
                  options={[
                    { value: 'none', label: tt('fields.priorityNone', 'None') },
                    ...categoryPriorities.map((priority: any) => ({
                      value: priority.id.toString(),
                      label: priority.name,
                      color: priority.color || '#6b7280'
                    }))
                  ]}
                />
                <SelectField
                  id="edit-form"
                  label={tt('fields.form', 'Form')}
                  value={formData.form_id || 'none'}
                  onChange={(value) => setFormData(prev => ({ ...prev, form_id: value === 'none' ? '' : value }))}
                  placeholder={tt('fields.formNone', 'None')}
                  options={[
                    { value: 'none', label: tt('fields.formNone', 'None') },
                    ...([...forms]
                      .sort((a: any, b: any) => String(a?.name || '').localeCompare(String(b?.name || '')))
                      .map((f: any) => ({ value: String(f.id), label: f.name || `Form ${f.id}` }))),
                  ]}
                />
              </div>
            </TabsContent>
            <TabsContent value="rules">
              <div className="grid gap-4 min-h-[320px]">
                <SelectField
                  id="edit-sla"
                  label={tt('fields.sla', 'SLA')}
                  value={formData.sla_id}
                  onChange={(value) => setFormData(prev => ({ ...prev, sla_id: value === 'none' ? '' : value }))}
                  placeholder={tt('fields.slaNone', 'None')}
                  options={[{ value: 'none', label: tt('fields.slaNone', 'None') }, ...Array.from(slaById.entries()).map(([id, sla]) => ({ value: id.toString(), label: sla.name || `${sla.response_time ?? '?'} / ${sla.resolution_time ?? '?' } min` }))]}
                />
                {renderSlaSummary({ slaId: formData.sla_id, slaById, translate })}
                <SelectField
                  id="edit-approval"
                  label={tt('fields.approval', 'Approval')}
                  value={formData.approval_id}
                  onChange={(value) => setFormData(prev => ({ ...prev, approval_id: value === 'none' ? '' : value }))}
                  placeholder={tt('fields.approvalNone', 'None')}
                  options={[{ value: 'none', label: tt('fields.approvalNone', 'None') }, ...approvals.map((a: any) => ({ value: a.id.toString(), label: a.name }))]}
                />
                {renderApprovalSummary({ approvalId: formData.approval_id, approvalById, translate })}
              </div>
            </TabsContent>
            <TabsContent value="compliance">
              <div className="grid gap-4 min-h-[320px] content-start">
                <div className="flex justify-between items-center pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faShieldAlt} className="text-blue-600" />
                    <h3 className="font-medium">{tt('compliance.title', 'Compliance & ISO')}</h3>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={onDownloadSOP}>
                    <FontAwesomeIcon icon={faFilePdf} className="mr-2 text-red-500" />
                    {tt('compliance.generateSOP', 'Generate SOP')}
                  </Button>
                </div>
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>{tt('compliance.linkRequirement', 'Link Requirement')}</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <SelectField
                          id="requirement-select"
                          label=""
                          value={selectedRequirement}
                          onChange={setSelectedRequirement}
                          placeholder={tt('compliance.selectRequirement', 'Select ISO Requirement...')}
                          options={requirements.map((r: any) => ({
                            value: String(r.id),
                            label: `${r.clause_number} ${r.title}`
                          }))}
                        />
                      </div>
                      <Button type="button" onClick={onAddMapping} disabled={!selectedRequirement}>
                        {tt('compliance.link', 'Link')}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{tt('compliance.linkedRequirements', 'Linked Requirements')}</Label>
                    {templateMappings.length === 0 ? (
                      <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-md text-center">
                        {tt('compliance.noRequirements', 'No requirements linked to this template.')}
                      </div>
                    ) : (
                      <div className="border rounded-md divide-y">
                        {templateMappings.map((m: any) => {
                          const req = requirements.find((r: any) => r.id === m.requirement_id);
                          return (
                            <div key={m.id} className="p-3 flex justify-between items-center hover:bg-accent/50">
                              <div>
                                <div className="font-medium text-sm">
                                  {req ? `${req.clause_number} ${req.title}` : `Requirement ${m.requirement_id}`}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {req?.description}
                                </div>
                              </div>
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => onRemoveMapping(m.id)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="defaults">
              <div className="grid gap-4 min-h-[320px]">
                <CheckboxField 
                  id="edit-spots_not_applicable" 
                  label={tt('fields.spotsNotApplicable', 'Spots Not Applicable')}
                  checked={formData.spots_not_applicable}
                  onChange={(checked) => {
                    setFormData(prev => ({ 
                      ...prev, 
                      spots_not_applicable: checked,
                      default_spot_id: checked ? '' : prev.default_spot_id
                    }));
                  }}
                  description={tt('fields.spotsNotApplicableDesc', 'When enabled, tasks created from this template will not require a location/spot')}
                />
                {!formData.spots_not_applicable && (
                  <SelectField 
                    id="edit-default-spot" 
                    label={tt('fields.defaultSpot', 'Default Spot')}
                    value={formData.default_spot_id} 
                    onChange={(value) => setFormData(prev => ({ ...prev, default_spot_id: value }))} 
                    placeholder={tt('fields.defaultSpotNone', 'None')} 
                    options={spots.map((s: any) => ({ value: s.id.toString(), label: s.name }))} 
                  />
                )}
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="text-right pt-2">{tt('fields.defaultUsers', 'Default Users')}</Label>
                  <div className="col-span-3">
                    <MultiSelect
                      options={userOptions}
                      onValueChange={setDefaultUserValues}
                      defaultValue={defaultUserValues}
                      placeholder={tt('fields.defaultUsersPlaceholder', 'Select default users...')}
                      maxCount={5}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-expected_duration" className="text-right">{tt('fields.expectedDuration', 'Expected Duration (min)')}</Label>
                  <Input 
                    id="edit-expected_duration" 
                    name="expected_duration" 
                    type="number" 
                    min="0" 
                    step="1" 
                    value={formData.expected_duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, expected_duration: e.target.value }))}
                    className="col-span-3" 
                  />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="edit-instructions" className="text-right pt-2">{tt('fields.instructions', 'Instructions')}</Label>
                  <textarea 
                    id="edit-instructions" 
                    name="instructions" 
                    value={formData.instructions}
                    onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                    className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-h-[120px]" 
                    placeholder={tt('fields.instructionsPlaceholder', 'Enter detailed instructions...')} 
                  />
                </div>
                <CheckboxField id="edit-enabled" label={tt('fields.enabled', 'Enabled')} checked={formData.enabled} onChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))} description={tt('fields.enabledDesc', 'Enable this template')} />
                <CheckboxField 
                  id="edit-is_private" 
                  label={tt('fields.privateTemplate', 'Private Template')}
                  checked={formData.is_private}
                  onChange={(checked) => setFormData(prev => ({ ...prev, is_private: checked }))}
                  description={tt('fields.privateTemplateDesc', 'Private templates can only be used by the team that owns the category')}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </SettingsDialog>
  );
}
