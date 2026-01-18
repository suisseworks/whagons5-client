import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDiagramProject } from "@fortawesome/free-solid-svg-icons";
import { SettingsLayout } from "../components";
import { SettingsGrid } from "../components/SettingsGrid";
import type { ColDef } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import api from "@/api/whagonsApi";
import { genericActions } from "@/store/genericSlices";
import { AppDispatch, RootState } from "@/store/store";
import { Workflow } from "@/store/types";

type NodeType = "trigger" | "condition" | "action" | "branch" | "delay";

type BuilderNode = {
  id: string;
  node_key: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  config?: Record<string, any>;
};

type BuilderEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
};

type WorkflowDraft = {
  id?: number;
  name: string;
  description?: string;
  is_active?: boolean;
  current_version_id?: number | null;
  nodes: BuilderNode[];
  edges: BuilderEdge[];
};

type WorkflowRunRecord = {
  id: number;
  trigger_source: string;
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
  error_message?: string | null;
  logs?: Array<{
    id: number;
    node_key?: string | null;
    action_type?: string | null;
    status: string;
    message?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
  }>;
};

const TRIGGER_EVENT_OPTIONS = [
  { value: "task.completed", label: "When a task is completed" },
  { value: "sla.breached", label: "When an SLA is breached" },
  { value: "approval.resolved", label: "When an approval is resolved" },
  { value: "manual", label: "Manual trigger" },
] as const;

const ACTION_TYPES = [
  { value: "notify_team", label: "Notify team" },
  { value: "send_email", label: "Send email" },
  { value: "create_task", label: "Create follow-up task" },
] as const;

const newId = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

const createTriggerNode = (event = TRIGGER_EVENT_OPTIONS[0].value): BuilderNode => {
  const key = newId("trigger");
  return {
    id: key,
    node_key: key,
    type: "trigger",
    label: "Trigger",
    x: 0,
    y: 0,
    config: { event },
  };
};

const createConditionNode = (expression = ""): BuilderNode => {
  const key = newId("condition");
  return {
    id: key,
    node_key: key,
    type: "condition",
    label: expression || "Condition",
    x: 0,
    y: 0,
    config: { expression },
  };
};

const createActionNode = (actionType = ACTION_TYPES[0].value, notes = ""): BuilderNode => {
  const key = newId("action");
  const actionLabel = ACTION_TYPES.find(a => a.value === actionType)?.label ?? "Action";
  return {
    id: key,
    node_key: key,
    type: "action",
    label: actionLabel,
    x: 0,
    y: 0,
    config: { action_type: actionType, notes },
  };
};

const buildLinearEdges = (nodes: BuilderNode[]): BuilderEdge[] => {
  const ordered = [
    ...nodes.filter(n => n.type === "trigger"),
    ...nodes.filter(n => n.type === "condition"),
    ...nodes.filter(n => n.type === "action"),
  ];

  const edges: BuilderEdge[] = [];
  for (let i = 0; i < ordered.length - 1; i += 1) {
    const from = ordered[i];
    const to = ordered[i + 1];
    if (from && to) {
      edges.push({
        id: `${from.id}-${to.id}`,
        from: from.id,
        to: to.id,
        label: "",
      });
    }
  }
  return edges;
};

const normalizeNode = (node: any): BuilderNode => {
  const key = node?.node_key ?? node?.id ?? newId("node");
  return {
    id: key,
    node_key: key,
    type: (node?.type ?? "action") as NodeType,
    label: node?.label ?? (node?.type ?? "Node"),
    x: node?.x ?? node?.position_x ?? 0,
    y: node?.y ?? node?.position_y ?? 0,
    config: node?.config ?? {},
  };
};

const normalizeEdge = (edge: any): BuilderEdge => ({
  id: edge?.id ? String(edge.id) : newId("edge"),
  from: edge?.source_node_key ?? edge?.from ?? "",
  to: edge?.target_node_key ?? edge?.to ?? "",
  label: edge?.label ?? "",
});

const createEmptyDraft = (): WorkflowDraft => {
  const nodes = [createTriggerNode()];
  return {
    name: "Untitled workflow",
    description: "",
    nodes,
    edges: buildLinearEdges(nodes),
  };
};

