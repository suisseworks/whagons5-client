import { useMemo, useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClipboardList, faEye, faXmark } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Form, FormVersion } from "@/store/types";
import { useNavigate, useLocation } from "react-router-dom";

// Extended types for form builder
interface FormBuilderSchema {
  fields: Array<{
    id: number;
    type: 'text' | 'textarea' | 'select' | 'checkbox';
    label: string;
    placeholder?: string;
    required?: boolean;
    options?: string[];
  }>;
  form_id?: number;
  title?: string;
  description?: string;
  isDraft?: boolean;
}

interface BuilderMeta {
  name: string;
  description: string;
}

// Extended Form interface to include properties used in the component
interface ExtendedForm extends Omit<Form, 'is_active'> {
  description?: string;
  created_by?: number;
  current_version_id?: number;
}
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/store/store";
import { genericActions } from "@/store/genericSlices";
import { useAuthUser } from "@/providers/AuthProvider";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer
} from "../../components";
import FormBuilder from "./components/FormBuilder";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UrlTabs } from "@/components/ui/url-tabs";
import { ShortAnswerField } from "./components/field-types/ShortAnswerField";
import { ParagraphField } from "./components/field-types/ParagraphField";
import { MultipleChoiceField } from "./components/field-types/MultipleChoiceField";
import { CheckboxField } from "./components/field-types/CheckboxField";
import StatusButton from "@/components/ui/StatusButton";

// Simple renderer for form name with version badge
const FormNameCellRenderer = (props: ICellRendererParams) => {
  const versions: FormVersion[] = (props.context?.formVersions || []) as FormVersion[];
  const active = versions
    .filter(v => v.form_id === props.data.id)
    .sort((a: FormVersion, b: FormVersion) => Number(b.version) - Number(a.version))[0];
  return (
    <div className="flex items-center h-full space-x-2">
      <FontAwesomeIcon icon={faClipboardList} className="w-4 h-4 text-gray-300" />
      <div className="flex items-center gap-2">
        <span>{props.value}</span>
        {active && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
            v{active.version}
          </span>
        )}
      </div>
    </div>
  );
};

