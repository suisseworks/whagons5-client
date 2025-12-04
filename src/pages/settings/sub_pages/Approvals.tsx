import { useMemo, useCallback, useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { faSquareCheck, faUsers } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Approval, Status, ApprovalApprover } from "@/store/types";
import { genericActions } from "@/store/genericSlices";
import type { AppDispatch } from "@/store/store";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/animated/Tabs";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer,
  ApprovalApproversManager,
  TextField,
  TextAreaField,
  SelectField,
  CheckboxField,
} from "../components";

// Compact name/description cell similar to Teams with type indicator (S/P)
const NameCell = (props: ICellRendererParams) => {
  const name = props.value as string;
  const description = props.data?.description as string | null | undefined;
  const isActive = props.data?.is_active !== false;
  const typeRaw = String((props.data?.approval_type || '') as string).toUpperCase();
  const isParallel = typeRaw === 'PARALLEL';
  const letter = isParallel ? 'P' : 'S';
  const color = isParallel ? 'bg-emerald-500' : 'bg-blue-500';
  return (
    <div className="flex items-center space-x-3 h-full">
      <div className={`h-6 w-6 rounded-full ${color} text-white text-xs font-semibold flex items-center justify-center shrink-0`}>{letter}</div>
      <div className="flex flex-col leading-tight">
        <span className={`truncate ${isActive ? '' : 'line-through opacity-60'}`}>{name}</span>
        {description ? (
          <span className={`text-xs text-muted-foreground truncate ${isActive ? '' : 'line-through opacity-60'}`}>{description}</span>
        ) : null}
      </div>
    </div>
  );
};

