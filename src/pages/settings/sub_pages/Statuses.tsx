import { useEffect, useMemo, useState, memo, useRef } from "react";
 
import { useDispatch, useSelector } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faEdit, faTrash } from "@fortawesome/free-solid-svg-icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SettingsGrid } from "@/pages/settings/components/SettingsGrid";
import type { ColDef } from "ag-grid-community";
import { RootState, AppDispatch } from "@/store/store";
import { genericActions } from "@/store/genericSlices";
import { SettingsDialog } from "@/pages/settings/components/SettingsDialog";
import { TextField, CheckboxField, FormField, SelectField } from "@/pages/settings/components/FormFields";
import { IconPicker } from "@/pages/settings/components/IconPicker";
import { SettingsLayout, createActionsCellRenderer } from "@/pages/settings/components";
import { faSitemap } from "@fortawesome/free-solid-svg-icons";
import { iconService } from "@/database/iconService";
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
  
  const [transitionsView, setTransitionsView] = useState<'matrix' | 'visual'>('matrix');
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
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  // Backend enum values for status.action
  const allowedActions = ["NONE", "WORKING", "PAUSED", "FINISHED"] as const;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Hydrate data (idempotent)
  useEffect(() => {
    dispatch(genericActions.statuses.getFromIndexedDB());
    dispatch(genericActions.statuses.fetchFromAPI({ per_page: 1000 }));
    dispatch(genericActions.statusTransitions.getFromIndexedDB());
    dispatch(genericActions.statusTransitions.fetchFromAPI({ per_page: 1000 }));
    dispatch(genericActions.statusTransitionGroups.getFromIndexedDB());
    dispatch(genericActions.statusTransitionGroups.fetchFromAPI({ per_page: 1000 }));
  }, [dispatch]);

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
      setToast({ type: 'error', message: 'System statuses cannot be deleted' });
      return;
    }
    setSelectedStatus(row);
    setDeleteOpen(true);
  };

  // (Make Initial action removed by request)

  // Columns for Statuses grid (read-only for now)
  const parseFaIconName = (iconStr: string): string => {
    if (!iconStr) return '';
    const faMatch = iconStr.match(/^(?:fas|far|fal|fat|fab|fad|fass)\s+fa-(.+)$/);
    if (faMatch) return faMatch[1];
    if (iconStr.startsWith('fa-')) return iconStr.substring(3);
    return iconStr;
  };

  const StatusIcon = ({ icon, color }: { icon: string; color: string }) => {
    const [def, setDef] = useState<any | null>(null);
    useEffect(() => {
      let mounted = true;
      (async () => {
        const name = parseFaIconName(icon);
        const loaded = await iconService.getIcon(name);
        if (mounted) setDef(loaded);
      })();
      return () => { mounted = false; };
    }, [icon]);
    if (def) {
      return <FontAwesomeIcon icon={def as any} className="w-4 h-4" style={{ color }} />;
    }
    return <span className="inline-block w-4 h-4 rounded-full border" style={{ backgroundColor: color }} />;
  };

  const columns = useMemo<ColDef[]>(() => [
    { headerName: "Name", field: "name", flex: 1, minWidth: 200, editable: (p: any) => !p?.data?.system, cellRenderer: (p: any) => {
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
    { headerName: "Action", field: "action", flex: 1, minWidth: 140, editable: (p: any) => !p?.data?.system, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: allowedActions } },
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
          <input type="checkbox" disabled={disabled} checked={checked} onChange={onToggle} />
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
            onCellValueChanged={(e) => {
              const id = e?.data?.id;
              if (!id) return;
              if (e?.data?.system) return; // protect system rows
              const field = e?.colDef?.field as string;
              let value = e?.newValue;
              if (!field) return;
              // Normalize inputs
              if (field === 'name' || field === 'action' || field === 'icon') {
                value = (value ?? '').toString();
                if (field === 'icon' && value && !value.startsWith('fa')) {
                  value = `fas fa-${value}`;
                }
                if (field === 'action') {
                  value = value.toUpperCase();
                  if (!allowedActions.includes(value)) return; // ignore invalid
                }
              }
              if (field === 'color') {
                const hex = (value ?? '').toString();
                const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
                if (!isHex) return; // ignore invalid
                value = hex;
              }
              dispatch(genericActions.statuses.updateAsync({ id, updates: { [field]: value } as any }));
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
                    setToast({ type: 'error', message: 'Failed to create status' });
                    return;
                  }
                  setCreateOpen(false);
                  setToast({ type: 'success', message: 'Status created' });
                } finally {
                  setIsCreating(false);
                }
              })();
            }}
            error={formError}
          >
            <TextField label="Name" value={formName} onChange={setFormName} required />
            <SelectField label="Action" value={formAction || 'NONE'} onChange={setFormAction} options={allowedActions.map(a => ({ value: a, label: a }))} />
            <FormField label="Color">
              <input type="color" value={formColor} onChange={(e) => setFormColor(e.target.value)} className="h-9 w-16 p-0 border rounded" />
            </FormField>
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
                    setToast({ type: 'error', message: 'Failed to update status' });
                    return;
                  }
                  setEditOpen(false);
                  setToast({ type: 'success', message: 'Status updated' });
                } finally {
                  setIsUpdating(false);
                }
              })();
            }}
            error={formError}
          >
            <TextField label="Name" value={formName} onChange={setFormName} required />
            <SelectField label="Action" value={formAction || 'NONE'} onChange={setFormAction} options={allowedActions.map(a => ({ value: a, label: a }))} />
            <FormField label="Color">
              <input type="color" value={formColor} onChange={(e) => setFormColor(e.target.value)} className="h-9 w-16 p-0 border rounded" />
            </FormField>
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
                setToast({ type: 'success', message: 'Status deleted' });
              } finally {
                setIsDeleting(false);
              }
            }}
          />
        {toast && (
          <div className={`fixed bottom-6 right-6 z-[9999] px-4 py-2 rounded shadow-md ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.message}
          </div>
        )}
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
                variant={transitionsView === 'matrix' ? 'default' : 'outline'}
                onClick={() => setTransitionsView('matrix')}
              >
                Matrix
              </Button>
              <Button
                size="sm"
                variant={transitionsView === 'visual' ? 'default' : 'outline'}
                onClick={() => setTransitionsView('visual')}
              >
                Visual
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
                            <input
                              type="checkbox"
                              disabled={disabled || !selectedGroupId}
                              checked={checked}
                              onChange={() => toggleTransition(from.id, to.id)}
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
            <VisualTransitions
              statuses={statuses}
              transitions={statusTransitions.filter((t: any) => selectedGroupId ? t.status_transition_group_id === selectedGroupId : true)}
              onToggle={toggleTransition}
              selectedGroupId={selectedGroupId}
            />
          )}
        </TabsContent>
      </Tabs>
    </SettingsLayout>
  );
}

export default Statuses;
// Simple visual transitions view using SVG lines between status nodes
const VisualTransitions = memo(function VisualTransitions({
  statuses,
  transitions,
  onToggle,
  selectedGroupId
}: {
  statuses: any[];
  transitions: any[];
  onToggle: (fromId: number, toId: number) => void;
  selectedGroupId: number | null;
}) {
  // layout
  const nodeWidth = 160;
  const nodeHeight = 70;
  const hGap = 80;
  const vGap = 30;

  // positions persisted in-memory during session
  const [posById, setPosById] = useState<Record<number, { x: number; y: number }>>({});

  // tenant-aware storage key for per-group layouts
  const tenant = getCurrentTenant();
  const storageKey = useMemo(() => (
    selectedGroupId ? `wh_status_positions:${tenant || 'default'}:${selectedGroupId}` : null
  ), [tenant, selectedGroupId]);

  // load saved positions when switching group/tenant
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, { x: number; y: number }>;
      if (!parsed || typeof parsed !== 'object') return;
      setPosById((prev) => {
        const next = { ...prev } as Record<number, { x: number; y: number }>;
        for (const k of Object.keys(parsed)) {
          const id = Number(k);
          const p = parsed[k];
          if (p && typeof p.x === 'number' && typeof p.y === 'number') next[id] = { x: p.x, y: p.y };
        }
        return next;
      });
    } catch {
      // ignore parse errors
    }
  }, [storageKey]);

  // initialize default positions for new nodes without overriding moved ones
  useEffect(() => {
    setPosById((prev) => {
      const next = { ...prev } as Record<number, { x: number; y: number }>;
      statuses.forEach((s: any, idx: number) => {
        if (next[s.id] == null) {
          const col = idx % 3;
          const row = Math.floor(idx / 3);
          next[s.id] = { x: col * (nodeWidth + hGap), y: row * (nodeHeight + vGap) };
        }
      });
      // prune removed ids
      for (const k of Object.keys(next)) {
        const id = Number(k);
        if (!statuses.find((s: any) => Number(s.id) === id)) delete next[id];
      }
      return next;
    });
  }, [statuses]);

  // persist positions as they change
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(posById));
    } catch {
      // best-effort only
    }
  }, [posById, storageKey]);

  const nodes = statuses.map((s: any) => ({ ...s, x: posById[s.id]?.x ?? 0, y: posById[s.id]?.y ?? 0 }));
  const idToPos: Record<number, { x: number; y: number }> = {};
  for (const s of nodes) idToPos[s.id] = { x: s.x, y: s.y };

  // canvas size based on node extents
  const width = Math.max(300, Math.max(...nodes.map(n => n.x + nodeWidth), 0) + 40);
  const height = Math.max(240, Math.max(...nodes.map(n => n.y + nodeHeight), 0) + 40);

  // drag-to-connect state
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [hoverTarget, setHoverTarget] = useState<number | null>(null);
  const [moving, setMoving] = useState<{ id: number; offsetX: number; offsetY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getCenter = (id: number) => {
    const p = idToPos[id];
    if (!p) return { x: 0, y: 0 };
    return { x: p.x + nodeWidth / 2, y: p.y + nodeHeight / 2 };
  };

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const rect = (containerRef.current as HTMLDivElement).getBoundingClientRect();
    const rel = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (moving) {
      const nx = rel.x - moving.offsetX;
      const ny = rel.y - moving.offsetY;
      setPosById((prev) => ({ ...prev, [moving.id]: { x: nx, y: ny } }));
      return;
    }
    if (dragFrom != null) {
      setCursor(rel);
    }
  };

  const stopDrag = () => {
    setDragFrom(null);
    setCursor(null);
    setHoverTarget(null);
    setMoving(null);
  };

  // fast lookup for whether a transition exists
  const transitionsSet = useMemo(() => {
    const set = new Set<string>();
    for (const t of transitions) set.add(`${t.from_status}->${t.to_status}`);
    return set;
  }, [transitions]);

  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);

  return (
    <div className="border rounded-md p-4 overflow-auto" style={{ minHeight: 320 }}>
      <div
        className="relative"
        style={{ width, height }}
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={stopDrag}
        onMouseUp={stopDrag}
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEdge && selectedGroupId) {
            const parts = selectedEdge.split('->');
            if (parts.length === 2) {
              const from = Number(parts[0]);
              const to = Number(parts[1]);
              if (!Number.isNaN(from) && !Number.isNaN(to)) {
                onToggle(from, to);
                setSelectedEdge(null);
                e.preventDefault();
              }
            }
          }
        }}
      >
        <svg className="absolute inset-0 w-full h-full" shapeRendering="geometricPrecision">
          <defs>
            <marker id="arrow-blue" viewBox="0 0 12 12" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto" markerUnits="strokeWidth">
              <path d="M 0 0 L 12 6 L 0 12 z" fill="#3b82f6" />
            </marker>
            <marker id="arrow-red" viewBox="0 0 12 12" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto" markerUnits="strokeWidth">
              <path d="M 0 0 L 12 6 L 0 12 z" fill="#ef4444" />
            </marker>
            <marker id="arrow-draft" viewBox="0 0 12 12" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto" markerUnits="strokeWidth">
              <path d="M 0 0 L 12 6 L 0 12 z" fill="#60a5fa" />
            </marker>
          </defs>
          {transitions.map((t: any, i: number) => {
            const a = idToPos[t.from_status];
            const b = idToPos[t.to_status];
            if (!a || !b) return null;

            const srcCenter = { x: a.x + nodeWidth / 2, y: a.y + nodeHeight / 2 };
            const dstCenter = { x: b.x + nodeWidth / 2, y: b.y + nodeHeight / 2 };
            const dx = dstCenter.x - srcCenter.x;
            const dy = dstCenter.y - srcCenter.y;

            const margin = 8;

            // Pick source anchor based on dominant direction to avoid visible stubs
            let x1 = srcCenter.x, y1 = srcCenter.y;
            if (Math.abs(dy) > Math.abs(dx)) {
              // vertical dominant
              if (dy > 0) { // target is below -> exit bottom
                x1 = a.x + nodeWidth / 2; y1 = a.y + nodeHeight + margin;
              } else { // above -> exit top
                x1 = a.x + nodeWidth / 2; y1 = a.y - margin;
              }
            } else {
              if (dx > 0) { // target right -> exit right
                x1 = a.x + nodeWidth + margin; y1 = a.y + nodeHeight / 2;
              } else { // left
                x1 = a.x - margin; y1 = a.y + nodeHeight / 2;
              }
            }

            // Pick destination anchor symmetrically
            let x2 = dstCenter.x, y2 = dstCenter.y;
            if (Math.abs(dy) > Math.abs(dx)) {
              if (dy > 0) { // coming from above -> enter top
                x2 = b.x + nodeWidth / 2; y2 = b.y - margin;
              } else { // from below -> enter bottom
                x2 = b.x + nodeWidth / 2; y2 = b.y + nodeHeight + margin;
              }
            } else {
              if (dx > 0) { // coming from left -> enter left
                x2 = b.x - margin; y2 = b.y + nodeHeight / 2;
              } else { // from right -> enter right
                x2 = b.x + nodeWidth + margin; y2 = b.y + nodeHeight / 2;
              }
            }

            // Control points with endpoint-aligned tangents
            const verticalDominant = Math.abs(dy) > Math.abs(dx);
            let c1x: number; let c1y: number; let c2x: number; let c2y: number;
            if (verticalDominant) {
              // keep vertical tangents at ends so arrow points up/down
              const k = dy > 0 ? 60 : -60;
              c1x = x1; c1y = y1 + k;
              c2x = x2; c2y = y2 - k;
            } else {
              // keep horizontal tangents at ends so arrow points left/right
              const k = dx > 0 ? 60 : -60;
              c1x = x1 + k; c1y = y1;
              c2x = x2 - k; c2y = y2;
            }
            const segdx = x2 - x1; const segdy = y2 - y1;
            const segLen2 = Math.max(1, segdx*segdx + segdy*segdy);
            const corridor = 36; // tolerance
            const midX = (x1 + x2) / 2; const midY = (y1 + y2) / 2;
            let bumpX = 0, bumpY = 0;
            for (const n of nodes) {
              if (n.id === t.from_status || n.id === t.to_status) continue;
              const cx = n.x + nodeWidth / 2; const cy = n.y + nodeHeight / 2;
              const tproj = ((cx - x1) * segdx + (cy - y1) * segdy) / segLen2;
              if (tproj <= 0 || tproj >= 1) continue;
              const px = x1 + tproj * segdx; const py = y1 + tproj * segdy;
              const dist = Math.hypot(cx - px, cy - py);
              if (dist < corridor) {
                if (Math.abs(segdx) > Math.abs(segdy)) bumpY += cy > midY ? 60 : -60; else bumpX += cx > midX ? 60 : -60;
              }
            }
            c1x += bumpX; c2x += bumpX; c1y += bumpY; c2y += bumpY;
            // Re-clamp end tangents to maintain desired arrow direction and ensure tangent alignment
            if (verticalDominant) {
              c1x = x1; c2x = x2; // vertical tangents: x fixed, y offset
            } else {
              c1y = y1; c2y = y2; // horizontal tangents: y fixed, x offset
            }
            const path = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
            const key = `${t.from_status}->${t.to_status}`;
            const hovered = hoverEdge === key;
            const selected = selectedEdge === key;
            return (
              <path
                key={`${key}-${i}`}
                d={path}
                stroke={hovered || selected ? '#ef4444' : '#3b82f6'}
                strokeWidth={selected ? 4 : (hovered ? 3 : 2)}
                strokeLinecap="round"
                fill="none"
                style={{ cursor: selectedGroupId ? 'pointer' : 'default' }}
                onMouseEnter={() => setHoverEdge(key)}
                onMouseLeave={() => setHoverEdge(null)}
                onClick={(e) => { e.stopPropagation(); if (!selectedGroupId) return; setSelectedEdge((prev: string | null) => prev === key ? null : key); }}
                markerEnd={`url(#${hovered ? 'arrow-red' : 'arrow-blue'})`}
              />
            );
          })}
          {dragFrom != null && cursor && (() => {
            const a = getCenter(dragFrom);
            const x1 = a.x;
            const y1 = a.y;
            const x2 = hoverTarget != null ? getCenter(hoverTarget).x : cursor.x;
            const y2 = hoverTarget != null ? getCenter(hoverTarget).y : cursor.y;
            const mx = (x1 + x2) / 2;
            const path = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
            return <path d={path} stroke="#60a5fa" strokeWidth={2} strokeDasharray="6 4" strokeLinecap="round" fill="none" markerEnd="url(#arrow-draft)" />;
          })()}
        </svg>

        {nodes.map((s: any) => (
          <div
            key={s.id}
            className={`absolute rounded-lg border shadow-sm bg-background select-none ${moving ? 'cursor-move' : (selectedGroupId ? 'cursor-crosshair' : 'cursor-default')} ${dragFrom != null && hoverTarget === s.id ? (transitionsSet.has(`${dragFrom}->${s.id}`) ? 'ring-2 ring-red-400' : 'ring-2 ring-blue-400') : ''}`}
            style={{ left: s.x, top: s.y, width: nodeWidth, height: nodeHeight, borderColor: s.color || '#e5e7eb' }}
            onMouseDown={(ev) => {
              // Hold Shift to connect; otherwise drag-move
              if (ev.shiftKey && selectedGroupId) {
                setDragFrom(s.id);
                const rect = (containerRef.current as HTMLDivElement).getBoundingClientRect();
                setCursor({ x: ev.clientX - rect.left, y: ev.clientY - rect.top });
              } else {
                const rect = (ev.currentTarget as HTMLDivElement).getBoundingClientRect();
                const offsetX = ev.clientX - rect.left;
                const offsetY = ev.clientY - rect.top;
                setMoving({ id: s.id, offsetX, offsetY });
              }
            }}
            onMouseUp={() => {
              if (!selectedGroupId) return;
              if (dragFrom != null && dragFrom !== s.id) {
                onToggle(dragFrom, s.id);
              }
              stopDrag();
            }}
            onMouseEnter={() => { if (dragFrom != null) setHoverTarget(s.id); }}
            onMouseLeave={() => { if (dragFrom != null) setHoverTarget(null); }}
          >
            <div className="h-full w-full flex items-center justify-center">
              <div className="text-center p-2">
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.initial ? 'Initial' : (s.system ? 'System' : '')}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground mt-3">Tip: drag from one status to another to add a transition. Use the Matrix for bulk edits.</div>
    </div>
  );
});