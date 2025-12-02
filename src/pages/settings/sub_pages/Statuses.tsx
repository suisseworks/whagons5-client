import { useEffect, useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faEdit, faTrash } from "@fortawesome/free-solid-svg-icons";
import { UrlTabs } from "@/components/ui/url-tabs";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/animated/Tabs";

const STATUS_ACTIONS = ["NONE", "WORKING", "PAUSED", "FINISHED"] as const;

function Statuses() {
  
  const dispatch = useDispatch<AppDispatch>();

  // Selectors
  const statuses = useSelector((s: RootState) => s.statuses.value) as any[];
  const statusTransitions = useSelector((s: RootState) => s.statusTransitions.value) as any[];
  const statusTransitionGroups = useSelector((s: RootState) => s.statusTransitionGroups.value) as any[];
  
  // Local UI state
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [transitionsView, setTransitionsView] = useState<'matrix' | 'visual'>('visual');
  const [activeStatuses, setActiveStatuses] = useState<Set<number>>(new Set());
  const tenant = getCurrentTenant();

  // Update active statuses when group selection changes
  useEffect(() => {
    if (!selectedGroupId) {
      setActiveStatuses(new Set());
      return;
    }

    const groupTransitions = statusTransitions.filter((t: any) => t.status_transition_group_id === selectedGroupId);
    const activeStatusIds = new Set<number>();

    groupTransitions.forEach((transition: any) => {
      activeStatusIds.add(transition.from_status);
      activeStatusIds.add(transition.to_status);
    });

    setActiveStatuses(activeStatusIds);
  }, [selectedGroupId, statusTransitions]);

  // Handlers for managing active statuses in workflow
  const handleAddStatusToWorkflow = (statusId: number) => {
    setActiveStatuses(prev => new Set([...prev, statusId]));
  };

  // Statuses to show in matrix (match rows and columns)
  const matrixStatuses = useMemo(() => (
    selectedGroupId ? statuses.filter(s => activeStatuses.has(s.id)) : statuses
  ), [selectedGroupId, statuses, activeStatuses]);

  const handleRemoveStatusFromWorkflow = (statusId: number) => {
    if (!selectedGroupId) return;

    // Remove all transitions involving this status
    const transitionsToRemove = statusTransitions.filter((t: any) =>
      t.status_transition_group_id === selectedGroupId &&
      (t.from_status === statusId || t.to_status === statusId)
    );

    transitionsToRemove.forEach((transition: any) => {
      dispatch(genericActions.statusTransitions.removeAsync(transition.id));
    });

    setActiveStatuses(prev => {
      const newSet = new Set(prev);
      newSet.delete(statusId);
      return newSet;
    });
  };

  // Dialog state for create/rename group (shadcn)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupDialogMode, setGroupDialogMode] = useState<'create' | 'rename'>('create');
  const [groupDialogName, setGroupDialogName] = useState<string>("");
  const [deleteGroupOpen, setDeleteGroupOpen] = useState(false);

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
  const allowedActions = STATUS_ACTIONS;

  
  // Load persisted view and group, and save changes
  useEffect(() => {
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
      width: 100,
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

  // Selected group helper
  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) return null;
    return statusTransitionGroups.find((g: any) => Number(g.id) === Number(selectedGroupId)) || null;
  }, [statusTransitionGroups, selectedGroupId]);

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

  const handleCreateGroup = (name: string) => {
    if (!name.trim()) return;
    dispatch(genericActions.statusTransitionGroups.addAsync({ name: name.trim(), description: '', is_default: false, is_active: true } as any));
  };

  const handleRenameGroup = (name: string) => {
    if (!selectedGroupId) return;
    if (!name.trim()) return;
    dispatch(genericActions.statusTransitionGroups.updateAsync({ id: selectedGroupId, updates: { name: name.trim() } }));
  };

  const handleDeleteGroup = () => {
    if (!selectedGroupId) return;
    dispatch(genericActions.statusTransitionGroups.removeAsync(selectedGroupId));
    setSelectedGroupId(null);
  };

  // Define tabs for URL persistence
  const statusStats = useMemo(() => ({
    total: statuses.length,
    system: statuses.filter((s: any) => !!s.system).length,
    initial: statuses.filter((s: any) => !!s.initial).length,
    transitionsTotal: statusTransitions.length,
    selectedGroupTransitions: selectedGroupId ? transitionsByKey.size : null,
    transitionGroups: statusTransitionGroups.length,
    actions: STATUS_ACTIONS.map(action => ({
      action,
      count: statuses.filter((s: any) => String(s.action).toUpperCase() === action).length,
    })),
  }), [statuses, statusTransitionGroups, statusTransitions, selectedGroupId, transitionsByKey]);

  const statusesTabs = [
    {
      value: 'statuses',
      label: 'Statuses',
      content: (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0">
            <SettingsGrid
              rowData={filteredStatuses}
              columnDefs={columns}
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
          </div>
        </div>
      )
    },
    {
      value: 'transitions',
      label: 'Transitions',
      content: (
        <div className="space-y-4 flex-1 min-h-0 flex flex-col">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold mr-2">Transitions</h2>
            <Select value={selectedGroupId ? String(selectedGroupId) : ''} onValueChange={(v) => setSelectedGroupId(v ? Number(v) : null)}>
              <SelectTrigger size="sm" className="min-w-[180px]"><SelectValue placeholder="Select group…" /></SelectTrigger>
              <SelectContent position="popper">
                {statusTransitionGroups.map((g: any) => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen} modal={false}>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary" onClick={() => { setGroupDialogMode('create'); setGroupDialogName(''); }}>New Group</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{groupDialogMode === 'create' ? 'New Group' : 'Rename Group'}</DialogTitle>
                </DialogHeader>
                <DialogDescription>
                  {groupDialogMode === 'create' ? 'Create a new status transition group.' : 'Rename the selected status transition group.'}
                </DialogDescription>
                <Input placeholder="Group name" value={groupDialogName} onChange={(e) => setGroupDialogName(e.target.value)} />
                <DialogFooter>
                  <Button onClick={() => setGroupDialogOpen(false)} variant="outline" size="sm">Cancel</Button>
                  <Button size="sm" onClick={() => {
                    if (groupDialogMode === 'create') handleCreateGroup(groupDialogName); else handleRenameGroup(groupDialogName);
                    setGroupDialogOpen(false);
                  }}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button size="sm" variant="secondary" disabled={!selectedGroupId} onClick={() => {
              const current = statusTransitionGroups.find((g: any) => g.id === selectedGroupId);
              setGroupDialogMode('rename');
              setGroupDialogName(current?.name || '');
              setGroupDialogOpen(true);
            }}>Rename</Button>
            <Button size="sm" variant="destructive" onClick={() => setDeleteGroupOpen(true)} disabled={!selectedGroupId}>Delete</Button>

            <Dialog open={deleteGroupOpen} onOpenChange={setDeleteGroupOpen} modal={false}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Group</DialogTitle>
                </DialogHeader>
                <DialogDescription>
                  Deleting a group removes all transitions in it. This cannot be undone.
                </DialogDescription>
                <div className="space-y-2">
                  <p>Are you sure you want to delete "{selectedGroup?.name}"?</p>
                  <p className="text-sm text-muted-foreground">This will remove all transitions in this group. This action cannot be undone.</p>
                </div>
                <DialogFooter>
                  <Button onClick={() => setDeleteGroupOpen(false)} variant="outline" size="sm">Cancel</Button>
                  <Button size="sm" variant="destructive" onClick={() => { handleDeleteGroup(); setDeleteGroupOpen(false); }}>Delete</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Right-aligned view toggle tabs */}
            <div className="ml-auto">
              <Tabs value={transitionsView} onValueChange={(v: any) => setTransitionsView(v)}>
                <TabsList>
                  <TabsTrigger value="visual">Visual</TabsTrigger>
                  <TabsTrigger value="matrix">Matrix</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {transitionsView === 'matrix' ? (
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="border rounded-lg bg-card shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-2 bg-muted/50">
                      <TableHead className="sticky left-0 z-10 bg-muted/50 border-r-2 font-semibold text-foreground min-w-[120px]">From \\ To</TableHead>
                      {matrixStatuses.map((to: any) => (
                        <TableHead key={`to-${to.id}`} className="whitespace-nowrap min-w-[100px] text-center font-semibold border-r last:border-r-0">
                          <div className="flex flex-col items-center space-y-1">
                            <StatusIcon icon={to.icon || 'fas fa-circle'} color={to.color || '#6B7280'} />
                            <span className="text-xs font-medium">{to.name}</span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matrixStatuses.map((from: any, rowIndex: number) => (
                      <TableRow key={`from-${from.id}`} className={rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                        <TableCell className="sticky left-0 z-10 bg-background border-r-2 font-medium whitespace-nowrap min-w-[120px] p-3">
                          <div className="flex items-center space-x-2">
                            <StatusIcon icon={from.icon || 'fas fa-circle'} color={from.color || '#6B7280'} />
                            <span>{from.name}</span>
                          </div>
                        </TableCell>
                        {matrixStatuses.map((to: any) => {
                          const key = `${from.id}->${to.id}`;
                          const checked = transitionsByKey.has(key);
                          const disabled = from.id === to.id;
                          return (
                            <TableCell key={`cell-${from.id}-${to.id}`} className="text-center border-r last:border-r-0 p-2">
                              <Checkbox
                                disabled={disabled || !selectedGroupId}
                                checked={checked}
                                onCheckedChange={() => toggleTransition(from.id, to.id)}
                                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 rounded-md overflow-hidden" style={{ minHeight: '520px' }}>
              <div className="h-full w-full overflow-auto">
                <VisualTransitions
                  embedded
                  allStatuses={statuses}
                  activeStatuses={statuses.filter(s => activeStatuses.has(s.id))}
                  transitions={statusTransitions.filter((t: any) => selectedGroupId ? t.status_transition_group_id === selectedGroupId : true)}
                  onToggle={toggleTransition}
                  onAddStatus={handleAddStatusToWorkflow}
                  onRemoveStatus={handleRemoveStatusFromWorkflow}
                  selectedGroupId={selectedGroupId}
                />
              </div>
            </div>
          )}
        </div>
      )
    },
    {
      value: 'stats',
      label: 'Statistics',
      content: (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Total Statuses</p>
              <p className="text-2xl font-semibold mt-1">{statusStats.total}</p>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">System Statuses</p>
              <p className="text-2xl font-semibold mt-1">{statusStats.system}</p>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Initial Statuses</p>
              <p className="text-2xl font-semibold mt-1">{statusStats.initial}</p>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Transition Groups</p>
              <p className="text-2xl font-semibold mt-1">{statusStats.transitionGroups}</p>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Transitions (All)</p>
              <p className="text-2xl font-semibold mt-1">{statusStats.transitionsTotal}</p>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Transitions (Selected Group)</p>
              <p className="text-2xl font-semibold mt-1">{statusStats.selectedGroupTransitions ?? '—'}</p>
            </div>
          </div>

          <div className="mt-6 rounded-lg border bg-card shadow-sm">
            <div className="border-b px-4 py-3">
              <h3 className="text-base font-semibold">Statuses by Action</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Percent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statusStats.actions.map(({ action, count }) => {
                  const percent = statusStats.total ? Math.round((count / statusStats.total) * 100) : 0;
                  return (
                    <TableRow key={action}>
                      <TableCell className="font-medium">{action}</TableCell>
                      <TableCell className="text-right">{count}</TableCell>
                      <TableCell className="text-right">{percent}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )
    }
  ];

  return (
    <SettingsLayout
      title="Statuses"
      description="Manage global statuses and transition rules"
      icon={faSitemap}
      iconColor="#f59e0b"
      backPath="/settings"
      wrapChildrenFullHeight={true}
      search={{
        placeholder: "Search statuses...",
        value: searchQuery,
        onChange: setSearchQuery
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
      <UrlTabs
        tabs={statusesTabs}
        defaultValue="statuses"
        basePath="/settings/statuses"
        className="h-full flex flex-col"
      />

      {/* Global dialogs (available on any tab) */}
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
    </SettingsLayout>
  );
}

export default Statuses;