function Approvals() {
  const dispatch = useDispatch<AppDispatch>();
  const { value: statuses } = useSelector((state: RootState) => state.statuses);

  const {
    filteredItems,
    loading,
    error,
    handleEdit,
    deleteItem,
    isDeleteDialogOpen,
    handleDelete,
    handleCloseDeleteDialog,
    deletingItem,
    isSubmitting,
    formError,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    setEditingItem,
    editingItem,
    createItem,
    updateItem,
  } = useSettingsState<Approval>({
    entityName: 'approvals',
    searchFields: ['name', 'description'] as any,
  });

  const statusIdToName = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of (statuses as unknown as Status[]) || []) map.set(s.id, s.name);
    return map;
  }, [statuses]);

  const renderDeadline = useCallback((type: string, value?: string | null) => {
    if (!value) return '-';
    if (type === 'hours') return `${value} h`;
    if (type === 'date') return value;
    return value;
  }, []);

  const [isApproversDialogOpen, setIsApproversDialogOpen] = useState(false);
  const [approversApproval, setApproversApproval] = useState<Approval | null>(null);
  const { value: approvalApprovers } = useSelector((s: RootState) => s.approvalApprovers) as { value: ApprovalApprover[] };

  const approverCountByApproval = useMemo(() => {
    const map = new Map<number, number>();
    for (const a of (approvalApprovers || [])) {
      const aid = Number((a as any)?.approval_id ?? (a as any)?.approvalId);
      if (!Number.isFinite(aid)) continue;
      map.set(aid, (map.get(aid) || 0) + 1);
    }
    return map;
  }, [approvalApprovers]);

  const openManageApprovers = useCallback((approval: Approval) => {
    setApproversApproval(approval);
    setIsApproversDialogOpen(true);
  }, []);

  const colDefs = useMemo<ColDef[]>(() => [
    {
      field: 'name',
      headerName: 'Approval',
      flex: 1.2,
      minWidth: 220,
      cellRenderer: NameCell,
    },
  
    {
      field: 'require_all',
      headerName: 'Requirement',
      flex: 1,
      minWidth: 150,
      cellRenderer: (p: ICellRendererParams) => {
        const requireAll = !!p?.data?.require_all;
        const min = p?.data?.minimum_approvals as number | null | undefined;
        return requireAll ? 'All approvers' : (min ? `Minimum ${min}` : 'Minimum N/A');
      },
    },
    {
      field: 'approval_type',
      headerName: 'Approval Type',
      width: 130,
      cellRenderer: (p: ICellRendererParams) => {
        const type = String(p?.data?.approval_type || '').toUpperCase();
        return type === 'PARALLEL' ? 'Parallel' : 'Sequential';
      },
    },
    {
      field: 'trigger_type',
      headerName: 'Trigger',
      width: 140,
    },
    
    {
      field: 'require_rejection_comment',
      headerName: 'Require Comment',
      width: 130,
      cellRenderer: (p: ICellRendererParams) => (p?.data?.require_rejection_comment ? 'Yes' : 'No'),
    },
    {
      field: 'block_editing_during_approval',
      headerName: 'Block Editing',
      width: 120,
      cellRenderer: (p: ICellRendererParams) => (p?.data?.block_editing_during_approval ? 'Yes' : 'No'),
    },
    {
      field: 'deadline_type',
      headerName: 'Deadline',
      flex: 1,
      minWidth: 140,
      cellRenderer: (p: ICellRendererParams) => renderDeadline(p?.data?.deadline_type, p?.data?.deadline_value),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 220,
      cellRenderer: createActionsCellRenderer({
        customActions: [{
          icon: faUsers,
          label: (row: any) => {
            const count = approverCountByApproval.get(Number(row?.id)) || 0;
            return count > 0 ? `Approvers (${count})` : 'Approvers';
          },
          variant: 'outline',
          onClick: (row: any) => openManageApprovers(row as Approval),
          className: 'p-1 h-7 relative flex items-center justify-center'
        }],
        onEdit: handleEdit,
        onDelete: handleDelete,
      }),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right',
    },
  ], [handleEdit, handleDelete, renderDeadline, statusIdToName, approverCountByApproval, openManageApprovers]);

  // Form state
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
    approval_type: 'SEQUENTIAL' as 'SEQUENTIAL' | 'PARALLEL',
    require_all: true,
    minimum_approvals: '' as number | string | '',
    trigger_type: 'ON_CREATE' as 'ON_CREATE' | 'ON_STATUS_CHANGE' | 'MANUAL' | 'CONDITIONAL',
    trigger_status_id: 'none' as number | 'none',
    require_rejection_comment: false,
    block_editing_during_approval: false,
    deadline_type: 'hours' as 'hours' | 'date',
    deadline_value: '',
    is_active: true,
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    approval_type: 'SEQUENTIAL' as 'SEQUENTIAL' | 'PARALLEL',
    require_all: true,
    minimum_approvals: '' as number | string | '',
    trigger_type: 'ON_CREATE' as 'ON_CREATE' | 'ON_STATUS_CHANGE' | 'MANUAL' | 'CONDITIONAL',
    trigger_status_id: 'none' as number | 'none',
    require_rejection_comment: false,
    block_editing_during_approval: false,
    deadline_type: 'hours' as 'hours' | 'date',
    deadline_value: '',
    is_active: true,
  });

  // Populate edit form when editingItem changes
  useEffect(() => {
    const item = editingItem as Approval | null;
    if (!item) return;
    setEditFormData({
      name: item.name || '',
      description: item.description || '',
      approval_type: (item.approval_type as any) || 'SEQUENTIAL',
      require_all: !!item.require_all,
      minimum_approvals: item.minimum_approvals ?? '',
      trigger_type: (item.trigger_type as any) || 'ON_CREATE',
      trigger_status_id: (item.trigger_status_id ?? 'none') as any,
      require_rejection_comment: !!item.require_rejection_comment,
      block_editing_during_approval: !!item.block_editing_during_approval,
      deadline_type: (item.deadline_type as any) || 'hours',
      deadline_value: item.deadline_value || '',
      is_active: !!item.is_active,
    });
  }, [editingItem]);

  const handleQuickEdit = useCallback((item: Approval) => {
    if (!item) return;
    setEditFormData({
      name: item.name || '',
      description: item.description || '',
      approval_type: (item.approval_type as any) || 'SEQUENTIAL',
      require_all: !!item.require_all,
      minimum_approvals: item.minimum_approvals ?? '',
      trigger_type: (item.trigger_type as any) || 'ON_CREATE',
      trigger_status_id: (item.trigger_status_id ?? 'none') as any,
      require_rejection_comment: !!item.require_rejection_comment,
      block_editing_during_approval: !!item.block_editing_during_approval,
      deadline_type: (item.deadline_type as any) || 'hours',
      deadline_value: item.deadline_value || '',
      is_active: !!item.is_active,
    });
    setEditingItem(item);
    setIsEditDialogOpen(true);
  }, [setEditingItem, setIsEditDialogOpen]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.name.trim()) throw new Error('Name is required');
    const payload: any = {
      name: createFormData.name.trim(),
      description: createFormData.description?.trim() || null,
      approval_type: createFormData.approval_type,
      require_all: !!createFormData.require_all,
      minimum_approvals: createFormData.require_all ? null : (createFormData.minimum_approvals === '' ? null : Number(createFormData.minimum_approvals)),
      trigger_type: createFormData.trigger_type,
      trigger_status_id: createFormData.trigger_status_id === 'none' ? null : Number(createFormData.trigger_status_id),
      require_rejection_comment: !!createFormData.require_rejection_comment,
      block_editing_during_approval: !!createFormData.block_editing_during_approval,
      deadline_type: createFormData.deadline_type,
      deadline_value: createFormData.deadline_value || null,
      is_active: !!createFormData.is_active,
      deleted_at: null,
    };
    await createItem(payload);
    setCreateFormData({
      name: '', description: '', approval_type: 'SEQUENTIAL', require_all: true, minimum_approvals: '', trigger_type: 'ON_CREATE', trigger_status_id: 'none', require_rejection_comment: false, block_editing_during_approval: false, deadline_type: 'hours', deadline_value: '', is_active: true,
    });
  };

  const handleEditSubmit = async (e: React.FormEvent, editingItem?: Approval | null) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editFormData.name.trim()) throw new Error('Name is required');
    const updates: any = {
      name: editFormData.name.trim(),
      description: editFormData.description?.trim() || null,
      approval_type: editFormData.approval_type,
      require_all: !!editFormData.require_all,
      minimum_approvals: editFormData.require_all ? null : (editFormData.minimum_approvals === '' ? null : Number(editFormData.minimum_approvals)),
      trigger_type: editFormData.trigger_type,
      trigger_status_id: editFormData.trigger_status_id === 'none' ? null : Number(editFormData.trigger_status_id),
      require_rejection_comment: !!editFormData.require_rejection_comment,
      block_editing_during_approval: !!editFormData.block_editing_during_approval,
      deadline_type: editFormData.deadline_type,
      deadline_value: editFormData.deadline_value || null,
      is_active: !!editFormData.is_active,
    };
    await updateItem((editingItem as any).id, updates);
  };

  // Initial load: hydrate from IndexedDB then refresh from API
  useEffect(() => {
    dispatch(genericActions.approvals.getFromIndexedDB());
    dispatch(genericActions.approvals.fetchFromAPI());
    // Load approvers for counts and manager
    dispatch(genericActions.approvalApprovers.getFromIndexedDB());
    dispatch(genericActions.approvalApprovers.fetchFromAPI());
    // Ensure statuses available for name mapping
    dispatch(genericActions.statuses.getFromIndexedDB());
    dispatch(genericActions.statuses.fetchFromAPI());
    // Load users and roles for approver selection UI
    dispatch(genericActions.users.getFromIndexedDB());
    dispatch(genericActions.users.fetchFromAPI());
    dispatch(genericActions.roles.getFromIndexedDB());
    dispatch(genericActions.roles.fetchFromAPI());
  }, [dispatch]);

  return (
    <div className="p-4 pt-0 h-full">
      <SettingsLayout
        title="Approvals"
        description="Configure task approvals"
        icon={faSquareCheck}
        iconColor="#10b981"
        loading={{ isLoading: loading, message: "Loading approvals..." }}
        error={error ? { message: error, onRetry: () => window.location.reload() } : undefined}
        headerActions={
          <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
            <FontAwesomeIcon icon={faPlus} className="mr-2" />
            Add Approval
          </Button>
        }
      >
        <div className="flex h-full flex-col">
          <div className="flex-1 min-h-0">
            <SettingsGrid
              rowData={filteredItems}
              columnDefs={colDefs}
              noRowsMessage="No approvals found"
              rowSelection="single"
              onRowDoubleClicked={(row: any) => handleQuickEdit(row?.data ?? row)}
            />
          </div>
        </div>
      </SettingsLayout>

      {/* Create Approval Dialog */}
      <SettingsDialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            setCreateFormData({ name: '', description: '', approval_type: 'SEQUENTIAL', require_all: true, minimum_approvals: '', trigger_type: 'ON_CREATE', trigger_status_id: 'none', require_rejection_comment: false, block_editing_during_approval: false, deadline_type: 'hours', deadline_value: '', is_active: true });
          }
        }}
        type="create"
        title="Add New Approval"
        description="Define an approval configuration."
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting}
      >
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <div className="grid gap-4 min-h-[420px]">
              <TextField id="name" label="Name" value={createFormData.name} onChange={(v) => setCreateFormData(p => ({ ...p, name: v }))} required />
              <TextAreaField id="description" label="Description" value={createFormData.description} onChange={(v) => setCreateFormData(p => ({ ...p, description: v }))} />
              <CheckboxField id="is_active" label="Active" checked={!!createFormData.is_active} onChange={(c) => setCreateFormData(p => ({ ...p, is_active: c }))} />
            </div>
          </TabsContent>
          <TabsContent value="rules">
            <div className="grid gap-4 min-h-[420px]">
              <SelectField id="approval_type" label="Approval Type" value={createFormData.approval_type} onChange={(v) => setCreateFormData(p => ({ ...p, approval_type: v as any }))} options={[{ value: 'SEQUENTIAL', label: 'Sequential' }, { value: 'PARALLEL', label: 'Parallel' }]} />
              <CheckboxField id="require_all" label="Require all approvers" checked={!!createFormData.require_all} onChange={(c) => setCreateFormData(p => ({ ...p, require_all: c }))} />
              {!createFormData.require_all && (
                <TextField id="minimum_approvals" label="Minimum approvals" type="number" value={String(createFormData.minimum_approvals)} onChange={(v) => setCreateFormData(p => ({ ...p, minimum_approvals: v }))} />
              )}
              <SelectField id="trigger_type" label="Trigger Type" value={createFormData.trigger_type} onChange={(v) => setCreateFormData(p => ({ ...p, trigger_type: v as any }))} options={[{ value: 'ON_CREATE', label: 'On Create' }, { value: 'ON_STATUS_CHANGE', label: 'On Status Change' }, { value: 'MANUAL', label: 'Manual' }, { value: 'CONDITIONAL', label: 'Conditional' }]} />
              {createFormData.trigger_type === 'ON_STATUS_CHANGE' && (
                <SelectField id="trigger_status_id" label="Trigger Status" value={createFormData.trigger_status_id} onChange={(v) => setCreateFormData(p => ({ ...p, trigger_status_id: (v as any) }))} options={[{ value: 'none', label: 'None' }, ...((statuses as unknown as Status[]) || []).map(s => ({ value: s.id, label: s.name }))]} />
              )}
              <CheckboxField id="require_rejection_comment" label="Require rejection comment" checked={!!createFormData.require_rejection_comment} onChange={(c) => setCreateFormData(p => ({ ...p, require_rejection_comment: c }))} />
              <CheckboxField id="block_editing_during_approval" label="Block editing during approval" checked={!!createFormData.block_editing_during_approval} onChange={(c) => setCreateFormData(p => ({ ...p, block_editing_during_approval: c }))} />
              <SelectField id="deadline_type" label="Deadline Type" value={createFormData.deadline_type} onChange={(v) => setCreateFormData(p => ({ ...p, deadline_type: v as any }))} options={[{ value: 'hours', label: 'Hours' }, { value: 'date', label: 'Date' }]} />
              <TextField id="deadline_value" label={createFormData.deadline_type === 'hours' ? 'Deadline (hours)' : 'Deadline (date)'} type={createFormData.deadline_type === 'hours' ? 'number' : 'date'} value={createFormData.deadline_value} onChange={(v) => setCreateFormData(p => ({ ...p, deadline_value: v }))} />
            </div>
          </TabsContent>
        </Tabs>
      </SettingsDialog>

      {/* Edit Approval Dialog */}
      <SettingsDialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditFormData({ name: '', description: '', approval_type: 'SEQUENTIAL', require_all: true, minimum_approvals: '', trigger_type: 'ON_CREATE', trigger_status_id: 'none', require_rejection_comment: false, block_editing_during_approval: false, deadline_type: 'hours', deadline_value: '', is_active: true });
          }
        }}
        type="edit"
        title="Edit Approval"
        description="Update the approval configuration."
        onSubmit={(e) => handleEditSubmit(e, editingItem as any)}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting}
      >
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <div className="grid gap-4 min-h-[420px]">
              <TextField id="edit-name" label="Name" value={editFormData.name} onChange={(v) => setEditFormData(p => ({ ...p, name: v }))} required />
              <TextAreaField id="edit-description" label="Description" value={editFormData.description} onChange={(v) => setEditFormData(p => ({ ...p, description: v }))} />
              <CheckboxField id="edit-is_active" label="Active" checked={!!editFormData.is_active} onChange={(c) => setEditFormData(p => ({ ...p, is_active: c }))} />
            </div>
          </TabsContent>
          <TabsContent value="rules">
            <div className="grid gap-4 min-h-[420px]">
              <SelectField id="edit-approval_type" label="Approval Type" value={editFormData.approval_type} onChange={(v) => setEditFormData(p => ({ ...p, approval_type: v as any }))} options={[{ value: 'SEQUENTIAL', label: 'Sequential' }, { value: 'PARALLEL', label: 'Parallel' }]} />
              <CheckboxField id="edit-require_all" label="Require all approvers" checked={!!editFormData.require_all} onChange={(c) => setEditFormData(p => ({ ...p, require_all: c }))} />
              {!editFormData.require_all && (
                <TextField id="edit-minimum_approvals" label="Minimum approvals" type="number" value={String(editFormData.minimum_approvals)} onChange={(v) => setEditFormData(p => ({ ...p, minimum_approvals: v }))} />
              )}
              <SelectField id="edit-trigger_type" label="Trigger Type" value={editFormData.trigger_type} onChange={(v) => setEditFormData(p => ({ ...p, trigger_type: v as any }))} options={[{ value: 'ON_CREATE', label: 'On Create' }, { value: 'ON_STATUS_CHANGE', label: 'On Status Change' }, { value: 'MANUAL', label: 'Manual' }, { value: 'CONDITIONAL', label: 'Conditional' }]} />
              {editFormData.trigger_type === 'ON_STATUS_CHANGE' && (
                <SelectField id="edit-trigger_status_id" label="Trigger Status" value={editFormData.trigger_status_id} onChange={(v) => setEditFormData(p => ({ ...p, trigger_status_id: (v as any) }))} options={[{ value: 'none', label: 'None' }, ...((statuses as unknown as Status[]) || []).map(s => ({ value: s.id, label: s.name }))]} />
              )}
              <CheckboxField id="edit-require_rejection_comment" label="Require rejection comment" checked={!!editFormData.require_rejection_comment} onChange={(c) => setEditFormData(p => ({ ...p, require_rejection_comment: c }))} />
              <CheckboxField id="edit-block_editing_during_approval" label="Block editing during approval" checked={!!editFormData.block_editing_during_approval} onChange={(c) => setEditFormData(p => ({ ...p, block_editing_during_approval: c }))} />
              <SelectField id="edit-deadline_type" label="Deadline Type" value={editFormData.deadline_type} onChange={(v) => setEditFormData(p => ({ ...p, deadline_type: v as any }))} options={[{ value: 'hours', label: 'Hours' }, { value: 'date', label: 'Date' }]} />
              <TextField id="edit-deadline_value" label={editFormData.deadline_type === 'hours' ? 'Deadline (hours)' : 'Deadline (date)'} type={editFormData.deadline_type === 'hours' ? 'number' : 'date'} value={editFormData.deadline_value} onChange={(v) => setEditFormData(p => ({ ...p, deadline_value: v }))} />
            </div>
          </TabsContent>
        </Tabs>
      </SettingsDialog>

      {/* Delete Approval Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title="Delete Approval"
        description={deletingItem ? `Are you sure you want to delete the approval "${deletingItem.name}"? This action cannot be undone.` : undefined}
        onConfirm={() => deletingItem ? deleteItem(deletingItem.id) : undefined}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={!deletingItem}
        entityName="approval"
        entityData={deletingItem}
        renderEntityPreview={(a: Approval) => (
          <div>
            <div className="font-medium">{a.name}</div>
            {a.description && (
              <div className="text-sm text-muted-foreground">{a.description}</div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              Type: {a.approval_type} • Trigger: {a.trigger_type}
            </div>
          </div>
        )}
      />

      {/* Manage Approvers Dialog */}
      <ApprovalApproversManager
        open={isApproversDialogOpen}
        onOpenChange={(open) => { if (!open) { setIsApproversDialogOpen(false); setApproversApproval(null); } else { setIsApproversDialogOpen(true); } }}
        approval={approversApproval}
      />
    </div>
  );
}

export default Approvals;


