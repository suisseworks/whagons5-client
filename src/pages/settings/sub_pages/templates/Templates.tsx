import { useMemo, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClipboardList, faPlus, faChartBar } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Template, Task } from "@/store/types";
import { UrlTabs } from "@/components/ui/url-tabs";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState
} from "../../components";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/providers/LanguageProvider";
import { createLookupMap } from "../../shared/utils";
import { SummaryDialog, StatisticsTab, CreateTemplateDialog, EditTemplateDialog } from "./components";
import { useTemplateColumnDefs } from "./utils/columnDefs";
import { useTemplateStatistics } from "./hooks/useTemplateStatistics";
import { useTemplateForm } from "./hooks/useTemplateForm";
import { renderTemplatePreview } from "./utils/renderHelpers";

function Templates() {
  const { t } = useLanguage();
  const tt = (key: string, fallback: string) => t(`settings.templates.${key}`, fallback);
  
  // Redux state for related data
  const { value: categories } = useSelector((state: RootState) => state.categories);
  const { value: tasks } = useSelector((state: RootState) => state.tasks);
  const { value: priorities } = useSelector((state: RootState) => state.priorities);
  const { value: slas } = useSelector((state: RootState) => state.slas);
  const { value: forms } = useSelector((state: RootState) => (state as any).forms || { value: [] });
  const { value: approvals } = useSelector((state: RootState) => (state as any).approvals || { value: [] });
  const { value: requirements } = useSelector((state: RootState) => (state as any).complianceRequirements || { value: [] });
  const { value: mappings } = useSelector((state: RootState) => (state as any).complianceMappings || { value: [] });
  const { value: spots } = useSelector((state: RootState) => (state as any).spots || { value: [] });
  const { value: users } = useSelector((state: RootState) => (state as any).users || { value: [] });
  
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [summaryTemplate, setSummaryTemplate] = useState<Template | null>(null);
  const [activeTab, setActiveTab] = useState<string>('templates');

  // Use shared state management
  const {
    items: templates,
    filteredItems,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    handleSearch,
    createItem,
    updateItem,
    deleteItem,
    isSubmitting,
    formError,
    setFormError,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isDeleteDialogOpen,
    editingItem: editingTemplate,
    deletingItem: deletingTemplate,
    handleEdit,
    handleDelete,
    handleCloseDeleteDialog
  } = useSettingsState<Template>({
    entityName: 'templates',
    searchFields: ['name']
  });

  // Form state and handlers
  const {
    createFormData,
    setCreateFormData,
    editFormData,
    setEditFormData,
    createDefaultUserValues,
    setCreateDefaultUserValues,
    editDefaultUserValues,
    setEditDefaultUserValues,
    selectedRequirement,
    setSelectedRequirement,
    formError: formHookError,
    setFormError: setFormHookError,
    createCategoryPriorities,
    editCategoryPriorities,
    resetCreateForm,
    resetEditForm,
    handleAddMapping,
    handleRemoveMapping
  } = useTemplateForm(editingTemplate, isEditDialogOpen, priorities as any[], tt);

  // Use form error from hook if available, otherwise from settings state
  const effectiveFormError = formHookError || formError;
  const setEffectiveFormError = (error: string | null) => {
    setFormHookError(error);
    setFormError(error);
  };

  // Derived maps
  const priorityById = useMemo(() => {
    const map = new Map<number, { name: string; color?: string | null }>();
    (priorities as any[]).forEach((p: any) => map.set(Number(p.id), { name: p.name, color: p.color }));
    return map;
  }, [priorities]);

  const slaById = useMemo(() => createLookupMap(slas as any[]), [slas]);
  const approvalById = useMemo(() => createLookupMap(approvals as any[]), [approvals]);
  const spotById = useMemo(() => createLookupMap(spots as any[]), [spots]);

  // User options for MultiSelect
  const userOptions = useMemo(() => {
    return (users as any[]).map((user: any) => ({
      label: user?.name || user?.email || `User ${user.id}`,
      value: String(user.id)
    }));
  }, [users]);

  // Available category IDs for filter
  const availableCategoryIds = useMemo(() => {
    const categoryIds = new Set<number>();
    templates.forEach((template: Template) => {
      const categoryId = template.category_id;
      if (categoryId != null && categoryId !== undefined && !isNaN(Number(categoryId))) {
        const numId = Number(categoryId);
        if (numId > 0) categoryIds.add(numId);
      }
    });
    return Array.from(categoryIds).sort((a, b) => {
      const catA = (categories as any[]).find((c: any) => Number(c.id) === a);
      const catB = (categories as any[]).find((c: any) => Number(c.id) === b);
      return (catA?.name || '').localeCompare(catB?.name || '');
    });
  }, [templates, categories]);

  // Summary dialog data
  const usageCount = useMemo(() => {
    const tid = Number(summaryTemplate?.id);
    if (!Number.isFinite(tid)) return 0;
    return (tasks as any[]).filter((t: any) => Number((t as any).template_id) === tid).length;
  }, [summaryTemplate, tasks]);

  const summaryDefaultUsers = useMemo(() => {
    const tid = Number(summaryTemplate?.id);
    if (!Number.isFinite(tid)) return [];
    const defaultIds = (summaryTemplate as any)?.default_user_ids || [];
    return (users as any[]).filter((u: any) => defaultIds.includes(u.id));
  }, [summaryTemplate, users]);

  // Compliance mappings
  const templateMappings = useMemo(() => {
    if (!editingTemplate) return [];
    return mappings.filter((m: any) => 
      m.mapped_entity_type === 'App\\Models\\Template\\Template' && 
      Number(m.mapped_entity_id) === Number(editingTemplate.id)
    );
  }, [mappings, editingTemplate]);

  // Statistics hook
  const { statistics, statsLoading } = useTemplateStatistics({
    templates,
    tasks,
    priorities,
    categories,
    activeTab
  });

  // Column definitions hook
  const colDefs = useTemplateColumnDefs({
    categories,
    priorityById,
    slaById,
    approvalById,
    availableCategoryIds,
    handleEdit,
    openSummary: useCallback((template: Template) => {
      setSummaryTemplate(template);
      setIsSummaryDialogOpen(true);
    }, []),
    translate: tt
  });

  // Helper functions
  const getTemplateTaskCount = (templateId: number) => {
    return tasks.filter((task: Task) => task.template_id === templateId).length;
  };

  const canDeleteTemplate = (template: Template) => {
    return getTemplateTaskCount(template.id) === 0;
  };

  const handleDeleteTemplate = (template: Template) => {
    if (canDeleteTemplate(template)) {
      deleteItem(template.id);
    } else {
      handleDelete(template);
    }
  };

  const handleCellValueChanged = useCallback(async (event: any) => {
    if (!event?.colDef?.field || !event?.data) return;
    const field = event.colDef.field;
    const id = event?.data?.id;
    if (!id) return;
    if (field === 'sla_id') {
      const raw = event?.newValue as string | number | null | undefined;
      const value = raw === '' || raw === null || raw === undefined ? null : Number(raw);
      await updateItem(id, { sla_id: value } as any);
    }
  }, [updateItem]);

  const handleDownloadSOP = () => {
    if (!editingTemplate) return;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    const token = localStorage.getItem('token');
    
    fetch(`${baseUrl}/compliance/documents/sop/${editingTemplate.id}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/pdf'
      }
    })
    .then(response => response.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SOP-${editingTemplate.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch(err => console.error('SOP Download failed', err));
  };

  // Form handlers
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEffectiveFormError(null);
    
    try {
      if (!createFormData.name?.trim()) {
        setEffectiveFormError(tt('validation.nameRequired', 'Template name is required'));
        return;
      }
      if (!createFormData.category_id) {
        setEffectiveFormError(tt('validation.categoryRequired', 'Please select a category'));
        return;
      }

      const templateData: any = {
        name: createFormData.name.trim(),
        description: createFormData.description || null,
        category_id: parseInt(createFormData.category_id),
        priority_id: createFormData.priority_id ? parseInt(createFormData.priority_id) : null,
        sla_id: createFormData.sla_id ? parseInt(createFormData.sla_id) : null,
        approval_id: createFormData.approval_id ? parseInt(createFormData.approval_id) : null,
        form_id: createFormData.form_id ? parseInt(createFormData.form_id) : null,
        default_spot_id: createFormData.spots_not_applicable ? null : (createFormData.default_spot_id ? parseInt(createFormData.default_spot_id) : null),
        spots_not_applicable: createFormData.spots_not_applicable,
        default_user_ids: (Array.isArray(createDefaultUserValues) && createDefaultUserValues.length > 0) ? createDefaultUserValues.map(id => Number(id)) : null,
        instructions: createFormData.instructions || null,
        expected_duration: (() => { const n = parseInt(createFormData.expected_duration || ''); return Number.isFinite(n) && n > 0 ? n : 0; })(),
        enabled: createFormData.enabled,
        is_private: createFormData.is_private
      };

      await createItem(templateData);
      (window as any).__settings_error = null;
      resetCreateForm();
    } catch (err: any) {
      setEffectiveFormError(err?.message || tt('validation.genericError', 'An error occurred while creating the template'));
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEffectiveFormError(null);
    
    if (!editingTemplate) return;

    try {
      if (!editFormData.name?.toString()?.trim()) {
        setEffectiveFormError(tt('validation.nameRequired', 'Template name is required'));
        return;
      }
      if (!editFormData.category_id) {
        setEffectiveFormError(tt('validation.categoryRequired', 'Please select a category'));
        return;
      }

      const updates: any = {
        name: editFormData.name.trim(),
        description: editFormData.description || null,
        category_id: parseInt(editFormData.category_id),
        priority_id: editFormData.priority_id ? parseInt(editFormData.priority_id) : null,
        sla_id: editFormData.sla_id ? parseInt(editFormData.sla_id) : null,
        approval_id: editFormData.approval_id ? parseInt(editFormData.approval_id) : null,
        form_id: editFormData.form_id ? parseInt(editFormData.form_id) : null,
        default_spot_id: editFormData.spots_not_applicable ? null : (editFormData.default_spot_id ? parseInt(editFormData.default_spot_id) : null),
        spots_not_applicable: editFormData.spots_not_applicable,
        default_user_ids: (Array.isArray(editDefaultUserValues) && editDefaultUserValues.length > 0) ? editDefaultUserValues.map(id => Number(id)) : null,
        instructions: editFormData.instructions || null,
        expected_duration: (() => { const n = parseInt(editFormData.expected_duration || ''); return Number.isFinite(n) && n > 0 ? n : 0; })(),
        enabled: editFormData.enabled,
        is_private: editFormData.is_private
      };

      await updateItem(editingTemplate.id, updates);
      (window as any).__settings_error = null;
    } catch (err: any) {
      console.error('Edit template submit failed:', err);
      setEffectiveFormError(err?.message || tt('validation.genericError', 'An error occurred while updating the template'));
    }
  };

  const handleAddMappingWrapper = async () => {
    await handleAddMapping(editingTemplate);
  };

  const renderTemplatePreviewHelper = (template: Template) => 
    renderTemplatePreview({ template, priorityById, spotById, getTemplateTaskCount });

  return (
    <SettingsLayout
      title={tt('title', 'Templates')}
      description={tt('description', 'Manage task templates for faster task creation and standardized workflows')}
      icon={faClipboardList}
      iconColor="#3b82f6"
      search={{
        placeholder: tt('search.placeholder', 'Search templates...'),
        value: searchQuery,
        onChange: (value: string) => {
          setSearchQuery(value);
          handleSearch(value);
        }
      }}
      loading={{
        isLoading: loading,
        message: tt('loading', 'Loading templates...')
      }}
      error={error ? {
        message: error,
        onRetry: () => window.location.reload()
      } : undefined}
      headerActions={
        <Button 
          onClick={() => setIsCreateDialogOpen(true)} 
          size="default"
          className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-[0.98]"
        >
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          {tt('header.addTemplate', 'Add Template')}
        </Button>
      }
    >
      <UrlTabs
        tabs={[
          {
            value: "templates",
            label: (
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faClipboardList} className="w-4 h-4" />
                <span>{tt('tabs.templates', 'Templates')}</span>
              </div>
            ),
            content: (
              <div className="flex h-full flex-col">
                <div className="flex-1 min-h-0">
                  <SettingsGrid
                    rowData={filteredItems}
                    columnDefs={colDefs}
                    noRowsMessage={tt('grid.noRows', 'No templates found')}
                    onRowDoubleClicked={handleEdit}
                    onCellValueChanged={handleCellValueChanged}
                  />
                </div>
              </div>
            )
          },
          {
            value: "statistics",
            label: (
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faChartBar} className="w-4 h-4" />
                <span>{tt('tabs.statistics', 'Statistics')}</span>
              </div>
            ),
            content: (
              <div className="flex-1 min-h-0 overflow-auto p-4">
                <StatisticsTab
                  statistics={statistics}
                  statsLoading={statsLoading}
                  templates={templates}
                  tasks={tasks}
                  getTemplateTaskCount={getTemplateTaskCount}
                  translate={tt}
                />
              </div>
            )
          }
        ]}
        defaultValue="templates"
        basePath="/settings/templates"
        className="h-full flex flex-col"
        onValueChange={setActiveTab}
      />

      {/* Summary Dialog */}
      <SummaryDialog
        open={isSummaryDialogOpen}
        onOpenChange={(open) => { setIsSummaryDialogOpen(open); if (!open) setSummaryTemplate(null); }}
        template={summaryTemplate}
        categories={categories}
        priorityById={priorityById}
        slaById={slaById}
        approvalById={approvalById}
        spotById={spotById}
        defaultUsers={summaryDefaultUsers}
        usageCount={usageCount}
        translate={tt}
      />

      {/* Create Template Dialog */}
      <CreateTemplateDialog
        open={isCreateDialogOpen}
        onOpenChange={(open: boolean) => {
          setIsCreateDialogOpen(open);
          if (open) {
            (window as any).__settings_error = null;
          } else {
            resetCreateForm();
          }
        }}
        formData={createFormData}
        setFormData={setCreateFormData}
        defaultUserValues={createDefaultUserValues}
        setDefaultUserValues={setCreateDefaultUserValues}
        categoryPriorities={createCategoryPriorities}
        categories={categories}
        priorities={priorities as any[]}
        slas={slas as any[]}
        slaById={slaById}
        approvals={approvals as any[]}
        approvalById={approvalById}
        forms={forms as any[]}
        spots={spots as any[]}
        userOptions={userOptions}
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={effectiveFormError}
        translate={tt}
      />

      {/* Edit Template Dialog */}
      <EditTemplateDialog
        open={isEditDialogOpen}
        onOpenChange={(open: boolean) => {
          setIsEditDialogOpen(open);
          if (open) {
            (window as any).__settings_error = null;
          } else {
            resetEditForm();
          }
        }}
        editingTemplate={editingTemplate}
        formData={editFormData}
        setFormData={setEditFormData}
        defaultUserValues={editDefaultUserValues}
        setDefaultUserValues={setEditDefaultUserValues}
        categoryPriorities={editCategoryPriorities}
        categories={categories}
        priorities={priorities as any[]}
        slas={slas as any[]}
        slaById={slaById}
        approvals={approvals as any[]}
        approvalById={approvalById}
        forms={forms as any[]}
        spots={spots as any[]}
        userOptions={userOptions}
        requirements={requirements as any[]}
        templateMappings={templateMappings}
        selectedRequirement={selectedRequirement}
        setSelectedRequirement={setSelectedRequirement}
        onAddMapping={handleAddMappingWrapper}
        onRemoveMapping={handleRemoveMapping}
        onDownloadSOP={handleDownloadSOP}
        onDelete={() => editingTemplate && handleDeleteTemplate(editingTemplate)}
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={effectiveFormError}
        translate={tt}
      />

      {/* Delete Template Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title={tt('dialogs.delete.title', 'Delete Template')}
        description={
          deletingTemplate ? (() => {
            const taskCount = getTemplateTaskCount(deletingTemplate.id);
            if (taskCount > 0) {
              return tt('dialogs.delete.cannotDelete', 'This template cannot be deleted because it\'s used by {count} task{plural}. Please delete or reassign all tasks using this template first.')
                .replace('{count}', String(taskCount))
                .replace('{plural}', taskCount !== 1 ? 's' : '');
            } else {
              return tt('dialogs.delete.confirm', 'Are you sure you want to delete the template "{name}"? This action cannot be undone.')
                .replace('{name}', deletingTemplate.name);
            }
          })() : undefined
        }
        onConfirm={() => deletingTemplate && canDeleteTemplate(deletingTemplate) ? deleteItem(deletingTemplate.id) : undefined}
        isSubmitting={isSubmitting}
        error={effectiveFormError}
        submitDisabled={!deletingTemplate || !canDeleteTemplate(deletingTemplate)}
        entityName="template"
        entityData={deletingTemplate}
        renderEntityPreview={renderTemplatePreviewHelper}
      />
    </SettingsLayout>
  );
}

export default Templates;
