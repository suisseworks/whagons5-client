import { useMemo, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import type { ColDef } from "ag-grid-community";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStopwatch, faPlus } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/animated/Tabs";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer
} from "../components";
import { AppDispatch } from "@/store/store";
import { genericActions } from "@/store/genericSlices";

type SlaRow = {
  id: number;
  name: string;
  response_time: number | null; // minutes
  resolution_time: number | null; // minutes
};

type SlaAlertRow = {
  id: number;
  sla_id: number;
  time: number; // minutes
  type: 'response' | 'resolution';
  notify_to: 'RESPONSIBLE' | 'CREATED_BY' | 'MANAGER' | 'TEAM';
};

function Slas() {
  const dispatch = useDispatch<AppDispatch>();
  const [activeTab, setActiveTab] = useState<'slas' | 'alerts'>('slas');
  const [selectedSlaId, setSelectedSlaId] = useState<number | ''>('');

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
    setFormError,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isDeleteDialogOpen,
    editingItem,
    deletingItem,
    handleEdit,
    handleDelete,
    handleCloseDeleteDialog
  } = useSettingsState<SlaRow>({
    entityName: "slas",
    searchFields: ["name"] as (keyof SlaRow)[]
  });

  const {
    items: alerts,
    filteredItems: filteredAlerts,
    loading: alertsLoading,
    error: alertsError,
    searchQuery: alertsSearch,
    setSearchQuery: setAlertsSearch,
    handleSearch: handleAlertsSearch,
    createItem: createAlert,
    updateItem: updateAlert,
    deleteItem: deleteAlert,
    isSubmitting: alertsSubmitting,
    formError: alertsFormError,
    setFormError: setAlertsFormError,
    isCreateDialogOpen: isCreateAlertOpen,
    setIsCreateDialogOpen: setIsCreateAlertOpen,
    isEditDialogOpen: isEditAlertOpen,
    setIsEditDialogOpen: setIsEditAlertOpen,
    isDeleteDialogOpen: isDeleteAlertOpen,
    editingItem: editingAlert,
    deletingItem: deletingAlert,
    handleEdit: handleEditAlert,
    handleDelete: handleDeleteAlert,
    handleCloseDeleteDialog: closeDeleteAlertDialog
  } = useSettingsState<SlaAlertRow>({
    entityName: "slaAlerts",
    searchFields: ["type", "notify_to"] as (keyof SlaAlertRow)[]
  });

  // Remove the loading useEffects, rely on pre-loaded state.

  const columns = useMemo<ColDef[]>(() => [
    { field: "name", headerName: "Name", flex: 2, minWidth: 200 },
    {
      field: "response_time",
      headerName: "Response (min)",
      width: 140,
      valueFormatter: (p) => (p.value == null ? "-" : String(p.value))
    },
    {
      field: "resolution_time",
      headerName: "Resolution (min)",
      width: 160,
      valueFormatter: (p) => (p.value == null ? "-" : String(p.value))
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 140,
      cellRenderer: createActionsCellRenderer({ onEdit: handleEdit, onDelete: handleDelete }),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: "right"
    }
  ], [handleEdit, handleDelete]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = new FormData(e.target as HTMLFormElement);
    const name = String(form.get("name") || "").trim();
    const response = form.get("response_time");
    const resolution = form.get("resolution_time");
    if (!name) { setFormError("Name is required"); return; }
    const responseNum = Number(response);
    const resolutionNum = Number(resolution);
    if (!response || isNaN(responseNum) || responseNum < 1) { setFormError("Response time must be at least 1 minute"); return; }
    if (!resolution || isNaN(resolutionNum) || resolutionNum < 1) { setFormError("Resolution time must be at least 1 minute"); return; }
    const payload: Omit<SlaRow, 'id'> = {
      name,
      response_time: responseNum,
      resolution_time: resolutionNum
    } as any;
    await createItem(payload as any);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const form = new FormData(e.target as HTMLFormElement);
    const updates: Partial<SlaRow> = {
      name: String(form.get("name") || editingItem.name).trim(),
      response_time: form.get("response_time") ? Math.max(1, Number(form.get("response_time"))) : editingItem.response_time,
      resolution_time: form.get("resolution_time") ? Math.max(1, Number(form.get("resolution_time"))) : editingItem.resolution_time
    };
    await updateItem(editingItem.id, updates as any);
  };

  // Default select first SLA on initial load
  useEffect(() => {
    if (selectedSlaId === '' && items.length) {
      setSelectedSlaId(items[0].id);
    }
  }, [items, selectedSlaId]);

  const alertColumns = useMemo<ColDef[]>(() => [
    { field: 'time', headerName: 'Time (min)', width: 130 },
    { field: 'type', headerName: 'Type', width: 130 },
    { field: 'notify_to', headerName: 'Notify To', width: 160 },
    {
      field: 'actions', headerName: 'Actions', width: 140,
      cellRenderer: createActionsCellRenderer({ onEdit: handleEditAlert, onDelete: handleDeleteAlert }),
      sortable: false, filter: false, resizable: false, pinned: 'right'
    }
  ], [handleEditAlert, handleDeleteAlert]);

  const visibleAlerts = useMemo(() => {
    const base = filteredAlerts;
    if (!selectedSlaId) return [] as SlaAlertRow[];
    return base.filter((a) => Number(a.sla_id) === Number(selectedSlaId));
  }, [filteredAlerts, selectedSlaId]);

  const handleCreateAlertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlaId) { setAlertsFormError('Select an SLA first'); return; }
    const form = new FormData(e.target as HTMLFormElement);
    const timeVal = Number(form.get('time'));
    const typeVal = String(form.get('type') || 'response');
    const notifyVal = String(form.get('notify_to') || 'RESPONSIBLE');
    if (!timeVal || timeVal < 1) { setAlertsFormError('Time must be at least 1'); return; }
    await createAlert({ sla_id: Number(selectedSlaId), time: timeVal, type: typeVal as any, notify_to: notifyVal as any } as any);
  };

  const handleEditAlertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlert) return;
    const form = new FormData(e.target as HTMLFormElement);
    const updates: Partial<SlaAlertRow> = {
      time: form.get('time') ? Math.max(1, Number(form.get('time'))) : (editingAlert as any).time,
      type: (form.get('type') as any) || (editingAlert as any).type,
      notify_to: (form.get('notify_to') as any) || (editingAlert as any).notify_to
    };
    await updateAlert((editingAlert as any).id, updates as any);
  };

  return (
    <SettingsLayout
      title="SLAs"
      description="Define and manage service level agreements"
      icon={faStopwatch}
      iconColor="#14b8a6"
      backPath="/settings"
    >
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="h-full flex-1 min-h-0 flex flex-col"
      >
        <TabsList>
          <TabsTrigger value="slas">SLAs</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="slas" className="flex-1 min-h-0 flex flex-col space-y-4">
          <div className="mt-1" />
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">Manage SLA definitions</div>
            <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
              <FontAwesomeIcon icon={faPlus} className="mr-2" />
              Add SLA
            </Button>
          </div>
          <SettingsGrid
            rowData={filteredItems}
            columnDefs={columns}
            noRowsMessage="No SLAs found"
            className="flex-1 min-h-0"
            height="100%"
            onRowDoubleClicked={handleEdit as any}
          />
        </TabsContent>

        <TabsContent value="alerts" className="flex-1 min-h-0 flex flex-col space-y-4">
          <div className="mt-1" />
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm">SLA:</div>
            <select
              className="border rounded-md px-2 py-1 bg-background"
              value={selectedSlaId}
              onChange={(e) => setSelectedSlaId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Select SLA…</option>
              {items.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div className="ml-auto" />
            <Button size="sm" onClick={() => setIsCreateAlertOpen(true)} disabled={!selectedSlaId}>
              <FontAwesomeIcon icon={faPlus} className="mr-2" />
              Add Alert
            </Button>
          </div>
          <SettingsGrid
            rowData={visibleAlerts}
            columnDefs={alertColumns}
            noRowsMessage={selectedSlaId ? "No alerts for this SLA" : "Select an SLA to view alerts"}
            className="flex-1 min-h-0"
            height="100%"
            onRowDoubleClicked={handleEditAlert as any}
          />
        </TabsContent>
      </Tabs>

      <SettingsDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        type="create"
        title="Add SLA"
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
      >
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name *</Label>
            <input id="name" name="name" className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="response_time" className="text-right">Response (min) *</Label>
            <input id="response_time" name="response_time" type="number" min="1" required className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" placeholder="e.g. 30" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="resolution_time" className="text-right">Resolution (min) *</Label>
            <input id="resolution_time" name="resolution_time" type="number" min="1" required className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" placeholder="e.g. 240" />
          </div>
        </div>
      </SettingsDialog>

      <SettingsDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        type="edit"
        title="Edit SLA"
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={!editingItem}
      >
        {editingItem && (
          <div className="grid gap-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">Name *</Label>
              <input id="edit-name" name="name" defaultValue={editingItem.name} className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-response_time" className="text-right">Response (min)</Label>
              <input id="edit-response_time" name="response_time" type="number" min="1" defaultValue={editingItem.response_time ?? undefined} className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-resolution_time" className="text-right">Resolution (min)</Label>
              <input id="edit-resolution_time" name="resolution_time" type="number" min="1" defaultValue={editingItem.resolution_time ?? undefined} className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" />
            </div>
          </div>
        )}
      </SettingsDialog>

      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title="Delete SLA"
        entityName="SLA"
        entityData={deletingItem as any}
        onConfirm={() => deletingItem ? deleteItem(deletingItem.id) : undefined}
      />

      {/* Alerts: Create */}
      <SettingsDialog
        open={isCreateAlertOpen}
        onOpenChange={setIsCreateAlertOpen}
        type="create"
        title="Add SLA Alert"
        onSubmit={handleCreateAlertSubmit}
        isSubmitting={alertsSubmitting}
        error={alertsFormError}
        submitDisabled={!selectedSlaId}
      >
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="time" className="text-right">Time (min) *</Label>
            <input id="time" name="time" type="number" min="1" required className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" placeholder="e.g. 30" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">Type *</Label>
            <select id="type" name="type" className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" defaultValue="response">
              <option value="response">response</option>
              <option value="resolution">resolution</option>
            </select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="notify_to" className="text-right">Notify To *</Label>
            <select id="notify_to" name="notify_to" className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" defaultValue="RESPONSIBLE">
              <option value="RESPONSIBLE">RESPONSIBLE</option>
              <option value="CREATED_BY">CREATED_BY</option>
              <option value="MANAGER">MANAGER</option>
              <option value="TEAM">TEAM</option>
            </select>
          </div>
        </div>
      </SettingsDialog>

      {/* Alerts: Edit */}
      <SettingsDialog
        open={isEditAlertOpen}
        onOpenChange={setIsEditAlertOpen}
        type="edit"
        title="Edit SLA Alert"
        onSubmit={handleEditAlertSubmit}
        isSubmitting={alertsSubmitting}
        error={alertsFormError}
        submitDisabled={!editingAlert}
      >
        {editingAlert && (
          <div className="grid gap-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-time" className="text-right">Time (min) *</Label>
              <input id="edit-time" name="time" type="number" min="1" defaultValue={(editingAlert as any).time} className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-type" className="text-right">Type *</Label>
              <select id="edit-type" name="type" className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" defaultValue={(editingAlert as any).type}>
                <option value="response">response</option>
                <option value="resolution">resolution</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-notify_to" className="text-right">Notify To *</Label>
              <select id="edit-notify_to" name="notify_to" className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" defaultValue={(editingAlert as any).notify_to}>
                <option value="RESPONSIBLE">RESPONSIBLE</option>
                <option value="CREATED_BY">CREATED_BY</option>
                <option value="MANAGER">MANAGER</option>
                <option value="TEAM">TEAM</option>
              </select>
            </div>
          </div>
        )}
      </SettingsDialog>

      {/* Alerts: Delete */}
      <SettingsDialog
        open={isDeleteAlertOpen}
        onOpenChange={closeDeleteAlertDialog}
        type="delete"
        title="Delete SLA Alert"
        entityName="SLA Alert"
        entityData={deletingAlert as any}
        onConfirm={() => deletingAlert ? deleteAlert((deletingAlert as any).id) : undefined}
      />
    </SettingsLayout>
  );
}

export default Slas;


