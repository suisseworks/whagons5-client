import { useEffect, useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faEdit,
  faTrash,
  faCircleNodes,
  faLayerGroup,
  faLink,
  faLifeRing,
  faSitemap
} from "@fortawesome/free-solid-svg-icons";
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
import { SettingsLayout } from "@/pages/settings/components";
import { StatusIcon } from "@/pages/settings/components/StatusIcon";
import { VisualTransitions } from "@/pages/settings/components/VisualTransitions";
import { getCurrentTenant } from "@/api/whagonsApi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/animated/Tabs";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/providers/LanguageProvider";

const STATUS_ACTIONS = ["NONE", "WORKING", "PAUSED", "FINISHED"] as const;

const ACTION_ACCENTS: Record<string, string> = {
  NONE: "from-slate-400 to-slate-200",
  WORKING: "from-emerald-400 to-emerald-300",
  PAUSED: "from-amber-400 to-amber-200",
  FINISHED: "from-indigo-400 to-indigo-300"
};

function Statuses() {
  const { t } = useLanguage();
  const ts = (key: string, fallback: string) => t(`settings.statuses.${key}`, fallback);
  
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
  const activeStatusesCount = activeStatuses.size;
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
  const [formCelebrationEnabled, setFormCelebrationEnabled] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [, setIsDeleting] = useState(false);
  // Toast removed
  // Backend enum values for status.action
  const allowedActions = STATUS_ACTIONS;

  const percentOf = (value: number, total: number) => {
    if (!total) return 0;
    return Math.min(100, Math.round((value / total) * 100));
  };

  
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
    setFormCelebrationEnabled(row.celebration_enabled !== false); // Default to true
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
    { headerName: ts("grid.columns.name", "Nombre"), field: "name", flex: 1, minWidth: 200, cellRenderer: (p: any) => {
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
    { headerName: ts("grid.columns.action", "Acción"), field: "action", flex: 1, minWidth: 140 },
    // Icon column removed; icon shown with color inside Name
    { headerName: ts("grid.columns.system", "Sistema"), field: "system", width: 110 },
    {
      headerName: ts("grid.columns.initial", "Inicial"),
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
    }
  ], [dispatch, statuses, ts]);

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

  const maxActionCount = useMemo(() => {
    const highest = statusStats.actions.reduce((max, current) => Math.max(max, current.count), 0);
    return highest || 1;
  }, [statusStats.actions]);

  const avgTransitionsPerGroup = useMemo(() => {
    if (!statusStats.transitionGroups) return 0;
    return Math.round(statusStats.transitionsTotal / statusStats.transitionGroups);
  }, [statusStats.transitionGroups, statusStats.transitionsTotal]);

  const selectedGroupCoverage = useMemo(() => {
    if (!selectedGroupId || !activeStatusesCount) return 0;
    const possible = activeStatusesCount * Math.max(activeStatusesCount - 1, 0);
    if (!possible) return 0;
    const actual = statusStats.selectedGroupTransitions ?? 0;
    return Math.min(100, Math.round((actual / possible) * 100));
  }, [selectedGroupId, activeStatusesCount, statusStats.selectedGroupTransitions]);

  const helpMilestones = [
    {
      label: ts("help.milestones.01.label", "01"),
      title: ts("help.milestones.01.title", "Diseñar estados"),
      subtitle: ts("help.milestones.01.subtitle", "Nombres, iconos, acciones"),
      accent: "from-emerald-300 via-emerald-400 to-emerald-500"
    },
    {
      label: ts("help.milestones.02.label", "02"),
      title: ts("help.milestones.02.title", "Formar transiciones"),
      subtitle: ts("help.milestones.02.subtitle", "Matriz o constructor visual"),
      accent: "from-sky-300 via-sky-400 to-indigo-500"
    },
    {
      label: ts("help.milestones.03.label", "03"),
      title: ts("help.milestones.03.title", "Vincular a categorías"),
      subtitle: ts("help.milestones.03.subtitle", "Asignar por flujo de trabajo"),
      accent: "from-amber-300 via-orange-400 to-orange-500"
    }
  ];

  const helpHeroStatuses = [
    { name: ts("help.sampleWorkflow.statuses.backlog", "Backlog"), action: "NONE", color: "#94a3b8" },
    { name: ts("help.sampleWorkflow.statuses.inProgress", "En Progreso"), action: "WORKING", color: "#34d399" },
    { name: ts("help.sampleWorkflow.statuses.blocked", "Bloqueado"), action: "PAUSED", color: "#fb923c" },
    { name: ts("help.sampleWorkflow.statuses.completed", "Completado"), action: "FINISHED", color: "#6366f1" }
  ];

  const helpInfoCards = [
    {
      icon: faCircleNodes,
      title: ts("help.infoCards.global.title", "Biblioteca global de estados"),
      description: ts("help.infoCards.global.description", "Una paleta potencia cada workspace. Actualiza una vez y todos los equipos se mantienen consistentes."),
      accent: "text-sky-500",
      iconWrapper: "bg-sky-500/10 border-sky-500/30",
      cardBorder: "border-sky-500/20"
    },
    {
      icon: faLayerGroup,
      title: ts("help.infoCards.groups.title", "Grupos de transición"),
      description: ts("help.infoCards.groups.description", "Usa múltiples grupos para reflejar diferentes reglas de ciclo de vida (estándar, aprobaciones, operaciones de campo, etc.)."),
      accent: "text-indigo-500",
      iconWrapper: "bg-indigo-500/10 border-indigo-500/30",
      cardBorder: "border-indigo-500/20"
    },
    {
      icon: faLink,
      title: ts("help.infoCards.linking.title", "Vinculación de categorías"),
      description: ts("help.infoCards.linking.description", "Cada categoría elige un grupo de transición. Las tareas heredan el gráfico automáticamente."),
      accent: "text-amber-500",
      iconWrapper: "bg-amber-500/10 border-amber-500/30",
      cardBorder: "border-amber-500/20"
    },
    {
      icon: faLifeRing,
      title: ts("help.infoCards.resilience.title", "Resiliencia y soporte"),
      description: ts("help.infoCards.resilience.description", "Clona grupos para experimentar de forma segura. Los estados del sistema previenen eliminaciones accidentales."),
      accent: "text-rose-500",
      iconWrapper: "bg-rose-500/10 border-rose-500/30",
      cardBorder: "border-rose-500/20"
    }
  ];

  const helpTimeline = [
    {
      step: ts("help.timeline.01.step", "01"),
      title: ts("help.timeline.01.title", "Planificar y alinear"),
      description: ts("help.timeline.01.description", "Audita estados de tareas existentes, decide códigos de acción, confirma nombres con las partes interesadas."),
      gradient: "from-emerald-400 to-emerald-600"
    },
    {
      step: ts("help.timeline.02.step", "02"),
      title: ts("help.timeline.02.title", "Modelar transiciones"),
      description: ts("help.timeline.02.description", "Construye el gráfico por grupo. Usa la pestaña visual para validar pasos bidireccionales y bloqueadores."),
      gradient: "from-indigo-400 to-indigo-600"
    },
    {
      step: ts("help.timeline.03.step", "03"),
      title: ts("help.timeline.03.title", "Desplegar y monitorear"),
      description: ts("help.timeline.03.description", "Adjunta grupos a categorías, monitorea la adopción e itera usando análisis y registros de configuración."),
      gradient: "from-amber-400 to-orange-500"
    }
  ];

  const statusesTabs = [
    {
      value: 'statuses',
      label: ts("tabs.statuses", "Estados"),
      content: (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0">
            <SettingsGrid
              rowData={filteredStatuses}
              columnDefs={columns}
              noRowsMessage={ts("grid.noRows", "No se encontraron estados")}
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
                setFormCelebrationEnabled(row.celebration_enabled !== false); // Default to true
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
      label: ts("tabs.transitions", "Transiciones"),
      content: (
        <div className="space-y-4 flex-1 min-h-0 flex flex-col">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold mr-2">{ts("transitions.title", "Transiciones")}</h2>
            <Select value={selectedGroupId ? String(selectedGroupId) : ''} onValueChange={(v) => setSelectedGroupId(v ? Number(v) : null)}>
              <SelectTrigger size="sm" className="min-w-[180px]"><SelectValue placeholder={ts("transitions.selectGroup", "Seleccionar grupo...")} /></SelectTrigger>
              <SelectContent position="popper">
                {statusTransitionGroups.map((g: any) => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen} modal={false}>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary" onClick={() => { setGroupDialogMode('create'); setGroupDialogName(''); }}>{ts("transitions.newGroup", "Nuevo Grupo")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{groupDialogMode === 'create' ? ts("transitions.groupDialog.create.title", "Nuevo Grupo") : ts("transitions.groupDialog.rename.title", "Renombrar Grupo")}</DialogTitle>
                </DialogHeader>
                <DialogDescription>
                  {groupDialogMode === 'create' ? ts("transitions.groupDialog.create.description", "Crea un nuevo grupo de transición de estados.") : ts("transitions.groupDialog.rename.description", "Renombra el grupo de transición de estados seleccionado.")}
                </DialogDescription>
                <Input placeholder={ts("transitions.groupDialog.namePlaceholder", "Nombre del grupo")} value={groupDialogName} onChange={(e) => setGroupDialogName(e.target.value)} />
                <DialogFooter>
                  <Button onClick={() => setGroupDialogOpen(false)} variant="outline" size="sm">{t("common.cancel", "Cancelar")}</Button>
                  <Button size="sm" onClick={() => {
                    if (groupDialogMode === 'create') handleCreateGroup(groupDialogName); else handleRenameGroup(groupDialogName);
                    setGroupDialogOpen(false);
                  }}>{t("common.save", "Guardar")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button size="sm" variant="secondary" disabled={!selectedGroupId} onClick={() => {
              const current = statusTransitionGroups.find((g: any) => g.id === selectedGroupId);
              setGroupDialogMode('rename');
              setGroupDialogName(current?.name || '');
              setGroupDialogOpen(true);
            }}>{ts("transitions.rename", "Renombrar")}</Button>
            <Button size="sm" variant="destructive" onClick={() => setDeleteGroupOpen(true)} disabled={!selectedGroupId}>{ts("transitions.delete", "Eliminar")}</Button>

            <Dialog open={deleteGroupOpen} onOpenChange={setDeleteGroupOpen} modal={false}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{ts("transitions.groupDialog.delete.title", "Eliminar Grupo")}</DialogTitle>
                </DialogHeader>
                <DialogDescription>
                  {ts("transitions.groupDialog.delete.description", "Eliminar un grupo elimina todas las transiciones en él. Esto no se puede deshacer.")}
                </DialogDescription>
                <div className="space-y-2">
                  <p>{ts("transitions.groupDialog.delete.confirm", "¿Estás seguro de que deseas eliminar \"{name}\"?").replace("{name}", selectedGroup?.name || "")}</p>
                  <p className="text-sm text-muted-foreground">{ts("transitions.groupDialog.delete.warning", "Esto eliminará todas las transiciones en este grupo. Esta acción no se puede deshacer.")}</p>
                </div>
                <DialogFooter>
                  <Button onClick={() => setDeleteGroupOpen(false)} variant="outline" size="sm">{t("common.cancel", "Cancelar")}</Button>
                  <Button size="sm" variant="destructive" onClick={() => { handleDeleteGroup(); setDeleteGroupOpen(false); }}>{ts("transitions.delete", "Eliminar")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Right-aligned view toggle tabs */}
            <div className="ml-auto">
              <Tabs value={transitionsView} onValueChange={(v: any) => setTransitionsView(v)}>
                <TabsList>
                  <TabsTrigger value="visual">{ts("transitions.view.visual", "Visual")}</TabsTrigger>
                  <TabsTrigger value="matrix">{ts("transitions.view.matrix", "Matriz")}</TabsTrigger>
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
                      <TableHead className="sticky left-0 z-10 bg-muted/50 border-r-2 font-semibold text-foreground min-w-[120px]">{ts("transitions.matrix.fromTo", "De \\ A")}</TableHead>
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
      label: ts("tabs.stats", "Estadísticas"),
      content: (
        <div className="flex-1 min-h-0 overflow-auto space-y-6">
          <div className="rounded-3xl border bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white p-6 shadow-xl relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" aria-hidden>
              <div className="absolute -top-10 left-10 h-40 w-40 bg-emerald-400/30 blur-[120px]" />
              <div className="absolute -bottom-16 right-4 h-48 w-48 bg-cyan-500/30 blur-[140px]" />
            </div>
            <div className="relative space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <Badge variant="outline" className="bg-white/10 text-white border-white/20 uppercase tracking-[0.35em] text-[10px]">
                    {ts("stats.hero.badge", "pulso de estado")}
                  </Badge>
                  <h3 className="mt-3 text-3xl font-semibold leading-tight">{ts("stats.hero.title", "Resumen de salud del ciclo de vida")}</h3>
                  <p className="text-sm text-white/70">
                    {ts("stats.hero.description", "{total} estados conectados en {groups} grupos de transición.").replace("{total}", String(statusStats.total)).replace("{groups}", String(statusStats.transitionGroups))}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {statusStats.actions.map(({ action, count }) => (
                    <div key={action} className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-left shadow-sm">
                      <p className="text-xs uppercase tracking-widest text-white/70">{action}</p>
                      <p className="text-xl font-semibold">{count}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="h-32 flex items-end gap-4">
                {statusStats.actions.map(({ action, count }) => {
                  const height = Math.max((count / maxActionCount) * 100, 8);
                  return (
                    <div key={`bar-${action}`} className="flex-1 flex flex-col items-center gap-2 text-white/80">
                      <div className="flex-1 flex items-end w-full">
                        <div
                          className={`w-full rounded-xl bg-gradient-to-t ${ACTION_ACCENTS[action] ?? 'from-slate-400 to-slate-200'}`}
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <p className="text-[11px] uppercase tracking-wide">{action}</p>
                      <p className="text-sm font-semibold text-white">{count}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-xs uppercase text-muted-foreground tracking-wide">{ts("stats.cards.system.title", "Estados del sistema")}</p>
              <p className="text-3xl font-semibold mt-2">{statusStats.system}</p>
              <p className="text-xs text-muted-foreground">{ts("stats.cards.system.value", "Protegidos por defecto")}</p>
              <div className="mt-3 h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-500"
                  style={{ width: `${percentOf(statusStats.system, statusStats.total || 1)}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {percentOf(statusStats.system, statusStats.total || 1)}{ts("stats.cards.system.percentage", "% de la biblioteca.")}
              </p>
            </div>
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-xs uppercase text-muted-foreground tracking-wide">{ts("stats.cards.initial.title", "Estados iniciales")}</p>
              <p className="text-3xl font-semibold mt-2">{statusStats.initial}</p>
              <p className="text-xs text-muted-foreground">{ts("stats.cards.initial.value", "Puntos de entrada")}</p>
              <div className="mt-3 h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                  style={{ width: `${percentOf(statusStats.initial, statusStats.total || 1)}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {ts("stats.cards.initial.description", "Generalmente uno por flujo de trabajo; agrega más para plantillas de ramificación.")}
              </p>
            </div>
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-xs uppercase text-muted-foreground tracking-wide">{ts("stats.cards.transitionGroups.title", "Grupos de transición")}</p>
              <p className="text-3xl font-semibold mt-2">{statusStats.transitionGroups}</p>
              <p className="text-xs text-muted-foreground">
                {ts("stats.cards.transitionGroups.avgTransitions", "Promedio transiciones/grupo:")} <span className="text-foreground font-semibold">{avgTransitionsPerGroup}</span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="rounded-xl border bg-muted/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide">{ts("stats.cards.transitionGroups.allTransitions", "Todas las transiciones")}</p>
                  <p className="text-sm font-semibold text-foreground">{statusStats.transitionsTotal}</p>
                </div>
                <div className="rounded-xl border bg-muted/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide">{ts("stats.cards.transitionGroups.selectedGroup", "Grupo seleccionado")}</p>
                  <p className="text-sm font-semibold text-foreground">{statusStats.selectedGroupTransitions ?? '—'}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-xs uppercase text-muted-foreground tracking-wide">{ts("stats.cards.coverage.title", "Cobertura del grupo")}</p>
              <div className="mt-3 flex items-center gap-4">
                <div className="relative h-20 w-20">
                  <div className="absolute inset-0 rounded-full bg-muted" />
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(hsl(var(--primary)) ${selectedGroupCoverage}%, rgba(148,163,184,0.3) ${selectedGroupCoverage}% 100%)`
                    }}
                  />
                  <div className="absolute inset-4 rounded-full bg-card flex items-center justify-center text-sm font-semibold text-foreground">
                    {selectedGroupId ? `${selectedGroupCoverage}%` : '—'}
                  </div>
                </div>
                <div className="flex-1 text-sm text-muted-foreground">
                  {selectedGroupId ? (
                    <>
                      <p className="font-semibold text-foreground">{ts("stats.cards.coverage.covered", "{coverage}% de rutas posibles cubiertas").replace("{coverage}", String(selectedGroupCoverage))}</p>
                      <p>{ts("stats.cards.coverage.description", "{active} estados activos con {transitions} aristas en este grupo.").replace("{active}", String(activeStatusesCount || 0)).replace("{transitions}", String(statusStats.selectedGroupTransitions ?? 0))}</p>
                    </>
                  ) : (
                    <p>{ts("stats.cards.coverage.selectGroup", "Selecciona un grupo de transición en la pestaña Transiciones para visualizar la cobertura.")}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-muted-foreground tracking-wide">{ts("stats.actionMix.title", "Mezcla de acciones")}</p>
                <h3 className="text-lg font-semibold">{ts("stats.actionMix.subtitle", "Dónde aterrizan los estados")}</h3>
              </div>
              <Badge variant="outline">{statusStats.total ? ts("stats.actionMix.scaled", "100% escalado") : ts("stats.actionMix.noData", "Sin datos")}</Badge>
            </div>
            <div className="mt-4 space-y-4">
              {statusStats.actions.map(({ action, count }) => {
                const percent = percentOf(count, statusStats.total || 1);
                return (
                  <div key={`mix-${action}`}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{action}</span>
                        <span className="text-muted-foreground">{count} {ts("stats.actionMix.statuses", "estados")}</span>
                      </div>
                      <span className="font-mono text-xs">{percent}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${ACTION_ACCENTS[action] ?? 'from-slate-400 to-slate-200'}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )
    },
    {
      value: 'help',
      label: ts("tabs.help", "Ayuda"),
      content: (
        <div className="flex-1 min-h-0 overflow-auto space-y-6">
          <div className="rounded-3xl border bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 text-white p-6 shadow-xl relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" aria-hidden>
              <div className="absolute -top-10 right-0 h-48 w-48 bg-cyan-400/40 blur-[120px]" />
              <div className="absolute -bottom-16 left-4 h-52 w-52 bg-purple-500/30 blur-[120px]" />
            </div>
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
              <div className="flex-1 space-y-4">
                <Badge variant="outline" className="bg-white/10 text-white border-white/20 uppercase tracking-[0.35em] text-[10px]">
                  {ts("help.hero.badge", "mapa de flujo de trabajo")}
                </Badge>
                <h3 className="text-3xl font-semibold leading-tight">{ts("help.hero.title", "Los estados mantienen cada ciclo de vida sincronizado")}</h3>
                <p className="text-sm text-white/80 max-w-2xl">
                  {ts("help.hero.description", "Define una única biblioteca de estados, conéctalos con grupos de transición, luego asigna esos grupos a categorías. Las tareas heredan instantáneamente el camino correcto sin automatización adicional.")}
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {helpMilestones.map((item) => (
                    <div key={item.title} className="rounded-2xl border border-white/15 bg-white/5 p-3 space-y-1">
                      <p className="text-xs uppercase tracking-wide text-white/60">{item.label}</p>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-white/70">{item.subtitle}</p>
                      <div className={`mt-3 h-1 rounded-full bg-gradient-to-r ${item.accent}`} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-full max-w-sm rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur p-4 shadow-lg">
                <p className="text-xs uppercase tracking-wide text-white/70">{ts("help.sampleWorkflow.title", "Flujo de trabajo de ejemplo")}</p>
                <div className="mt-3 space-y-3">
                  {helpHeroStatuses.map((status, index) => (
                    <div key={status.name}>
                      <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-3 py-2 shadow-sm">
                        <div
                          className="h-9 w-9 rounded-full border border-white/30 shadow-inner"
                          style={{ backgroundColor: status.color }}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{status.name}</p>
                          <p className="text-[11px] uppercase tracking-wide text-white/70">{status.action}</p>
                        </div>
                      </div>
                      {index < helpHeroStatuses.length - 1 && (
                        <div className="ml-5 mt-1 flex items-center gap-2 text-[10px] text-white/60">
                          <div className="h-px flex-1 bg-white/25" />
                          {ts("help.sampleWorkflow.nextStep", "Siguiente paso")}
                          <div className="h-px flex-1 bg-white/25" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-white/70">
                  {ts("help.sampleWorkflow.tip", "Consejo: duplica un grupo de transición cuando los equipos necesiten un viaje personalizado—las categorías heredan el grupo que adjuntes.")}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {helpInfoCards.map((card) => (
              <div key={card.title} className={`rounded-2xl border bg-card p-4 shadow-sm ${card.cardBorder}`}>
                <div className="flex items-start gap-4">
                  <div className={`h-12 w-12 rounded-2xl border flex items-center justify-center ${card.iconWrapper}`}>
                    <FontAwesomeIcon icon={card.icon} className={`text-xl ${card.accent}`} />
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-foreground">{card.title}</p>
                    <p className="text-muted-foreground">{card.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-xs uppercase text-muted-foreground tracking-wide">{ts("help.rollout.title", "Guía de despliegue")}</p>
                <h3 className="text-lg font-semibold">{ts("help.rollout.subtitle", "Ruta de adopción en 3 pasos")}</h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {ts("help.rollout.description", "Alinea con operaciones, publica el gráfico, luego vincúlalo a categorías para aplicación instantánea.")}
              </span>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {helpTimeline.map((item, index) => (
                <div key={item.title} className="relative rounded-2xl border border-dashed border-muted-foreground/40 bg-muted/20 p-4">
                  <div className="flex items-center gap-2">
                    <div className={`px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-white rounded-full bg-gradient-to-r ${item.gradient}`}>
                      {item.step}
                    </div>
                    <p className="text-sm font-semibold">{item.title}</p>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{item.description}</p>
                  {index < helpTimeline.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 right-[-18px] h-px w-9 bg-gradient-to-r from-transparent via-muted-foreground/40 to-transparent" aria-hidden />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 flex flex-wrap items-center gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{ts("help.nextStop.title", "Próxima parada: Categorías")}</p>
              <p className="text-xs text-muted-foreground">{ts("help.nextStop.description", "Abre Configuración → Categorías para adjuntar grupos de transición a cada cola y mantener las tareas cumpliendo.")}</p>
            </div>
            <span className="text-xs text-muted-foreground">{ts("help.nextStop.help", "¿Necesitas ayuda? Contacta al equipo de plataforma con una captura de pantalla de este flujo.")}</span>
          </div>
        </div>
      )
    }
  ];

  return (
    <SettingsLayout
      title={ts("title", "Estados")}
      description={ts("description", "Administra estados globales y reglas de transición")}
      icon={faSitemap}
      iconColor="#f59e0b"
      backPath="/settings"
      wrapChildrenFullHeight={true}
      search={{
        placeholder: ts("search.placeholder", "Buscar estados..."),
        value: searchQuery,
        onChange: setSearchQuery
      }}
      headerActions={
        <div className="flex items-center gap-2">
          <Button 
            size="default"
            className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-[0.98]"
            onClick={() => {
            setFormName("");
            setFormAction("");
            setFormColor("#888888");
            setFormIcon("fas fa-circle");
            setFormInitial(false);
            setFormSystem(false);
            setFormCelebrationEnabled(true);
            setFormError(null);
            setCreateOpen(true);
          }}>
            <FontAwesomeIcon icon={faPlus} className="mr-2" />
            {ts("headerActions.add", "Agregar Estado")}
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
        title={ts("dialogs.create.title", "Crear Estado")}
        isSubmitting={isCreating}
        onSubmit={(e) => {
          e.preventDefault();
          if (!formName.trim()) { setFormError(ts("fields.validation.nameRequired", "El nombre es requerido")); return; }
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
              if (!allowedActions.includes(normalizedAction as any)) { setFormError(ts("fields.validation.invalidAction", "Acción inválida")); return; }
              const payload: any = {
                name: formName.trim(),
                action: normalizedAction,
                color: formColor,
                icon: formIcon,
                system: !!formSystem,
                initial: !!formInitial,
                celebration_enabled: !!formCelebrationEnabled
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
        <TextField label={ts("fields.name", "Nombre")} value={formName} onChange={setFormName} required />
        <SelectField label={ts("fields.action", "Acción")} value={formAction || 'NONE'} onChange={setFormAction} options={allowedActions.map(a => ({ value: a, label: a }))} />
        <TextField label={ts("fields.color", "Color")} value={formColor} onChange={setFormColor} type="color" />
        <IconPicker label={ts("fields.icon", "Icono")} value={formIcon} onChange={setFormIcon} color={formColor} />
        <CheckboxField label={ts("fields.initial", "Inicial")} checked={formInitial} onChange={setFormInitial} />
        <CheckboxField label={ts("fields.system", "Sistema")} checked={formSystem} onChange={setFormSystem} />
        <CheckboxField label={ts("fields.celebrationEnabled", "Enable Celebration")} checked={formCelebrationEnabled} onChange={setFormCelebrationEnabled} description={ts("fields.celebrationEnabledDescription", "Trigger celebration animation when tasks reach this status")} />
      </SettingsDialog>

      <SettingsDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        type="edit"
        title={ts("dialogs.edit.title", "Editar Estado")}
        isSubmitting={isUpdating}
        onSubmit={(e) => {
          e.preventDefault();
          if (!selectedStatus) return;
          if (!formName.trim()) { setFormError(ts("fields.validation.nameRequired", "El nombre es requerido")); return; }
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
              if (!allowedActions.includes(normalizedAction as any)) { setFormError(ts("fields.validation.invalidAction", "Acción inválida")); return; }
              const updates: any = {
                name: formName.trim(),
                action: normalizedAction,
                color: formColor,
                icon: formIcon,
                system: !!formSystem,
                initial: !!formInitial,
                celebration_enabled: !!formCelebrationEnabled
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
        footerActions={
          selectedStatus && !selectedStatus.system ? (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={() => {
                setEditOpen(false);
                setDeleteOpen(true);
              }}
              disabled={isUpdating}
              title={ts("dialogs.edit.deleteButton", "Eliminar")}
              aria-label={ts("dialogs.edit.deleteButton", "Eliminar")}
            >
              <FontAwesomeIcon icon={faTrash} />
            </Button>
          ) : null
        }
      >
        <TextField label={ts("fields.name", "Nombre")} value={formName} onChange={setFormName} required />
        <SelectField label={ts("fields.action", "Acción")} value={formAction || 'NONE'} onChange={setFormAction} options={allowedActions.map(a => ({ value: a, label: a }))} />
        <TextField label={ts("fields.color", "Color")} value={formColor} onChange={setFormColor} type="color" />
        <IconPicker label={ts("fields.icon", "Icono")} value={formIcon} onChange={setFormIcon} color={formColor} />
        <CheckboxField label={ts("fields.initial", "Inicial")} checked={formInitial} onChange={setFormInitial} />
        <CheckboxField label={ts("fields.system", "Sistema")} checked={formSystem} onChange={setFormSystem} />
      </SettingsDialog>

      <SettingsDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        type="delete"
        title={ts("dialogs.delete.title", "Eliminar Estado")}
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
          if (selectedStatus.system) { setFormError(ts("dialogs.delete.systemError", "Los estados del sistema no se pueden eliminar")); return; }
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