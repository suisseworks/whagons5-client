import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/store/store";
import { genericActions } from "@/store/genericSlices";
import { faBriefcase } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import {
  SettingsLayout,
  SettingsGrid,
  useSettingsState,
  TextField,
  SelectField,
  CheckboxField,
  SettingsDialog,
  createActionsCellRenderer
} from "../components";

type JobPosition = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  level: 'executive' | 'director' | 'manager' | 'senior' | 'junior';
  reports_to_position_id?: string | null;
  is_leadership?: boolean;
  is_active?: boolean;
};

function JobPositions() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  // Ensure data is loaded from IndexedDB and refreshed from API when page mounts
  useEffect(() => {
    dispatch((genericActions as any).jobPositions.getFromIndexedDB());
  }, [dispatch]);

  const {
    items,
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
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isDeleteDialogOpen,
    deletingItem,
    editingItem,
    handleEdit,
    handleDelete,
    handleCloseDeleteDialog
  } = useSettingsState<any>({
    entityName: 'jobPositions',
    searchFields: ['code','title','description']
  });

  const [createForm, setCreateForm] = useState({
    code: '',
    title: '',
    description: '',
    level: 'junior' as JobPosition['level'],
    is_leadership: false,
    is_active: true,
  });
  const [editForm, setEditForm] = useState({
    code: '',
    title: '',
    description: '',
    level: 'junior' as JobPosition['level'],
    is_leadership: false,
    is_active: true,
  });

  // Hydrate edit form when editingItem changes
  useEffect(() => {
    if (editingItem) {
      setEditForm({
        code: (editingItem as any).code || '',
        title: (editingItem as any).title || '',
        description: (editingItem as any).description || '',
        level: ((editingItem as any).level || 'junior') as any,
        is_leadership: !!(editingItem as any).is_leadership,
        is_active: (editingItem as any).is_active !== false,
      });
    }
  }, [editingItem]);

  const columns = useMemo(() => [
    { field: 'code', headerName: 'Code', width: 140 },
    { field: 'title', headerName: 'Title', flex: 1.5, minWidth: 200 },
    { field: 'level', headerName: 'Level', width: 130 },
    { field: 'is_leadership', headerName: 'Leadership', width: 120, valueGetter: (p: any) => !!p.data?.is_leadership, cellRenderer: (p: any) => (p?.data?.is_leadership ? 'Yes' : 'No') },
    { field: 'is_active', headerName: 'Active', width: 100, valueGetter: (p: any) => !!p.data?.is_active, cellRenderer: (p: any) => (p?.data?.is_active ? 'Yes' : 'No') },
    {
      field: 'actions', headerName: 'Actions', width: 110,
      cellRenderer: createActionsCellRenderer({ onEdit: handleEdit, onDelete: handleDelete }),
      sortable: false, filter: false, resizable: false, pinned: 'right'
    }
  ], [handleEdit, handleDelete]);

  return (
    <SettingsLayout
      title="Job Positions"
      description="Manage organizational job positions"
      icon={faBriefcase}
      iconColor="#10b981"
      search={{
        placeholder: 'Search job positions...',
        value: searchQuery,
        onChange: (v: string) => { setSearchQuery(v); handleSearch(v); }
      }}
      loading={{ isLoading: loading, message: 'Loading job positions...' }}
      error={error ? { message: error, onRetry: () => window.location.reload() } : undefined}
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/settings/users')}>Manage Users</Button>
          <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>Add Position</Button>
        </div>
      }
      statistics={{
        title: 'Statistics',
        description: 'Overview',
        items: [ { label: 'Total Positions', value: items.length } ]
      }}
    >
      <SettingsGrid
        rowData={filteredItems}
        columnDefs={columns as any}
        noRowsMessage="No positions found"
        onRowDoubleClicked={(row: any) => handleEdit((row as any)?.data ?? row)}
      />

      <SettingsDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        type="create"
        title="Add Job Position"
        description="Create a new job position."
        onSubmit={async (e: any) => {
          e.preventDefault();
          await createItem({
            code: createForm.code,
            title: createForm.title,
            description: createForm.description || null,
            level: createForm.level,
            is_leadership: !!createForm.is_leadership,
            is_active: !!createForm.is_active
          } as any);
          setCreateForm({ code: '', title: '', description: '', level: 'junior', is_leadership: false, is_active: true });
        }}
        isSubmitting={isSubmitting}
        error={formError}
      >
        <div className="grid gap-4">
          <TextField id="code" label="Code" value={createForm.code} onChange={(v) => setCreateForm(p => ({ ...p, code: v }))} required />
          <TextField id="title" label="Title" value={createForm.title} onChange={(v) => setCreateForm(p => ({ ...p, title: v }))} required />
          <TextField id="description" label="Description" value={createForm.description} onChange={(v) => setCreateForm(p => ({ ...p, description: v }))} />
          <SelectField
            id="level"
            label="Level"
            value={createForm.level}
            onChange={(v) => setCreateForm(p => ({ ...p, level: v as any }))}
            options={[
              { value: 'executive', label: 'Executive' },
              { value: 'director', label: 'Director' },
              { value: 'manager', label: 'Manager' },
              { value: 'senior', label: 'Senior' },
              { value: 'junior', label: 'Junior' },
            ]}
          />
          <CheckboxField id="is_leadership" label="Leadership" checked={!!createForm.is_leadership} onChange={(c) => setCreateForm(p => ({ ...p, is_leadership: c }))} />
          <CheckboxField id="is_active" label="Active" checked={!!createForm.is_active} onChange={(c) => setCreateForm(p => ({ ...p, is_active: c }))} />
        </div>
      </SettingsDialog>

      <SettingsDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        type="edit"
        title="Edit Job Position"
        description="Update the job position."
        onSubmit={async (e: any) => {
          e.preventDefault();
          const id = (editingItem as any)?.id;
          if (!id) {
            // surface a friendly error if id is missing
            (window as any).console?.warn?.('Edit submit without id', editingItem);
            return;
          }
          await updateItem(id, {
            code: editForm.code,
            title: editForm.title,
            description: editForm.description || null,
            level: editForm.level,
            is_leadership: !!editForm.is_leadership,
            is_active: !!editForm.is_active
          } as any);
        }}
        isSubmitting={isSubmitting}
        error={formError}
      >
        <div className="grid gap-4">
          <TextField id="edit-code" label="Code" value={editForm.code} onChange={(v) => setEditForm(p => ({ ...p, code: v }))} required />
          <TextField id="edit-title" label="Title" value={editForm.title} onChange={(v) => setEditForm(p => ({ ...p, title: v }))} required />
          <TextField id="edit-description" label="Description" value={editForm.description} onChange={(v) => setEditForm(p => ({ ...p, description: v }))} />
          <SelectField
            id="edit-level"
            label="Level"
            value={editForm.level}
            onChange={(v) => setEditForm(p => ({ ...p, level: v as any }))}
            options={[
              { value: 'executive', label: 'Executive' },
              { value: 'director', label: 'Director' },
              { value: 'manager', label: 'Manager' },
              { value: 'senior', label: 'Senior' },
              { value: 'junior', label: 'Junior' },
            ]}
          />
          <CheckboxField id="edit-is_leadership" label="Leadership" checked={!!editForm.is_leadership} onChange={(c) => setEditForm(p => ({ ...p, is_leadership: c }))} />
          <CheckboxField id="edit-is_active" label="Active" checked={!!editForm.is_active} onChange={(c) => setEditForm(p => ({ ...p, is_active: c }))} />
        </div>
      </SettingsDialog>

      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title="Delete Job Position"
        description={(deletingItem as any) ? `Are you sure you want to delete ${(((deletingItem as any).code) || '')} - ${(((deletingItem as any).title) || '')}? This action cannot be undone.` : undefined}
        onConfirm={() => (deletingItem as any) ? deleteItem(((deletingItem as any).id)) : undefined}
        isSubmitting={isSubmitting}
        error={formError}
        entityName="job position"
        entityData={deletingItem as any}
      />
    </SettingsLayout>
  );
}

export default JobPositions;