function Forms() {
  // Bring in forms and versions for context rendering
  const { value: formVersions } = useSelector((state: RootState) => (state as any).formVersions || { value: [] });
  const dispatch = useDispatch<AppDispatch>();
  const authUser = useAuthUser();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    items: forms,
    filteredItems,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    handleSearch,
    updateItem,
    deleteItem,
    isSubmitting,
    formError,
    isDeleteDialogOpen,
    deletingItem: deletingForm,
    handleDelete,
    handleCloseDeleteDialog
  } = useSettingsState<Form>({
    entityName: 'forms',
    searchFields: ['name', 'description']
  });

  // Tabs and selection state
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
  const selectedForm = useMemo(() => forms.find((f: Form) => f.id === selectedFormId) || null, [forms, selectedFormId]);
  const [builderMeta, setBuilderMeta] = useState<BuilderMeta>({ name: '', description: '' });
  const [isNewForm, setIsNewForm] = useState(false);
  const [skipBuilderClearOnce, setSkipBuilderClearOnce] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [publishStatus, setPublishStatus] = useState<"idle" | "processing" | "success" | "error">("idle");

  // Builder state (per-session draft) - persisted to localStorage
  const [builderSchema, setBuilderSchema] = useState<FormBuilderSchema>(() => {
    const saved = localStorage.getItem('formBuilderDraft');
    return saved ? JSON.parse(saved) : { fields: [], title: '', description: '' };
  });

  const [currentVersionId, setCurrentVersionId] = useState<number | null>(null);
  const [isVersionUsed, setIsVersionUsed] = useState(false);

  // Auto-save to localStorage whenever builder schema changes (new-form mode only)
  useEffect(() => {
    if (isNewForm) {
      localStorage.setItem('formBuilderDraft', JSON.stringify(builderSchema));
    }
  }, [builderSchema, isNewForm]);

  // Clear function for the red clear button
  const clearBuilder = useCallback(() => {
    setBuilderSchema({ fields: [], title: '', description: '' });
    setBuilderMeta({ name: '', description: '' });
    setIsNewForm(true);
    setSelectedFormId(null);
    localStorage.removeItem('formBuilderDraft');
  }, []);

  // Helper: create a form version (draft or active)
  const createFormVersion = useCallback(async (formId: number) => {
    const latest = [...formVersions]
      .filter((v: FormVersion) => v.form_id === formId)
      .sort((a: FormVersion, b: FormVersion) => Number(b.version) - Number(a.version))[0];
    const nextVersion = (latest ? Number(latest.version) : 0) + 1;

    const schemaData = {
      title: builderMeta.name,
      description: builderMeta.description,
      fields: builderSchema.fields || []
    };

    const payload = {
      form_id: formId,
      version: nextVersion,
      fields: schemaData
    } as any;
    const response = await dispatch(genericActions.formVersions.addAsync(payload)).unwrap();
    return response as unknown as { id: number; form_id: number; version: number; fields?: any };
  }, [builderMeta, builderSchema, formVersions, dispatch]);

  // Function to load form for editing
  const loadFormForEditing = useCallback(async (formId: number) => {
    try {
      // Load latest version (active or draft) for this form from backend cache
      const form = forms.find(f => f.id === formId) as ExtendedForm | undefined;
      const latest = [...formVersions]
        .filter((v: FormVersion) => v.form_id === formId)
        .sort((a: FormVersion, b: FormVersion) => Number(b.version) - Number(a.version))[0];

      let activeVersionId: number | null = null;
      if (form && (form as any).current_version_id) {
        activeVersionId = (form as any).current_version_id;
      } else if (latest) {
        activeVersionId = latest.id;
      }

      if (activeVersionId) {
        setCurrentVersionId(activeVersionId);
        try {
          const res = await fetch(`/api/form-versions/${activeVersionId}/usages`);
          if (res.ok) {
            const data = await res.json();
            setIsVersionUsed(data.task_count > 0);
          } else {
            setIsVersionUsed(false);
          }
        } catch (e) {
          console.error('Failed to fetch version usages:', e);
          setIsVersionUsed(false);
        }
      } else {
        setCurrentVersionId(null);
        setIsVersionUsed(false);
      }

      if ((latest as any)?.fields || (latest as any)?.schema_data) {
        const raw = (latest as any).fields ?? (latest as any).schema_data;
        const parsed = typeof raw === 'object' ? raw : (typeof raw === 'string' ? JSON.parse(raw) : {});
        const title = (parsed?.title ?? (form ? form.name : '')) || '';
        const description = (parsed?.description ?? ((form as ExtendedForm)?.description ?? '')) || '';
        setBuilderSchema({
          fields: parsed?.fields || [],
          title,
          description,
          form_id: formId,
          isDraft: !(form && (form as any).current_version_id === latest.id)
        });
        setBuilderMeta({ name: title, description });
      } else {
        // Initialize from the form's own meta (no versions yet)
        const form = forms.find(f => f.id === formId);
        const title = (form ? form.name : '') || '';
        const description = ((form as ExtendedForm | undefined)?.description ?? '') || '';
        setBuilderSchema({ fields: [], form_id: formId, title, description, isDraft: true });
        setBuilderMeta({ name: title, description });
      }

      setSelectedFormId(formId);
      setIsNewForm(false); // We're editing an existing form
      setSkipBuilderClearOnce(true); // Prevent a subsequent builder tab change from clearing
    } catch (error) {
      console.error('Error loading form for editing:', error);
    }
  }, [formVersions, forms]);

  // Function to load form schema for preview (always shows published version)
  const loadFormForPreview = useCallback(async (formId: number) => {
    try {
      // Find the active version for this form (by current_version_id)
      const form = forms.find(f => f.id === formId) as ExtendedForm | undefined;
      const activeVersion = [...formVersions]
        .filter((v: FormVersion) => v.form_id === formId)
        .find((v: FormVersion) => ((form as any)?.current_version_id ? v.id === (form as any).current_version_id : false))
        || [...formVersions].filter((v: FormVersion) => v.form_id === formId).sort((a: FormVersion, b: FormVersion) => Number(b.version) - Number(a.version))[0];

      if ((activeVersion as any)?.fields) {
        const fieldsRaw = (activeVersion as any)?.fields;
        const parsed = typeof fieldsRaw === 'string' ? JSON.parse(fieldsRaw) : (fieldsRaw || {});
        setBuilderSchema({
          fields: parsed?.fields || [],
          title: parsed?.title || '',
          description: parsed?.description || '',
          form_id: formId,
          isDraft: false
        });
        setIsPreviewOpen(true);
      } else {
        setBuilderSchema({ fields: [], form_id: formId, title: 'Untitled form', description: '', isDraft: false });
        setIsPreviewOpen(true);
      }
    } catch (error) {
      console.error('Error loading form for preview:', error);
      const form = forms.find(f => f.id === formId);
      setBuilderSchema({ fields: [], form_id: formId, title: form?.name || 'Untitled form', description: (form as any)?.description || '', isDraft: false });
      setIsPreviewOpen(true);
    }
  }, [formVersions, forms]);

  // Column defs
  const colDefs = useMemo<ColDef[]>(() => [
    {
      field: 'name',
      headerName: 'Form Name',
      flex: 2,
      minWidth: 220,
      cellRenderer: FormNameCellRenderer
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 3,
      minWidth: 260
    },
    {
      field: 'actions',
      headerName: 'Actions',
      minWidth: 220,
      suppressSizeToFit: true,
      cellRenderer: createActionsCellRenderer({
        onEdit: async (item: any) => {
          await loadFormForEditing(item.id);
          // Ensure we are on the builder tab in the URL with the editing form id
          navigate(`/settings/forms?tab=builder&editing_form=${item.id}`, { replace: true });
        },
        onDelete: handleDelete,
        customActions: [
          {
            icon: faEye,
            label: 'Preview',
            variant: 'outline',
            onClick: (item: Form) => {
              loadFormForPreview(item.id);
            },
            className: 'px-3 h-8 text-xs',
            disabled: () => false // Allow preview for all forms - will show draft if no published version exists
          }
        ]
      }),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ], [handleDelete, loadFormForPreview, loadFormForEditing, formVersions]);

  useEffect(() => {
    if (selectedForm) {
      setBuilderSchema((prev: FormBuilderSchema) => prev?.form_id === selectedForm.id ? prev : {
        fields: [],
        form_id: selectedForm.id,
        title: selectedForm.name,
        description: (selectedForm as ExtendedForm).description || ''
      });
      setBuilderMeta({
        name: selectedForm.name,
        description: (selectedForm as ExtendedForm).description || ''
      });
    } else {
      setBuilderSchema({ fields: [], title: '', description: '' });
      setBuilderMeta({ name: '', description: '' });
    }
  }, [selectedForm]);

  useEffect(() => {
    // Support both correct and misspelled param to be forgiving
    const params = new URLSearchParams(location.search);
    const builderTab = params.get('tab');
    const editIdStr = params.get('editing_form') || params.get('editting_from');
    const editId = editIdStr ? Number(editIdStr) : NaN;

    if (builderTab === 'builder' && !Number.isNaN(editId)) {
      // Open in edit mode for this form
      setSkipBuilderClearOnce(true);
      loadFormForEditing(editId).catch(console.error);
    }
  }, [location.search, loadFormForEditing]);

  const saveDraft = useCallback(() => {
    // Placeholder: in future, create or update a draft formVersion with schema_data
    console.log('save draft', builderSchema);
  }, [builderSchema]);

  // Define tabs for URL persistence
  const formsTabs = [
    {
      value: 'list',
      label: 'List',
      content: (
        <div className="flex-1 min-h-0 flex flex-col space-y-4">
          <SettingsGrid
            rowData={filteredItems}
            columnDefs={colDefs}
            noRowsMessage="No forms found"
            onRowDoubleClicked={(event: any) => { if (!event?.data) return; loadFormForEditing(event.data.id).then(() => { navigate(`/settings/forms?tab=builder&editing_form=${event.data.id}`, { replace: true }); }); }}
            onGridReady={(params: any) => {
              params.api.setGridOption('context', { formVersions });
            }}
            className="flex-1 min-h-0"
            height="100%"
          />
        </div>
      )
    },
    {
      value: 'builder',
      label: 'Builder',
      content: (
        <div className="space-y-4 flex-1 min-h-0 flex flex-col overflow-y-auto">
          {/* Header with form info and action buttons */}
          <div className="flex items-center justify-between pb-4 border-b">
            <div className="text-sm text-muted-foreground">
              {isNewForm ? 'Creating a new form' : selectedForm ? (
                <button
                  type="button"
                  onClick={() => {
                    clearBuilder();
                    navigate('/settings/forms?tab=builder', { replace: true });
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-secondary/50 bg-secondary/20 hover:bg-secondary/30 text-foreground transition-colors"
                  title="Exit edit mode and start a new form"
                >
                  <span className="text-xs font-medium">Editing: {selectedForm.name}</span>
                  <FontAwesomeIcon icon={faXmark} className="w-3 h-3 opacity-70" />
                </button>
              ) : 'Select a form to edit'}
            </div>
            <div className="flex gap-2">
              {/* Action buttons: Preview, Clear, and mode-dependent New/Publish */}
              <Button size="sm" variant="outline" type="button" onClick={() => setIsPreviewOpen(true)}>
                Preview
              </Button>
              {/* Save Changes (edit mode only) */}
              {selectedForm && !isNewForm && (
                <StatusButton
                  size="sm"
                  variant="secondary"
                  status={saveStatus}
                  onClick={async () => {
                    try {
                      setSaveStatus("processing");
                      // Update form meta
                      await updateItem(selectedForm.id, {
                        name: builderMeta.name,
                        description: builderMeta.description || undefined
                      });
                      // Schema
                      const schemaData = {
                        title: builderMeta.name,
                        description: builderMeta.description || '',
                        fields: builderSchema.fields || []
                      };
                      if (isVersionUsed && currentVersionId) {
                        // Create new version
                        const latestVersion = formVersions.filter((v: FormVersion) => v.form_id === selectedForm.id).sort((a: FormVersion, b: FormVersion) => Number(b.version) - Number(a.version))[0];
                        const nextVersion = (latestVersion ? Number(latestVersion.version) : 0) + 1;
                        const newVersionPayload = {
                          form_id: selectedForm.id,
                          version: nextVersion,
                          fields: schemaData
                        };
                        const newVersion = await dispatch(genericActions.formVersions.addAsync(newVersionPayload)).unwrap();
                        // Update form current_version_id
                        await updateItem(selectedForm.id, { current_version_id: newVersion.id } as any);
                      } else if (currentVersionId) {
                        // Update current
                        await dispatch(genericActions.formVersions.updateAsync({ id: currentVersionId, fields: schemaData })).unwrap();
                      }
                      setSaveStatus("success");
                      setTimeout(() => setSaveStatus("idle"), 900);
                    } catch (e) {
                      console.error('Error saving changes:', e);
                      setSaveStatus("error");
                      setTimeout(() => setSaveStatus("idle"), 1200);
                    }
                  }}
                  disabled={!builderMeta.name.trim()}
                  title="Save changes to this form"
                >
                  Save Changes
                </StatusButton>
              )}

              {/* Single New/Publish button depending on mode */}
              <StatusButton
                size="sm"
                variant="secondary"
                status={selectedForm && !isNewForm ? "idle" : publishStatus}
                type="button"
                onClick={async () => {
                  if (selectedForm && !isNewForm) {
                    // Editing existing → switch to New Form mode
                    clearBuilder();
                    navigate('/settings/forms?tab=builder', { replace: true });
                  } else {
                    // Creating new → publish (create first if needed)
                    try {
                      setPublishStatus("processing");
                      let formId: number;
                      let newFormId: number | null = null;
                      if (!selectedFormId) {
                        const formPayload: any = {
                          name: builderMeta.name,
                          description: builderMeta.description || undefined,
                          created_by: authUser?.id,
                        };
                        const newForm = await dispatch(genericActions.forms.addAsync(formPayload)).unwrap();
                        formId = newForm.id;
                        newFormId = formId;
                        setSelectedFormId(formId);
                      } else {
                        formId = selectedFormId;
                      }
                      const version = await createFormVersion(formId);
                      if (newFormId) {
                        const foundForm = forms.find((f: Form) => f.id === newFormId);
                        if (!(foundForm as any)?.current_version_id) {
                          await updateItem(newFormId, { current_version_id: version.id } as any);
                        }
                      }
                      setPublishStatus("success");
                      setTimeout(() => setPublishStatus("idle"), 900);
                    } catch (e) {
                      console.error('Error publishing form:', e);
                      setPublishStatus("error");
                      setTimeout(() => setPublishStatus("idle"), 1200);
                    }
                  }
                }}
                disabled={!builderMeta.name.trim() && !(selectedForm && !isNewForm)}
                title={selectedForm && !isNewForm ? 'Start a new form' : 'Publish form'}
              >
                {selectedForm && !isNewForm ? 'New Form' : 'Publish'}
              </StatusButton>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <FormBuilder
              schema={builderSchema}
              onChange={(newSchema) => {
                setBuilderSchema(newSchema);
                // Update the builderMeta when title/description changes
                if (newSchema.title !== undefined) {
                  setBuilderMeta(prev => ({ ...prev, name: newSchema.title || '' }));
                }
                if (newSchema.description !== undefined) {
                  setBuilderMeta(prev => ({ ...prev, description: newSchema.description || '' }));
                }
                // Persist draft ONLY for new form mode
                if (isNewForm) {
                  try { localStorage.setItem('formBuilderDraft', JSON.stringify(newSchema)); } catch {}
                }
              }}
              onSaveDraft={saveDraft}
              onPreview={() => setIsPreviewOpen(true)}
            />
          </div>
        </div>
      )
    }
  ];

  return (
    <SettingsLayout
      title="Forms"
      description="Manage forms and build beautiful, structured inputs with a visual builder"
      icon={faClipboardList}
      iconColor="#ec4899"
      search={{
        placeholder: "Search forms...",
        value: searchQuery,
        onChange: (value: string) => {
          setSearchQuery(value);
          handleSearch(value);
        }
      }}
      loading={{ isLoading: loading, message: "Loading forms..." }}
      error={error ? { message: error, onRetry: () => window.location.reload() } : undefined}
      statistics={undefined}
    >
      <UrlTabs
        tabs={formsTabs}
        defaultValue="list"
        basePath="/settings/forms"
        className="flex-1 h-full flex flex-col"
        onValueChange={(value) => {
          if (value === 'builder') {
            if (skipBuilderClearOnce) {
              // Coming from Edit → Builder programmatically; do not clear
              setSkipBuilderClearOnce(false);
            } else {
              // User switched to Builder manually → always new form mode
              clearBuilder();
            }
          }
        }}
      />

      {/* Delete Confirmation */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title="Delete Form"
        description={deletingForm ? `Are you sure you want to delete the form "${deletingForm.name}"? This action cannot be undone.` : undefined}
        onConfirm={() => deletingForm ? deleteItem(deletingForm.id) : undefined}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={!deletingForm}
        entityName="form"
        entityData={deletingForm}
        renderEntityPreview={(f: Form) => (
          <div className="flex items-center gap-3">
            <FontAwesomeIcon icon={faClipboardList} className="text-pink-500" />
            <div>
              <div className="font-medium">{f.name}</div>
              <div className="text-sm text-muted-foreground">{(f as ExtendedForm).description}</div>
            </div>
          </div>
        )}
      />

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Form preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Form Header */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{builderSchema.title || 'Untitled form'}</h1>
              {builderSchema.description && (
                <p className="text-muted-foreground">{builderSchema.description}</p>
              )}
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {(builderSchema.fields || []).map((f: any) => (
                <div key={f.id} className="space-y-2">
                  <div className="text-sm font-medium">{f.label}{f.required ? ' *' : ''}</div>
                  {f.type === 'text' && <ShortAnswerField isEditing={false} />}
                  {f.type === 'textarea' && <ParagraphField isEditing={false} />}
                  {f.type === 'select' && (
                    <MultipleChoiceField
                      options={f.options || []}
                      onOptionsChange={() => {}}
                      isEditing={false}
                    />
                  )}
                  {f.type === 'checkbox' && (
                    <CheckboxField
                      options={f.options || []}
                      onOptionsChange={() => {}}
                      isEditing={false}
                    />
                  )}
                </div>
              ))}
            </div>

            {(!builderSchema.fields || builderSchema.fields.length === 0) && (
              <div className="text-center text-muted-foreground py-8">
                No fields added yet
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </SettingsLayout>
  );
}

export default Forms;