const mapWorkflowToDraft = (workflow: Workflow & { current_version?: any }): WorkflowDraft => {
  const version = (workflow as any).current_version ?? {};
  let nodes = Array.isArray(version?.nodes) ? version.nodes.map(normalizeNode) : [];
  if (!nodes.some(n => n.type === "trigger")) {
    nodes = [createTriggerNode(), ...nodes];
  }
  const edges = buildLinearEdges(nodes);
  return {
    id: workflow.id,
    name: workflow.name ?? "Untitled workflow",
    description: workflow.description ?? "",
    is_active: (workflow as any).is_active ?? false,
    current_version_id: (workflow as any).current_version_id ?? version?.id ?? null,
    nodes,
    edges,
  };
};

const WIZARD_STEPS = [
  { id: "trigger", label: "Trigger", description: "When should it fire?" },
  { id: "conditions", label: "Conditions", description: "Optional filters" },
  { id: "actions", label: "Actions", description: "What should happen" },
  { id: "review", label: "Review", description: "Verify & automate" },
] as const;

function Workflows() {
  const dispatch = useDispatch<AppDispatch>();
  const workflowsState = useSelector((s: RootState) => (s as any).workflows);
  const workflows = workflowsState?.value ?? [];
  const workflowsLoading = workflowsState?.loading;
  const workflowsError = workflowsState?.error;

  const [draft, setDraft] = useState<WorkflowDraft>(() => createEmptyDraft());
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [runHistory, setRunHistory] = useState<WorkflowRunRecord[]>([]);
  const [runHistoryLoading, setRunHistoryLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const triggerNode = useMemo(
    () => draft.nodes.find(n => n.type === "trigger") ?? createTriggerNode(),
    [draft.nodes]
  );
  const conditions = useMemo(() => draft.nodes.filter(n => n.type === "condition"), [draft.nodes]);
  const actions = useMemo(() => draft.nodes.filter(n => n.type === "action"), [draft.nodes]);
  const updateNodes = useCallback((updater: (nodes: BuilderNode[]) => BuilderNode[]) => {
    setDraft(prev => {
      const nodes = updater(prev.nodes);
      return { ...prev, nodes, edges: buildLinearEdges(nodes) };
    });
    setIsDirty(true);
  }, []);

  const handleTriggerChange = (eventValue: string) => {
    updateNodes((nodes) => {
      const existing = nodes.find(n => n.type === "trigger");
      if (existing) {
        return nodes.map(n => n.id === existing.id ? {
          ...n,
          config: { ...(n.config ?? {}), event: eventValue },
        } : n);
      }
      return [createTriggerNode(eventValue), ...nodes];
    });
  };

  const handleTriggerDetailsChange = (details: string) => {
    updateNodes((nodes) => nodes.map(n => n.id === triggerNode.id ? ({
      ...n,
      config: { ...(n.config ?? {}), details },
    }) : n));
  };

  const handleAddCondition = () => {
    updateNodes(nodes => [...nodes, createConditionNode("")]);
  };

  const handleConditionChange = (id: string, value: string) => {
    updateNodes(nodes => nodes.map(n => {
      if (n.id !== id) return n;
      return {
        ...n,
        label: value || "Condition",
        config: { ...(n.config ?? {}), expression: value },
      };
    }));
  };

  const handleRemoveCondition = (id: string) => {
    updateNodes(nodes => nodes.filter(n => n.id !== id));
  };

  const handleAddAction = () => {
    updateNodes(nodes => [...nodes, createActionNode()]);
  };

  const handleActionTypeChange = (id: string, value: string) => {
    updateNodes(nodes => nodes.map(n => {
      if (n.id !== id) return n;
      const label = ACTION_TYPES.find(action => action.value === value)?.label ?? "Action";
      return {
        ...n,
        label,
        config: { ...(n.config ?? {}), action_type: value },
      };
    }));
  };

  const handleActionNotesChange = (id: string, value: string) => {
    updateNodes(nodes => nodes.map(n => n.id === id ? ({
      ...n,
      config: { ...(n.config ?? {}), notes: value },
    }) : n));
  };

  const handleRemoveAction = (id: string) => {
    updateNodes(nodes => nodes.filter(n => n.id !== id));
  };

  const isTriggerStepValid = Boolean(triggerNode?.config?.event);
  const isActionsStepValid = actions.length > 0 && actions.every(action => action.config?.action_type);

  const canProceedFromStep = useCallback((stepIndex: number) => {
    switch (stepIndex) {
      case 0:
        return isTriggerStepValid;
      case 1:
        return true;
      case 2:
        return isActionsStepValid;
      default:
        return isTriggerStepValid && isActionsStepValid;
    }
  }, [isTriggerStepValid, isActionsStepValid]);

  const canNavigateToStep = useCallback((target: number) => {
    if (target <= currentStep) return true;
    for (let index = 0; index < target; index += 1) {
      if (!canProceedFromStep(index)) return false;
    }
    return true;
  }, [currentStep, canProceedFromStep]);

  const handleNextStep = () => {
    if (currentStep >= WIZARD_STEPS.length - 1) return;
    if (!canProceedFromStep(currentStep)) return;
    setCurrentStep((prev) => prev + 1);
  };

  const handlePreviousStep = () => {
    if (currentStep === 0) return;
    setCurrentStep((prev) => prev - 1);
  };

  const previewSummary = useMemo(() => ({
    trigger: TRIGGER_EVENT_OPTIONS.find(option => option.value === (triggerNode.config?.event ?? ""))?.label ?? "Not configured",
    triggerDetails: triggerNode.config?.details ?? "",
    conditions: conditions.map(condition => condition.config?.expression || "No expression"),
    actions: actions.map(action => ({
      label: ACTION_TYPES.find(item => item.value === action.config?.action_type)?.label ?? "Action",
      notes: action.config?.notes ?? "",
    })),
  }), [triggerNode, conditions, actions]);

  const workflowColumns = useMemo<ColDef[]>(() => [
    {
      headerName: "Name",
      field: "name",
      flex: 1,
      minWidth: 180,
      tooltipField: "name",
    },
    {
      headerName: "Description",
      field: "description",
      flex: 1.4,
      minWidth: 220,
      tooltipField: "description",
    },
    {
      headerName: "Status",
      valueGetter: (params) => (params.data?.is_active ? "Active" : "Draft"),
      width: 120,
    },
    {
      headerName: "Updated",
      valueGetter: (params) => {
        const date = params.data?.updated_at || params.data?.created_at;
        if (!date) return "-";
        return new Date(date).toLocaleDateString();
      },
      width: 140,
    },
  ], []);

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Trigger event</Label>
              <Select value={triggerNode.config?.event ?? ""} onValueChange={handleTriggerChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_EVENT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Details</Label>
              <Textarea
                placeholder="Add optional context for this trigger."
                value={triggerNode.config?.details ?? ""}
                onChange={(e) => handleTriggerDetailsChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Describe any specific criteria users should know about this trigger.
              </p>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            {conditions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No conditions yet. Add optional expressions to further filter when this workflow runs.
              </p>
            )}
            {conditions.map((condition) => (
              <Card key={condition.id} className="p-3 space-y-2 border-dashed">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase text-muted-foreground">Condition</Label>
                  <Button size="xs" variant="ghost" onClick={() => handleRemoveCondition(condition.id)}>
                    Remove
                  </Button>
                </div>
                <Textarea
                  placeholder="Example: task.priority === 'high'"
                  value={condition.config?.expression ?? ""}
                  onChange={(e) => handleConditionChange(condition.id, e.target.value)}
                />
              </Card>
            ))}
            <Button variant="outline" size="sm" onClick={handleAddCondition}>
              Add condition
            </Button>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            {actions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Add one or more actions to define what should happen after the trigger (and optional conditions) pass.
              </p>
            )}
            {actions.map((action) => (
              <Card key={action.id} className="p-3 space-y-3 border-dashed">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase text-muted-foreground">Action</Label>
                  <Button size="xs" variant="ghost" onClick={() => handleRemoveAction(action.id)}>
                    Remove
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Action type</Label>
                  <Select value={action.config?.action_type ?? ""} onValueChange={(value) => handleActionTypeChange(action.id, value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an action" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Notes or instructions</Label>
                  <Textarea
                    placeholder="Add any extra context the recipients should know."
                    value={action.config?.notes ?? ""}
                    onChange={(e) => handleActionNotesChange(action.id, e.target.value)}
                  />
                </div>
              </Card>
            ))}
            <Button variant="outline" size="sm" onClick={handleAddAction}>
              Add action
            </Button>
          </div>
        );
      default:
        return (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-md border p-4 text-sm">
              <div>
                <div className="font-medium">Trigger</div>
                <div className="text-muted-foreground">{previewSummary.trigger}</div>
                {previewSummary.triggerDetails && (
                  <div className="text-muted-foreground">{previewSummary.triggerDetails}</div>
                )}
              </div>
              <div>
                <div className="font-medium">Conditions</div>
                {previewSummary.conditions.length === 0 ? (
                  <div className="text-muted-foreground">No additional conditions</div>
                ) : (
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {previewSummary.conditions.map((condition, idx) => (
                      <li key={`${condition}-${idx}`}>{condition}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="font-medium">Actions</div>
                {previewSummary.actions.length === 0 ? (
                  <div className="text-muted-foreground">No actions configured</div>
                ) : (
                  <ul className="space-y-2">
                    {previewSummary.actions.map((action, idx) => (
                      <li key={`${action.label}-${idx}`}>
                        <div className="font-medium">{action.label}</div>
                        {action.notes && <div className="text-muted-foreground text-sm">{action.notes}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={!isTriggerStepValid || !isActionsStepValid || isSaving}
            >
              {isSaving ? "Saving..." : draft.id ? "Save changes" : "Create workflow"}
            </Button>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="border rounded-md p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">Advanced controls</div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {advancedOpen ? "Hide" : "Show"}
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleTestRun} disabled={isTesting || !draft.id}>
                    {isTesting ? "Testing..." : "Test run"}
                  </Button>
                  {draft.id && (
                    draft.is_active ? (
                      <Button variant="outline" onClick={handleDeactivate} disabled={isActivating}>
                        {isActivating ? "Working..." : "Deactivate"}
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={handleActivate} disabled={isActivating || !draft.current_version_id}>
                        {isActivating ? "Working..." : "Activate"}
                      </Button>
                    )
                  )}
                  {draft.id && (
                    <Button variant="destructive" onClick={() => handleDeleteWorkflow(draft.id)} disabled={isDeleting}>
                      {isDeleting ? "Deleting..." : "Delete workflow"}
                    </Button>
                  )}
                </div>
                <div>
                  <div className="font-medium mb-2">Recent runs</div>
                  {!draft.id && (
                    <div className="text-sm text-muted-foreground">Save this workflow to view its history.</div>
                  )}
                  {draft.id && runHistoryLoading && (
                    <div className="text-sm text-muted-foreground">Loading run history...</div>
                  )}
                  {draft.id && !runHistoryLoading && runHistory.length === 0 && (
                    <div className="text-sm text-muted-foreground">No runs recorded yet.</div>
                  )}
                  {draft.id && runHistory.length > 0 && (
                    <div className="space-y-2 max-h-56 overflow-auto">
                      {runHistory.map(run => (
                        <div key={run.id} className="rounded-md border p-2 text-xs space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold capitalize">{run.status}</div>
                            <div className="opacity-60">{run.started_at ? new Date(run.started_at).toLocaleString() : 'Pending'}</div>
                          </div>
                          <div className="text-muted-foreground">Trigger: {run.trigger_source}</div>
                          {run.error_message && (
                            <div className="text-red-600">{run.error_message}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
    }
  };

  useEffect(() => {
    dispatch(genericActions.workflows.getFromIndexedDB());
    dispatch(genericActions.workflows.fetchFromAPI());
  }, [dispatch]);

  const handleLoadWorkflow = useCallback((workflow: Workflow) => {
    setDraft(mapWorkflowToDraft(workflow));
    setSelectedWorkflowId(workflow.id);
    setIsDirty(false);
    setStatusMessage(null);
    setApiError(null);
    setCurrentStep(0);
    setAdvancedOpen(false);
    setIsEditorOpen(true);
  }, []);

  useEffect(() => {
    if (!workflows.length) {
      if (selectedWorkflowId !== null && !isDirty) {
        setSelectedWorkflowId(null);
        setDraft(createEmptyDraft());
      }
      return;
    }
    if (!isDirty && selectedWorkflowId !== null) {
      const latest = workflows.find(w => w.id === selectedWorkflowId);
      if (latest) {
        setDraft(mapWorkflowToDraft(latest));
      }
      return;
    }
    if (!isDirty && workflows.length && selectedWorkflowId === null) {
      handleLoadWorkflow(workflows[0]);
    }
  }, [workflows, selectedWorkflowId, isDirty, handleLoadWorkflow]);

  useEffect(() => {
    if (!draft.id) {
      setRunHistory([]);
      return;
    }
    let cancelled = false;
    setRunHistoryLoading(true);
    api.get(`/workflows/${draft.id}`)
      .then(resp => {
        if (cancelled) return;
        setRunHistory(resp.data?.data?.runs ?? []);
      })
      .catch(() => {
        if (!cancelled) setRunHistory([]);
      })
      .finally(() => {
        if (!cancelled) setRunHistoryLoading(false);
      });
    return () => { cancelled = true; };
  }, [draft.id]);

  const handleNew = useCallback(() => {
    setDraft(createEmptyDraft());
    setSelectedWorkflowId(null);
    setIsDirty(false);
    setStatusMessage(null);
    setApiError(null);
    setCurrentStep(0);
    setAdvancedOpen(false);
    setIsEditorOpen(true);
  }, []);

  const refreshWorkflows = useCallback(() => {
    return dispatch(genericActions.workflows.fetchFromAPI());
  }, [dispatch]);

  const handleLoadById = useCallback((id: number) => {
    const workflow = workflows.find(w => w.id === id);
    if (workflow) {
      handleLoadWorkflow(workflow);
    }
  }, [workflows, handleLoadWorkflow]);

  const duplicateWorkflowDraft = useCallback((source?: WorkflowDraft | (Workflow & { current_version?: any })) => {
    const normalized = source
      ? ("current_version" in (source as any) ? mapWorkflowToDraft(source as any) : source as WorkflowDraft)
      : draft;
    const cloneNodes = normalized.nodes.map(node => ({
      ...node,
      id: newId("node"),
      node_key: `${node.node_key}-copy-${Math.random().toString(36).slice(2, 6)}`,
    }));
    const cloneEdges = normalized.edges.map(edge => ({ ...edge, id: newId("e") }));
    setDraft({
      ...normalized,
      id: undefined,
      is_active: false,
      current_version_id: null,
      name: `Copy of ${normalized.name}`,
      nodes: cloneNodes,
      edges: cloneEdges,
    });
    setSelectedWorkflowId(null);
    setIsDirty(true);
    setStatusMessage("Duplicated locally. Save to create a new workflow.");
  }, [draft]);

  const handleDeleteWorkflow = useCallback(async (id?: number) => {
    if (!id) return;
    setIsDeleting(true);
    setApiError(null);
    try {
      await dispatch(genericActions.workflows.removeAsync(id)).unwrap();
      setStatusMessage("Workflow deleted");
      if (selectedWorkflowId === id) {
        handleNew();
      }
      await refreshWorkflows();
    } catch (error: any) {
      setApiError(error?.message ?? "Failed to delete workflow");
    } finally {
      setIsDeleting(false);
    }
  }, [dispatch, handleNew, refreshWorkflows, selectedWorkflowId]);

  const buildPayload = useCallback(() => {
    return {
      name: draft.name,
      description: draft.description,
      metadata: { builder_version: 1 },
      nodes: draft.nodes.map(node => ({
        node_key: node.node_key,
        type: node.type,
        label: node.label,
        config: node.config ?? {},
        position_x: node.x,
        position_y: node.y,
      })),
      edges: draft.edges.map(edge => ({
        source_node_key: edge.from,
        target_node_key: edge.to,
        label: edge.label,
      })),
    };
  }, [draft]);

  const handleSave = useCallback(async () => {
    if (!draft.name.trim()) {
      setApiError("Workflow name is required.");
      return;
    }
    setIsSaving(true);
    setApiError(null);
    try {
      const payload = buildPayload();
      if (draft.id) {
        await dispatch(genericActions.workflows.updateAsync({ id: draft.id, updates: payload })).unwrap();
        setStatusMessage("Workflow updated.");
        const latest = workflows.find(w => w.id === draft.id);
        if (latest) handleLoadWorkflow(latest);
      } else {
        const created = await dispatch(genericActions.workflows.addAsync(payload as any)).unwrap();
        setStatusMessage("Workflow created.");
        if (created) {
          handleLoadWorkflow(created as Workflow);
        }
      }
      setIsDirty(false);
      await refreshWorkflows();
    } catch (error: any) {
      setApiError(error?.message ?? "Failed to save workflow.");
    } finally {
      setIsSaving(false);
    }
  }, [draft, buildPayload, dispatch, refreshWorkflows, workflows, handleLoadWorkflow]);

  const handleTestRun = useCallback(async () => {
    if (!draft.id) {
      setApiError("Save the workflow before running a test.");
      return;
    }
    setIsTesting(true);
    setApiError(null);
    try {
      const response = await api.post(`/workflows/${draft.id}/test`, {
        trigger_source: "manual",
        requested_by: undefined,
        data: { preview: true },
      });
      setStatusMessage(`Test run recorded (run #${response.data?.data?.id ?? "pending"})`);
    } catch (error: any) {
      setApiError(error?.response?.data?.message ?? "Failed to run test.");
    } finally {
      setIsTesting(false);
    }
  }, [draft.id]);

  const handleActivate = useCallback(async () => {
    if (!draft.id || !draft.current_version_id) {
      setApiError("Workflow version missing. Save first.");
      return;
    }
    setIsActivating(true);
    setApiError(null);
    try {
      await api.post(`/workflows/${draft.id}/activate`, { version_id: draft.current_version_id });
      setStatusMessage("Workflow activated.");
      setIsDirty(false);
      await refreshWorkflows();
    } catch (error: any) {
      setApiError(error?.response?.data?.message ?? "Failed to activate workflow.");
    } finally {
      setIsActivating(false);
    }
  }, [draft.id, draft.current_version_id, refreshWorkflows]);

  const handleDeactivate = useCallback(async () => {
    if (!draft.id) return;
    setIsActivating(true);
    setApiError(null);
    try {
      await api.post(`/workflows/${draft.id}/deactivate`);
      setStatusMessage("Workflow deactivated.");
      await refreshWorkflows();
    } catch (error: any) {
      setApiError(error?.response?.data?.message ?? "Failed to deactivate workflow.");
    } finally {
      setIsActivating(false);
    }
  }, [draft.id, refreshWorkflows]);

  const addNode = (type: NodeType) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const centerX = rect ? rect.width / 2 : 300;
    const centerY = rect ? rect.height / 2 : 200;
    const nodeKey = newId("node");
    const node: BuilderNode = {
      id: nodeKey,
      node_key: nodeKey,
      type,
      label: type.charAt(0).toUpperCase() + type.slice(1),
      x: Math.round(centerX - 60 + Math.random() * 80),
      y: Math.round(centerY - 20 + Math.random() * 60),
      config: type === "trigger" ? { event: TRIGGER_EVENT_OPTIONS[0].value } : {},
    };
    setDraft(d => ({ ...d, nodes: [...d.nodes, node] }));
    setSelectedNodeId(node.id);
    setIsDirty(true);
  };

  const removeNode = (id: string) => {
    setDraft(d => ({
      ...d,
      nodes: d.nodes.filter(n => n.id !== id),
      edges: d.edges.filter(e => e.from !== id && e.to !== id)
    }));
    if (selectedNodeId === id) setSelectedNodeId(null);
    setIsDirty(true);
  };

  const connectSelectedTo = (targetId: string) => {
    if (!selectedNodeId || selectedNodeId === targetId) return;
    const id = newId("e");
    setDraft(d => ({ ...d, edges: [...d.edges, { id, from: selectedNodeId, to: targetId }] }));
    setIsDirty(true);
  };

  const onNodePointerDown = (e: ReactPointerEvent<HTMLDivElement>, node: BuilderNode) => {
    const target = e.currentTarget as HTMLDivElement;
    target.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    dragRef.current = { id: node.id, dx: startX - node.x, dy: startY - node.y };
  };

  const onCanvasPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const x = e.clientX - drag.dx;
    const y = e.clientY - drag.dy;
    setDraft(d => ({
      ...d,
      nodes: d.nodes.map(n => n.id === drag.id ? { ...n, x: Math.round(x), y: Math.round(y) } : n)
    }));
    setIsDirty(true);
  };

  const onCanvasPointerUp = () => { dragRef.current = null; };

  const templateAutoAssign = () => {
    const triggerId = newId("node");
    const conditionId = newId("node");
    const actionId = newId("node");
    const nodes: BuilderNode[] = [
      { id: triggerId, node_key: triggerId, type: "trigger", label: "On Task Created", x: 120, y: 80, config: { event: "task.completed" } },
      { id: conditionId, node_key: conditionId, type: "condition", label: "Priority = High", x: 360, y: 80, config: { expression: "task.priority === 'high'" } },
      { id: actionId, node_key: actionId, type: "action", label: "Assign Team", x: 600, y: 80, config: { action_type: "notify_team" } },
    ];
    const edges: BuilderEdge[] = [
      { id: newId("e"), from: triggerId, to: conditionId },
      { id: newId("e"), from: conditionId, to: actionId },
    ];
    setDraft(d => ({ ...d, name: "Auto-assign urgent", nodes, edges }));
    setSelectedNodeId(actionId);
    setIsDirty(true);
  };

  const updateNodeField = (nodeId: string, updates: Partial<BuilderNode>) => {
    setDraft(d => ({
      ...d,
      nodes: d.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n),
    }));
    setIsDirty(true);
  };

  const updateNodeConfig = (nodeId: string, key: string, value: any) => {
    setDraft(d => ({
      ...d,
      nodes: d.nodes.map(n => n.id === nodeId ? {
        ...n,
        config: { ...(n.config ?? {}), [key]: value },
      } : n),
    }));
    setIsDirty(true);
  };

  const NodeView = ({ node }: { node: BuilderNode }) => (
    <div
      role="button"
      onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
      onDoubleClick={(e) => { e.stopPropagation(); if (selectedNodeId) connectSelectedTo(node.id); }}
      onPointerDown={(e) => onNodePointerDown(e, node)}
      className={`absolute select-none shadow-sm rounded-md border bg-card px-3 py-2 cursor-grab active:cursor-grabbing transition outline-offset-2 ${selectedNodeId === node.id ? 'ring-2 ring-cyan-400' : ''}`}
      style={{ left: node.x, top: node.y, width: 160 }}
    >
      <div className="flex items-center gap-2">
        <div className="text-cyan-500">
          <FontAwesomeIcon icon={nodeIcon(node.type)} />
        </div>
        <div className="font-medium text-sm truncate">{node.label}</div>
        <div className="ml-auto text-[10px] uppercase opacity-60">{node.type}</div>
      </div>
    </div>
  );

  const EdgesView = () => {
    return (
      <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
        {draft.edges.map(edge => {
          const from = draft.nodes.find(n => n.id === edge.from);
          const to = draft.nodes.find(n => n.id === edge.to);
          if (!from || !to) return null;
          const x1 = from.x + 80; const y1 = from.y + 18;
          const x2 = to.x + 80; const y2 = to.y + 18;
          const mx = (x1 + x2) / 2;
          const path = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
          return <path key={edge.id} d={path} stroke="#06b6d4" strokeWidth="2" fill="none" />;
        })}
      </svg>
    );
  };

  // Basic validation rules
  const validation = useMemo(() => {
    const issues: { type: string; message: string; nodeId?: string }[] = [];
    if (!draft.nodes.some(n => n.type === "trigger")) {
      issues.push({ type: "error", message: "At least one Trigger is required." });
    }
    draft.nodes.forEach(n => {
      const incoming = draft.edges.filter(e => e.to === n.id).length;
      const outgoing = draft.edges.filter(e => e.from === n.id).length;
      if (n.type !== "trigger" && incoming === 0) {
        issues.push({ type: "warning", message: `Node '${n.label}' has no incoming connection.`, nodeId: n.id });
      }
      if (n.type !== "delay" && outgoing === 0) {
        issues.push({ type: "warning", message: `Node '${n.label}' is a dead end.`, nodeId: n.id });
      }
    });
    return issues;
  }, [draft.nodes, draft.edges]);

  const renderNodeConfigFields = () => {
    if (!selectedNode) return null;
    switch (selectedNode.type) {
      case "trigger":
        return (
          <div className="space-y-2">
            <Label className="text-xs">Trigger event</Label>
            <Select value={selectedNode.config?.event ?? ""} onValueChange={(value) => updateNodeConfig(selectedNode.id, "event", value)}>
              {TRIGGER_EVENT_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </Select>
          </div>
        );
      case "action":
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Action type</Label>
              <Select value={selectedNode.config?.action_type ?? ""} onValueChange={(value) => updateNodeConfig(selectedNode.id, "action_type", value)}>
                {ACTION_TYPES.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Notes</Label>
              <Textarea
                placeholder="Describe what this action should do"
                value={selectedNode.config?.notes ?? ""}
                onChange={(e) => updateNodeConfig(selectedNode.id, "notes", e.target.value)}
              />
            </div>
          </div>
        );
      case "condition":
        return (
          <div className="space-y-2">
            <Label className="text-xs">Condition expression</Label>
            <Textarea
              placeholder="Example: task.priority === 'high'"
              value={selectedNode.config?.expression ?? ""}
              onChange={(e) => updateNodeConfig(selectedNode.id, "expression", e.target.value)}
            />
          </div>
        );
      case "delay":
        return (
          <div className="space-y-2">
            <Label className="text-xs">Delay (minutes)</Label>
            <Input
              type="number"
              min={1}
              value={selectedNode.config?.duration_minutes ?? 5}
              onChange={(e) => updateNodeConfig(selectedNode.id, "duration_minutes", Number(e.target.value))}
            />
          </div>
        );
      default:
        return null;
    }
  };

  const fetchErrorMessage = workflowsError ? "Unable to load workflows. Please refresh to try again." : null;

  return (
    <SettingsLayout
      title="Workflows"
      description="Design multi-step automations with triggers, conditions, and actions."
      icon={faDiagramProject}
      iconColor="#06b6d4"
      backPath="/settings"
      headerActions={
        <Button 
          onClick={handleNew}
          size="default"
          className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-[0.98]"
        >
          Create workflow
        </Button>
      }
    >
      <div className="flex h-full flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">
            {workflows.length} workflow{workflows.length === 1 ? "" : "s"}
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search workflows"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48"
            />
            <Button variant="ghost" size="sm" onClick={() => refreshWorkflows()} disabled={Boolean(workflowsLoading)}>
              Refresh
            </Button>
          </div>
        </div>

        {fetchErrorMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center justify-between gap-2">
            <span>{fetchErrorMessage}</span>
            <Button size="sm" variant="ghost" onClick={() => refreshWorkflows()}>
              Try again
            </Button>
          </div>
        )}

        <div className="flex-1 min-h-0 rounded-lg border bg-card p-2">
          <SettingsGrid
            rowData={workflows}
            columnDefs={workflowColumns}
            rowSelection="single"
            quickFilterText={searchTerm}
            noRowsMessage="No workflows yet"
            onRowClicked={(row) => row?.id && handleLoadById(row.id)}
            onRowDoubleClicked={(row) => row?.id && handleLoadById(row.id)}
          />
        </div>
      </div>

      <Dialog open={isEditorOpen} onOpenChange={(open) => setIsEditorOpen(open)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit workflow" : "Create workflow"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">Workflow details</div>
                <span className={`text-xs px-2 py-1 rounded-full border ${isDirty ? "border-yellow-400 text-yellow-600" : "border-muted text-muted-foreground"}`}>
                  {isDirty ? "Unsaved changes" : "Up to date"}
                </span>
              </div>
              {apiError && <div className="text-sm text-red-600">{apiError}</div>}
              {statusMessage && <div className="text-sm text-emerald-600">{statusMessage}</div>}
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => { setDraft(prev => ({ ...prev, name: e.target.value })); setIsDirty(true); }}
                  placeholder="Name this workflow"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={draft.description}
                  onChange={(e) => { setDraft(prev => ({ ...prev, description: e.target.value })); setIsDirty(true); }}
                  placeholder="Explain what this automation should accomplish."
                />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex flex-wrap gap-3">
                {WIZARD_STEPS.map((step, index) => {
                  const canAccess = canNavigateToStep(index);
                  const isActive = index === currentStep;
                  return (
                    <button
                      key={step.id}
                      onClick={() => canAccess && setCurrentStep(index)}
                      disabled={!canAccess}
                      className={`flex items-center gap-3 rounded-md border px-3 py-2 text-left transition ${
                        isActive ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/50" : "border-muted"
                      } ${!canAccess ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                        isActive ? "bg-cyan-500 text-white" : "bg-muted text-foreground"
                      }`}>
                        {index + 1}
                      </span>
                      <span>
                        <div className="font-medium">{step.label}</div>
                        <div className="text-xs text-muted-foreground">{step.description}</div>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4 space-y-4">
              {renderStepContent()}
              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" onClick={handlePreviousStep} disabled={currentStep === 0}>
                  Back
                </Button>
                {currentStep < WIZARD_STEPS.length - 1 ? (
                  <Button onClick={handleNextStep} disabled={!canProceedFromStep(currentStep)}>
                    Next
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
                      Close
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SettingsLayout>
  );
}

export default Workflows;
