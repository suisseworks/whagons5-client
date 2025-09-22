import { useMemo, useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClipboardList, faFloppyDisk, faRotate } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Form, FormVersion } from "@/store/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/animated/Tabs";
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
} from "../components";
import FormBuilder from "../components/FormBuilder";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Simple renderer for form name with version badge
const FormNameCellRenderer = (props: ICellRendererParams) => {
  const versions: FormVersion[] = (props.context?.formVersions || []) as FormVersion[];
  const active = versions
    .filter(v => v.form_id === props.data.id)
    .sort((a, b) => Number(b.version) - Number(a.version))[0];
  return (
    <div className="flex items-center h-full space-x-2">
      <FontAwesomeIcon icon={faClipboardList} className="w-4 h-4 text-gray-300" />
      <div className="flex items-center gap-2">
        <span>{props.value}</span>
        {active && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
            v{active.version}{active.is_active ? '' : ' (draft)'}
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
  const [activeTab, setActiveTab] = useState<'list' | 'builder'>('list');
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
  const selectedForm = useMemo(() => forms.find(f => f.id === selectedFormId) || null, [forms, selectedFormId]);
  const [builderMeta, setBuilderMeta] = useState<{ name: string; description: string; is_active: boolean }>({ name: '', description: '', is_active: true });

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
      field: 'is_active',
      headerName: 'Active',
      width: 120,
      valueFormatter: (p) => (p.value ? 'Yes' : 'No')
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      cellRenderer: createActionsCellRenderer({
        onEdit: (item: Form) => {
          setSelectedFormId(item.id);
          setBuilderMeta({
            name: item.name,
            description: (item as any).description || '',
            is_active: !!(item as any).is_active
          });
          setActiveTab('builder');
        },
        onDelete: handleDelete
      }),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ], [handleDelete]);

  // Create or update meta from Builder
  const updateFormMeta = useCallback(async () => {
    if (selectedForm) {
      await updateItem(selectedForm.id, {
        name: builderMeta.name,
        description: builderMeta.description || null,
        is_active: builderMeta.is_active
      } as any);
    } else {
      const payload: any = {
        name: builderMeta.name,
        description: builderMeta.description || null,
      };
      // Server requires created_by
      if (authUser?.id) payload.created_by = authUser.id;
      const saved = await dispatch(genericActions.forms.addAsync(payload)).unwrap();
      setSelectedFormId((saved as any).id);
    }
  }, [selectedForm, builderMeta, updateItem, dispatch, authUser]);

  // Builder state (per-session draft). In a full impl., this would link to formVersions.
  const [builderSchema, setBuilderSchema] = useState<any>({ fields: [] });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (selectedForm) {
      setBuilderSchema((prev: any) => prev?.form_id === selectedForm.id ? prev : { fields: [], form_id: selectedForm.id });
      setBuilderMeta({
        name: selectedForm.name,
        description: (selectedForm as any).description || '',
        is_active: !!(selectedForm as any).is_active
      });
    } else {
      setBuilderSchema({ fields: [] });
      setBuilderMeta({ name: '', description: '', is_active: true });
    }
  }, [selectedForm]);

  const saveDraft = useCallback(() => {
    // Placeholder: in future, create or update a draft formVersion with schema_data
    console.log('save draft', builderSchema);
  }, [builderSchema]);

  const publish = useCallback(() => {
    // Placeholder: will create a new active version and set it as current
    console.log('publish', builderSchema);
  }, [builderSchema]);

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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="builder">Builder</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <SettingsGrid
            rowData={filteredItems}
            columnDefs={colDefs}
            noRowsMessage="No forms found"
            onRowDoubleClicked={(item: Form) => {
              setSelectedFormId(item.id);
              setBuilderMeta({
                name: item.name,
                description: (item as any).description || '',
                is_active: !!(item as any).is_active
              });
              setActiveTab('builder');
            }}
            onGridReady={(params) => {
              params.api.setGridOption('context', { formVersions });
            }}
          />
        </TabsContent>

        <TabsContent value="builder" className="space-y-4">
          <div className="rounded-lg border p-4 space-y-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="form-name" className="text-right">Form Name *</Label>
              <Input id="form-name" value={builderMeta.name} onChange={(e) => setBuilderMeta({ ...builderMeta, name: e.target.value })} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="form-desc" className="text-right">Description</Label>
              <Input id="form-desc" value={builderMeta.description} onChange={(e) => setBuilderMeta({ ...builderMeta, description: e.target.value })} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="form-active" className="text-right">Active</Label>
              <div className="col-span-3 flex items-center gap-2">
                <input type="checkbox" id="form-active" checked={builderMeta.is_active} onChange={(e) => setBuilderMeta({ ...builderMeta, is_active: e.target.checked })} className="rounded" />
                <Label htmlFor="form-active" className="text-sm">Enabled</Label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedForm ? `Editing: ${selectedForm.name}` : 'Creating a new form'}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" type="button" onClick={async () => { await updateFormMeta(); saveDraft(); }} disabled={!builderMeta.name.trim()}>
                <FontAwesomeIcon icon={faFloppyDisk} className="mr-2" />Save draft
              </Button>
              <Button size="sm" variant="secondary" type="button" onClick={async () => { await updateFormMeta(); publish(); }} disabled={!builderMeta.name.trim()}>
                Publish
              </Button>
            </div>
          </div>

          <FormBuilder
            schema={builderSchema}
            onChange={setBuilderSchema}
            onSaveDraft={saveDraft}
            onPublish={publish}
            onPreview={() => setIsPreviewOpen(true)}
          />
        </TabsContent>
      </Tabs>

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
              <div className="text-sm text-muted-foreground">{(f as any).description}</div>
            </div>
          </div>
        )}
      />

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Form preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(builderSchema.fields || []).map((f: any) => (
              <div key={f.id} className="space-y-1">
                <div className="text-sm font-medium">{f.label}{f.required ? ' *' : ''}</div>
                {f.type === 'text' && (
                  <input className="w-full px-3 py-2 border rounded text-sm" placeholder={f.placeholder || ''} />
                )}
                {f.type === 'textarea' && (
                  <textarea className="w-full px-3 py-2 border rounded text-sm" placeholder={f.placeholder || ''} />
                )}
                {f.type === 'select' && (
                  <select className="w-full px-3 py-2 border rounded text-sm">
                    {(f.options || []).map((opt: string, i: number) => (
                      <option key={i}>{opt}</option>
                    ))}
                  </select>
                )}
                {f.type === 'checkbox' && (
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" />
                    {f.label}
                  </label>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </SettingsLayout>
  );
}

export default Forms;


