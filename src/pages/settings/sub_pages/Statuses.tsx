import { useEffect, useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faEdit, faTrash } from "@fortawesome/free-solid-svg-icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/animated/Tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SettingsGrid } from "@/pages/settings/components/SettingsGrid";
import type { ColDef } from "ag-grid-community";
import { RootState, AppDispatch } from "@/store/store";
import { genericActions } from "@/store/genericSlices";
import { SettingsDialog } from "@/pages/settings/components/SettingsDialog";
import { TextField, CheckboxField, SelectField } from "@/pages/settings/components/FormFields";
import { IconPicker } from "@/pages/settings/components/IconPicker";
import { SettingsLayout, createActionsCellRenderer } from "@/pages/settings/components";
import { faSitemap } from "@fortawesome/free-solid-svg-icons";
import { StatusIcon } from "@/pages/settings/components/StatusIcon";
import { VisualTransitions } from "@/pages/settings/components/VisualTransitions";
import { getCurrentTenant } from "@/api/whagonsApi";

function Statuses() {
  
  const dispatch = useDispatch<AppDispatch>();

  // Selectors
  const statuses = useSelector((s: RootState) => s.statuses.value) as any[];
  const statusTransitions = useSelector((s: RootState) => s.statusTransitions.value) as any[];
  const statusTransitionGroups = useSelector((s: RootState) => s.statusTransitionGroups.value) as any[];

  // Local UI state
  const [activeTab, setActiveTab] = useState<string>("statuses");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [transitionsView, setTransitionsView] = useState<'matrix' | 'visual'>('visual');
  const tenant = getCurrentTenant();

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formAction, setFormAction] = useState("");
  const [formColor, setFormColor] = useState("#888888");
  const [formIcon, setFormIcon] = useState("fas fa-circle");
  const [formInitial, setFormInitial] = useState(false);
  const [formSystem, setFormSystem] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [, setIsDeleting] = useState(false);
  // Toast removed
  // Backend enum values for status.action
  const allowedActions = ["NONE", "WORKING", "PAUSED", "FINISHED"] as const;

  // Toast removed

  
  // Load persisted view and group, and save changes
  useEffect(() => {
    // Load view
    const vk = `wh_status_view:${tenant || 'default'}`;
    const vv = localStorage.getItem(vk);
    if (vv === 'matrix' || vv === 'visual') setTransitionsView(vv);
  }, [tenant]);

  useEffect(() => {
    // Save view
    const vk = `wh_status_view:${tenant || 'default'}`;
    localStorage.setItem(vk, transitionsView);
  }, [transitionsView, tenant]);

  // Default or persisted selected group
  useEffect(() => {
    if (selectedGroupId != null) return;
    if (!statusTransitionGroups.length) return;
    const gk = `wh_status_group:${tenant || 'default'}`;
    const stored = localStorage.getItem(gk);
    const storedId = stored ? Number(stored) : null;
    let targetId: number | null = null;
    if (storedId && statusTransitionGroups.find((g: any) => Number(g.id) === storedId)) {
      targetId = storedId;
    } else {
      const def = statusTransitionGroups.find((g: any) => g.is_default) || statusTransitionGroups[0];
      targetId = def ? def.id : null;
    }
    if (targetId != null) setSelectedGroupId(targetId);
  }, [statusTransitionGroups, selectedGroupId, tenant]);

  useEffect(() => {
    if (selectedGroupId == null) return;
    const gk = `wh_status_group:${tenant || 'default'}`;
    localStorage.setItem(gk, String(selectedGroupId));
  }, [selectedGroupId, tenant]);

  // back navigation removed from header; using SettingsLayout's backPath

  // Action handlers for kebab menu
  const handleEditClick = (row: any) => {
    setSelectedStatus(row);
    setFormName(row.name || "");
    setFormAction(row.action || "");
    setFormColor(row.color || "#888888");
    setFormIcon(row.icon ? (row.icon.startsWith('fas ') ? row.icon : `fas fa-${row.icon}`) : "fas fa-circle");
    setFormInitial(!!row.initial);
    setFormSystem(!!row.system);
    setFormError(null);
    setEditOpen(true);
  };

  const handleDeleteClick = (row: any) => {
    if (row?.system) {
      return;
    }
    setSelectedStatus(row);
    setDeleteOpen(true);
  };

  // (Make Initial action removed by request)

  // Columns for Statuses grid

  const columns = useMemo<ColDef[]>(() => [
    { headerName: "Name", field: "name", flex: 1, minWidth: 200, cellRenderer: (p: any) => {
      const name = p?.value;
      const color = p?.data?.color || '#6B7280';
      const iconStr: string = p?.data?.icon || 'fas fa-circle';
      return (
        <div className="flex items-center space-x-3 h-full">
          <StatusIcon icon={iconStr} color={color} />
          <span>{name}</span>
        </div>
      );
    } },
    { headerName: "Action", field: "action", flex: 1, minWidth: 140 },
    // Icon column removed; icon shown with color inside Name
    { headerName: "System", field: "system", width: 110 },
    {
      headerName: "Initial",
      field: "initial",
      width: 110,
      cellRenderer: (p: any) => {
        const checked = !!p?.value;
        const disabled = !!p?.data?.system; // prevent toggling system rows
        const id = p?.data?.id;
        const onToggle = async () => {
          if (!id) return;
          const next = !checked;
          // If setting this as initial, unset any other initial
          if (next) {
            const currentInitial = (statuses || []).find((s: any) => s.initial && s.id !== id);
            if (currentInitial) {
              dispatch(genericActions.statuses.updateAsync({ id: currentInitial.id, updates: { initial: false } }));
            }
          }
          dispatch(genericActions.statuses.updateAsync({ id, updates: { initial: next } }));
        };
        return (
          <Checkbox
            disabled={disabled}
            checked={checked}
            onCheckedChange={onToggle}
          />
        );
      }
    },
    
    {
      field: 'actions',
      headerName: 'Actions',
      colId: 'actions',
      minWidth: 180,
      suppressSizeToFit: true,
      pinned: 'right',
      cellRenderer: createActionsCellRenderer({
        customActions: [
          {
            icon: faEdit,
            variant: 'outline',
            onClick: handleEditClick,
            className: 'p-1 h-7 w-7'
          },
          {
            icon: faTrash,
            variant: 'destructive',
            onClick: handleDeleteClick,
            className: 'p-1 h-7 w-7',
            disabled: (row: any) => !!row?.system
          }
        ]
      }),
      sortable: false,
      filter: false,
      resizable: false
    }
  ], [dispatch, statuses]);

  // Derived map for fast lookup of transitions in selected group
  const transitionsByKey = useMemo(() => {
    if (!selectedGroupId) return new Set<string>();
    const set = new Set<string>();
    for (const t of statusTransitions) {
      if (Number(t.status_transition_group_id) === Number(selectedGroupId)) {
        set.add(`${Number(t.from_status)}->${Number(t.to_status)}`);
      }
    }
    return set;
  }, [statusTransitions, selectedGroupId]);

  // Filtered statuses for grid based on search query
  const filteredStatuses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return statuses;
    return statuses.filter((s: any) => {
      const name = String(s?.name || '').toLowerCase();
      const action = String(s?.action || '').toLowerCase();
      const icon = String(s?.icon || '').toLowerCase();
      return name.includes(q) || action.includes(q) || icon.includes(q);
    });
  }, [statuses, searchQuery]);

  const toggleTransition = async (fromId: number, toId: number) => {
    if (!selectedGroupId) return;
    const key = `${fromId}->${toId}`;
    const exists = transitionsByKey.has(key);
    if (exists) {
      // Find the transition row id to remove
      const row = statusTransitions.find((t: any) => Number(t.status_transition_group_id) === Number(selectedGroupId) && Number(t.from_status) === Number(fromId) && Number(t.to_status) === Number(toId));
      if (row) {
        dispatch(genericActions.statusTransitions.removeAsync(row.id));
      }
    } else {
      dispatch(genericActions.statusTransitions.addAsync({
        status_transition_group_id: selectedGroupId,
        from_status: fromId,
        to_status: toId
      }));
    }
  };

  const handleCreateGroup = () => {
    const name = window.prompt('New group name');
    if (!name) return;
    dispatch(genericActions.statusTransitionGroups.addAsync({ name, description: '', is_default: false, is_active: true } as any));
  };

  const handleRenameGroup = () => {
    if (!selectedGroupId) return;
    const current = statusTransitionGroups.find((g: any) => g.id === selectedGroupId);
    const name = window.prompt('Rename group', current?.name || '');
    if (!name) return;
    dispatch(genericActions.statusTransitionGroups.updateAsync({ id: selectedGroupId, updates: { name } }));
  };

  const handleDeleteGroup = () => {
    if (!selectedGroupId) return;
    const ok = window.confirm('Delete this group and its transitions?');
    if (!ok) return;
    dispatch(genericActions.statusTransitionGroups.removeAsync(selectedGroupId));
    setSelectedGroupId(null);
  };

  return (
    <SettingsLayout
      title="Statuses"
      description="Manage global statuses and transition rules"
      icon={faSitemap}
      iconColor="#f59e0b"
      backPath="/settings"
      search={{
        placeholder: "Search statuses...",
        value: searchQuery,
        onChange: setSearchQuery
      }}
      statistics={{
        title: "Status Overview",
        description: "Quick glance at your workflow setup",
        items: [
          { label: 'Total Statuses', value: statuses.length },
          { label: 'System Statuses', value: statuses.filter((s: any) => !!s.system).length },
          { label: 'Transition Groups', value: statusTransitionGroups.length },
          { label: selectedGroupId ? 'Transitions (Selected Group)' : 'Transitions (All)', value: selectedGroupId ? transitionsByKey.size : statusTransitions.length }
        ]
      }}
      headerActions={
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => {
            setFormName("");
            setFormAction("");
            setFormColor("#888888");
            setFormIcon("fas fa-circle");
            setFormInitial(false);
            setFormSystem(false);
            setFormError(null);
            setCreateOpen(true);
          }}>
            <FontAwesomeIcon icon={faPlus} className="mr-2" />
            Add Status
          </Button>
        </div>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="statuses">Statuses</TabsTrigger>
          <TabsTrigger value="transitions">Transitions</TabsTrigger>
        </TabsList>

        <TabsContent value="statuses" className="space-y-4">
          <SettingsGrid
            rowData={filteredStatuses}
            columnDefs={columns}
            height="520px"
            noRowsMessage="No statuses found"
            rowSelection="single"
            onSelectionChanged={(rows) => setSelectedStatus(rows?.[0] || null)}
            onRowDoubleClicked={(row) => {
              setSelectedStatus(row);
              setFormName(row.name || "");
              setFormAction(row.action || "");
              setFormColor(row.color || "#888888");
              setFormIcon(row.icon ? (row.icon.startsWith('fas ') ? row.icon : `fas fa-${row.icon}`) : "fas fa-circle");
              setFormInitial(!!row.initial);
              setFormSystem(!!row.system);
              setFormError(null);
              setEditOpen(true);
            }}
          />

          {/* Create Dialog */}
          <SettingsDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            type="create"
            title="Create Status"
            isSubmitting={isCreating}
            onSubmit={(e) => {
              e.preventDefault();
              if (!formName.trim()) { setFormError('Name is required'); return; }
              setFormError(null);

              (async () => {
                try {
                  setIsCreating(true);
                  // Enforce single initial
                  if (formInitial) {
                    const currentInitial = statuses.find((s: any) => s.initial === true);
                    if (currentInitial) {
                      await dispatch(genericActions.statuses.updateAsync({ id: currentInitial.id, updates: { initial: false } }));
                    }
                  }

                  const normalizedAction = (formAction || 'NONE').toUpperCase();
                  if (!allowedActions.includes(normalizedAction as any)) { setFormError('Invalid action'); return; }
                  const payload: any = {
                    name: formName.trim(),
                    action: normalizedAction,
                    color: formColor,
                    icon: formIcon,
                    system: !!formSystem,
                    initial: !!formInitial
                  };
                  const result: any = await dispatch(genericActions.statuses.addAsync(payload));
                  if (result?.meta?.requestStatus === 'rejected') {
                    setFormError(result?.payload || result?.error?.message || 'Failed to create');
                    return;
                  }
                  setCreateOpen(false);
                } finally {
                  setIsCreating(false);
                }
              })();
            }}
            error={formError}
          >
            <TextField label="Name" value={formName} onChange={setFormName} required />
            <SelectField label="Action" value={formAction || 'NONE'} onChange={setFormAction} options={allowedActions.map(a => ({ value: a, label: a }))} />
            <TextField label="Color" value={formColor} onChange={setFormColor} type="color" />
            <IconPicker label="Icon" value={formIcon} onChange={setFormIcon} color={formColor} />
            <CheckboxField label="Initial" checked={formInitial} onChange={setFormInitial} />
            <CheckboxField label="System" checked={formSystem} onChange={setFormSystem} />
          </SettingsDialog>

          {/* Edit Dialog */}
          <SettingsDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            type="edit"
            title="Edit Status"
            isSubmitting={isUpdating}
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedStatus) return;
              if (!formName.trim()) { setFormError('Name is required'); return; }
              setFormError(null);

              (async () => {
                try {
                  setIsUpdating(true);
                  // Enforce single initial
                  if (formInitial) {
                    const othersInitial = statuses.find((s: any) => s.initial === true && s.id !== selectedStatus.id);
                    if (othersInitial) {
                      await dispatch(genericActions.statuses.updateAsync({ id: othersInitial.id, updates: { initial: false } }));
                    }
                  }

                  const normalizedAction = (formAction || selectedStatus?.action || 'NONE').toUpperCase();
                  if (!allowedActions.includes(normalizedAction as any)) { setFormError('Invalid action'); return; }
                  const updates: any = {
                    name: formName.trim(),
                    action: normalizedAction,
                    color: formColor,
                    icon: formIcon,
                    system: !!formSystem,
                    initial: !!formInitial
                  };
                  const result: any = await dispatch(genericActions.statuses.updateAsync({ id: selectedStatus.id, updates }));
                  if (result?.meta?.requestStatus === 'rejected') {
                    setFormError(result?.payload || result?.error?.message || 'Failed to update');
                    return;
                  }
                  setEditOpen(false);
                } finally {
                  setIsUpdating(false);
                }
              })();
            }}
            error={formError}
          >
            <TextField label="Name" value={formName} onChange={setFormName} required />
            <SelectField label="Action" value={formAction || 'NONE'} onChange={setFormAction} options={allowedActions.map(a => ({ value: a, label: a }))} />
            <TextField label="Color" value={formColor} onChange={setFormColor} type="color" />
            <IconPicker label="Icon" value={formIcon} onChange={setFormIcon} color={formColor} />
            <CheckboxField label="Initial" checked={formInitial} onChange={setFormInitial} />
            <CheckboxField label="System" checked={formSystem} onChange={setFormSystem} />
          </SettingsDialog>

          {/* Delete Dialog */}
          <SettingsDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            type="delete"
            title="Delete Status"
            entityName="status"
            entityData={selectedStatus}
            renderEntityPreview={(s: any) => (
              <div className="flex items-center justify-between">
                <div className="font-medium">{s?.name}</div>
                <span className="text-xs text-muted-foreground">{s?.action}</span>
              </div>
            )}
            onConfirm={async () => {
              if (!selectedStatus) return;
              if (selectedStatus.system) { setFormError('System statuses cannot be deleted'); return; }
              try {
                setIsDeleting(true);
                await dispatch(genericActions.statuses.removeAsync(selectedStatus.id));
                setDeleteOpen(false);
                setSelectedStatus(null);
              } finally {
                setIsDeleting(false);
              }
            }}
          />
        {/* toast removed */}
        </TabsContent>

        <TabsContent value="transitions" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold mr-2">Transitions</h2>
            <select
              className="border rounded-md px-2 py-1 bg-background"
              value={selectedGroupId ?? ''}
              onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="" disabled>Select group…</option>
              {statusTransitionGroups.map((g: any) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <Button size="sm" variant="secondary" onClick={handleCreateGroup}>New Group</Button>
            <Button size="sm" variant="secondary" onClick={handleRenameGroup} disabled={!selectedGroupId}>Rename</Button>
            <Button size="sm" variant="destructive" onClick={handleDeleteGroup} disabled={!selectedGroupId}>Delete</Button>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant={transitionsView === 'visual' ? 'default' : 'outline'}
                onClick={() => setTransitionsView('visual')}
              >
                Visual
              </Button>
              <Button
                size="sm"
                variant={transitionsView === 'matrix' ? 'default' : 'outline'}
                onClick={() => setTransitionsView('matrix')}
              >
                Matrix
              </Button>
            </div>
      </div>
          {transitionsView === 'matrix' ? (
            <div className="overflow-auto">
              <table className="min-w-max border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-background border p-2 text-left">From \\ To</th>
                    {statuses.map((to: any) => (
                      <th key={`to-${to.id}`} className="border p-2 whitespace-nowrap text-left">{to.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statuses.map((from: any) => (
                    <tr key={`from-${from.id}`}> 
                      <td className="sticky left-0 z-10 bg-background border p-2 font-medium whitespace-nowrap">{from.name}</td>
                      {statuses.map((to: any) => {
                        const key = `${from.id}->${to.id}`;
                        const checked = transitionsByKey.has(key);
                        const disabled = from.id === to.id; // same-state transition off
                        return (
                          <td key={`cell-${from.id}-${to.id}`} className="border p-2 text-center">
                            <Checkbox
                              disabled={disabled || !selectedGroupId}
                              checked={checked}
                              onCheckedChange={() => toggleTransition(from.id, to.id)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
    </div>
          ) : (
            <div
              className="rounded-md border p-4 overflow-auto"
              style={{
                // Subtle checkerboard background
                backgroundColor: 'transparent',
                backgroundImage:
                  'linear-gradient(45deg, rgba(0,0,0,0.05) 25%, transparent 25%), ' +
                  'linear-gradient(-45deg, rgba(0,0,0,0.05) 25%, transparent 25%), ' +
                  'linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.05) 75%), ' +
                  'linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.05) 75%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                minHeight: '520px'
              }}
            >
              <VisualTransitions
                statuses={statuses}
                transitions={statusTransitions.filter((t: any) => selectedGroupId ? t.status_transition_group_id === selectedGroupId : true)}
                onToggle={toggleTransition}
                selectedGroupId={selectedGroupId}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </SettingsLayout>
  );
}

export default Statuses;