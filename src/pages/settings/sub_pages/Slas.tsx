import { useMemo, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import type { ColDef } from "ag-grid-community";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStopwatch, faPlus, faCircleQuestion } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/animated/Tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import whagonsLogo from "@/assets/whagons.svg";
import blockShuffleImg from "@/assets/block-3-shuffle.svg";
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
  description: string | null;
  color: string | null;
  enabled: boolean;
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

// React cell renderer: small centered color swatch
function ColorCellRenderer(params: any) {
  const value = (params?.value as string | null) || null;
  if (!value) return <>-</>;
  return (
    <div title={value} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
      <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 4, border: '1px solid #e5e7eb', background: value }} />
    </div>
  );
}

// React cell renderer: name with description below (muted)
function NameWithDescriptionRenderer(params: any) {
  const name = String(params?.value ?? '');
  const description = params?.data?.description as string | null | undefined;
  return (
    <div className="flex flex-col py-1">
      <div className="font-medium">{name}</div>
      {description ? (
        <div className="text-xs text-muted-foreground truncate">{description}</div>
      ) : null}
    </div>
  );
}

function Slas() {
  const dispatch = useDispatch<AppDispatch>();
  const [activeTab, setActiveTab] = useState<'slas' | 'alerts'>('slas');
  const [selectedSlaId, setSelectedSlaId] = useState<number | ''>('');
  const [isHelpOpen, setIsHelpOpen] = useState(false);

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
    searchFields: ["name", "description"] as (keyof SlaRow)[]
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

  // Hydrate from IndexedDB then refresh from API
  useEffect(() => {
    dispatch(genericActions.slas.getFromIndexedDB());
    dispatch(genericActions.slas.fetchFromAPI({ per_page: 1000 }));
    dispatch(genericActions.slaAlerts.getFromIndexedDB());
    dispatch(genericActions.slaAlerts.fetchFromAPI({ per_page: 1000 }));
  }, [dispatch]);

  const columns = useMemo<ColDef[]>(() => [
    {
      field: "name",
      headerName: "Name",
      flex: 2,
      minWidth: 240,
      cellRenderer: NameWithDescriptionRenderer,
      wrapText: true,
      autoHeight: true,
      cellStyle: { whiteSpace: 'normal' }
    },
    {
      field: "color",
      headerName: "Color",
      flex: 1,
      minWidth: 100,
      cellRenderer: ColorCellRenderer
    },
    { field: "enabled", headerName: "Enabled", flex: 1, minWidth: 100 },
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
    const description = String(form.get("description") || "").trim();
    const color = String(form.get("color") || "").trim();
    const enabled = form.get("enabled") === "on";
    const response = form.get("response_time");
    const resolution = form.get("resolution_time");
    if (!name) { setFormError("Name is required"); return; }
    const responseNum = Number(response);
    const resolutionNum = Number(resolution);
    if (!response || isNaN(responseNum) || responseNum < 1) { setFormError("Response time must be at least 1 minute"); return; }
    if (!resolution || isNaN(resolutionNum) || resolutionNum < 1) { setFormError("Resolution time must be at least 1 minute"); return; }
    const payload: Omit<SlaRow, 'id'> = {
      name,
      description,
      color,
      enabled,
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
      headerActions={
        <Button variant="outline" size="sm" onClick={() => setIsHelpOpen(true)}>
          <FontAwesomeIcon icon={faCircleQuestion} className="mr-2" />
          Help
        </Button>
      }
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
            rowHeight={44}
            zebraRows
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

      {/* Help Dialog */}
      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Understanding SLAs</DialogTitle>
            <DialogDescription>
              A quick guide to configuring Service Level Agreements and Alerts in Whagons.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <img src={whagonsLogo} alt="Whagons" className="rounded-md border bg-muted p-3 h-40 object-contain" />
            <img src={blockShuffleImg} alt="SLA overview" className="rounded-md border bg-muted p-3 h-40 object-contain" />
          </div>

          <div className="space-y-6 text-sm leading-6">
            <section className="space-y-2">
              <h3 className="text-base font-semibold">What is an SLA?</h3>
              <p>
                An SLA (Service Level Agreement) defines the expected response and resolution times for tasks or tickets.
                SLAs help teams meet customer expectations by tracking time-bound commitments and triggering alerts before breaches occur.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold">Core fields</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><span className="font-medium">Name</span>: The display name of the SLA.</li>
                <li><span className="font-medium">Description</span>: Optional context for when to use this SLA.</li>
                <li><span className="font-medium">Color</span>: A visual identifier used in the UI.</li>
                <li><span className="font-medium">Enabled</span>: Toggle to activate/deactivate the SLA without deleting it.</li>
                <li><span className="font-medium">Response (minutes)</span>: Target time to acknowledge or first respond.</li>
                <li><span className="font-medium">Resolution (minutes)</span>: Target time to fully resolve the issue.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold">Alerts</h3>
              <p>
                Alerts notify responsible people before an SLA is breached. Each alert is associated with a specific SLA.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><span className="font-medium">Time (minutes)</span>: When to trigger the alert relative to the SLA target.</li>
                <li><span className="font-medium">Type</span>: Choose <span className="font-mono">response</span> (acknowledgement) or <span className="font-mono">resolution</span> (full fix).</li>
                <li><span className="font-medium">Notify To</span>: Recipient group — <span className="font-mono">RESPONSIBLE</span>, <span className="font-mono">CREATED_BY</span>, <span className="font-mono">MANAGER</span>, or <span className="font-mono">TEAM</span>.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold">Best practices</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Start with realistic targets; refine using historical data.</li>
                <li>Create multiple alerts (e.g., 50%, 80%, 100%) to escalate urgency.</li>
                <li>Use colors consistently to differentiate SLA tiers (e.g., Bronze/Silver/Gold).</li>
                <li>Disable instead of deleting SLAs you may reuse later.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold">Example configurations</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border p-3">
                  <div className="font-medium">Standard Support</div>
                  <ul className="list-disc pl-5 mt-1 text-muted-foreground">
                    <li>Response: 60 min</li>
                    <li>Resolution: 480 min</li>
                    <li>Alerts: 30 min (response), 240 min (resolution)</li>
                  </ul>
                </div>
                <div className="rounded-md border p-3">
                  <div className="font-medium">Premium</div>
                  <ul className="list-disc pl-5 mt-1 text-muted-foreground">
                    <li>Response: 15 min</li>
                    <li>Resolution: 120 min</li>
                    <li>Alerts: 8 min (response), 60/90/110 min (resolution)</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold">How SLAs work in Whagons</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>SLAs and Alerts are cached locally (IndexedDB) for instant loading and offline use.</li>
                <li>Changes sync automatically via real-time updates; all clients see updates immediately.</li>
                <li>Optimistic updates keep the UI responsive; errors roll back safely.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold">FAQ</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><span className="font-medium">What happens if I change targets?</span> Existing tasks use the updated SLA immediately for future checks.</li>
                <li><span className="font-medium">Do disabled SLAs keep alerts?</span> Yes, alerts remain but won’t trigger until re-enabled.</li>
                <li><span className="font-medium">Who receives alerts?</span> Based on the <span className="font-mono">notify_to</span> option for each alert.</li>
              </ul>
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHelpOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Label htmlFor="description" className="text-right">Description</Label>
            <input id="description" name="description" className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="color" className="text-right">Color</Label>
            <input id="color" name="color" type="color" className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="enabled" className="text-right">Enabled</Label>
            <input id="enabled" name="enabled" type="checkbox" className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" />
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
              <Label htmlFor="edit-description" className="text-right">Description</Label>
              <input id="edit-description" name="description" defaultValue={editingItem.description ?? undefined} className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-color" className="text-right">Color</Label>
              <input id="edit-color" name="color" type="color" defaultValue={editingItem.color ?? '#000000'} className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-enabled" className="text-right">Enabled</Label>
              <input id="edit-enabled" name="enabled" type="checkbox" defaultChecked={!!editingItem.enabled} className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" />
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


