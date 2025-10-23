import { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDiagramProject, faBolt, faCodeBranch, faClock, faFilter, faPlay } from "@fortawesome/free-solid-svg-icons";
import { SettingsLayout } from "../components";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

type NodeType = "trigger" | "condition" | "action" | "branch" | "delay";

type WorkflowNode = {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
};

type WorkflowEdge = {
  id: string;
  from: string; // node id
  to: string;   // node id
};

type WorkflowDraft = {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};
const STORAGE_KEYS = {
  drafts: "wh-workflow-drafts",
  last: "wh-workflow-last",
} as const;

const nodeIcon = (type: NodeType) => {
  switch (type) {
    case "trigger": return faPlay;
    case "condition": return faFilter;
    case "action": return faBolt;
    case "branch": return faCodeBranch;
    case "delay": return faClock;
  }
};

const newId = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

function Workflows() {
  const [drafts, setDrafts] = useState<WorkflowDraft[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.drafts);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
  const [draft, setDraft] = useState<WorkflowDraft>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.drafts);
      const last = localStorage.getItem(STORAGE_KEYS.last);
      if (raw) {
        const list: WorkflowDraft[] = JSON.parse(raw);
        const found = last ? list.find(d => d.id === last) : list[0];
        if (found) return found;
      }
    } catch {}
    const initial = { id: newId("wf"), name: "Untitled workflow", nodes: [], edges: [] } as WorkflowDraft;
    try { localStorage.setItem(STORAGE_KEYS.drafts, JSON.stringify([initial])); } catch {}
    try { localStorage.setItem(STORAGE_KEYS.last, initial.id); } catch {}
    return initial;
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = useMemo(() => draft.nodes.find(n => n.id === selectedNodeId) || null, [draft.nodes, selectedNodeId]);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  // keep drafts list in sync with the active draft and persist
  useEffect(() => {
    setDrafts(prev => {
      const exists = prev.some(d => d.id === draft.id);
      const next = exists ? prev.map(d => d.id === draft.id ? draft : d) : [...prev, draft];
      try { localStorage.setItem(STORAGE_KEYS.drafts, JSON.stringify(next)); } catch {}
      try { localStorage.setItem(STORAGE_KEYS.last, draft.id); } catch {}
      return next;
    });
  }, [draft]);

  const addNode = (type: NodeType) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const centerX = rect ? rect.width / 2 : 300;
    const centerY = rect ? rect.height / 2 : 200;
    const node: WorkflowNode = {
      id: newId("n"),
      type,
      label: type.charAt(0).toUpperCase() + type.slice(1),
      x: Math.round(centerX - 60 + Math.random() * 80),
      y: Math.round(centerY - 20 + Math.random() * 60),
    };
    setDraft(d => ({ ...d, nodes: [...d.nodes, node] }));
    setSelectedNodeId(node.id);
  };

  const removeNode = (id: string) => {
    setDraft(d => ({
      ...d,
      nodes: d.nodes.filter(n => n.id !== id),
      edges: d.edges.filter(e => e.from !== id && e.to !== id)
    }));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const connectSelectedTo = (targetId: string) => {
    if (!selectedNodeId || selectedNodeId === targetId) return;
    const id = newId("e");
    setDraft(d => ({ ...d, edges: [...d.edges, { id, from: selectedNodeId, to: targetId }] }));
  };

  const onNodePointerDown = (e: React.PointerEvent, node: WorkflowNode) => {
    const target = e.currentTarget as HTMLDivElement;
    target.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    dragRef.current = { id: node.id, dx: startX - node.x, dy: startY - node.y };
  };

  const onCanvasPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const x = e.clientX - drag.dx;
    const y = e.clientY - drag.dy;
    setDraft(d => ({
      ...d,
      nodes: d.nodes.map(n => n.id === drag.id ? { ...n, x: Math.round(x), y: Math.round(y) } : n)
    }));
  };

  const onCanvasPointerUp = () => { dragRef.current = null; };

  const clearDraft = () => {
    setDraft({ id: newId("wf"), name: "Untitled workflow", nodes: [], edges: [] });
    setSelectedNodeId(null);
  };

  const loadDraft = (id: string) => {
    const found = drafts.find(d => d.id === id);
    if (found) { setDraft(found); setSelectedNodeId(null); }
  };

  const newDraft = () => {
    const d: WorkflowDraft = { id: newId("wf"), name: "Untitled workflow", nodes: [], edges: [] };
    setDraft(d);
  };

  const duplicateDraft = (id: string) => {
    const src = drafts.find(d => d.id === id);
    if (!src) return;
    const copy: WorkflowDraft = { ...src, id: newId("wf"), name: `Copy of ${src.name}` };
    setDraft(copy);
  };

  const deleteDraft = (id: string) => {
    const remaining = drafts.filter(d => d.id !== id);
    setDrafts(remaining);
    let next = remaining[0] || { id: newId("wf"), name: "Untitled workflow", nodes: [], edges: [] };
    setDraft(next);
  };

  const templateAutoAssign = () => {
    const t: WorkflowDraft = {
      id: newId("wf"),
      name: "Auto-assign urgent",
      nodes: [
        { id: "n1", type: "trigger", label: "On Task Created", x: 120, y: 80 },
        { id: "n2", type: "condition", label: "Priority = High", x: 360, y: 80 },
        { id: "n3", type: "action", label: "Assign Team", x: 600, y: 80 },
      ],
      edges: [
        { id: "e1", from: "n1", to: "n2" },
        { id: "e2", from: "n2", to: "n3" },
      ]
    };
    setDraft(t);
    setSelectedNodeId("n3");
  };

  const NodeView = ({ node }: { node: WorkflowNode }) => (
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

  return (
    <SettingsLayout
      title="Workflows"
      description="Visual builder MVP (local-only draft)"
      icon={faDiagramProject}
      iconColor="#06b6d4"
      backPath="/settings"
    >
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-180px)]">
        {/* Palette + Drafts */}
        <div className="col-span-12 md:col-span-3 space-y-3">
          <Card className="p-3 space-y-3">
            <div className="text-sm font-medium opacity-80">Drafts</div>
            <div className="space-y-2 max-h-56 overflow-auto pr-1">
              {drafts.length === 0 && (
                <div className="text-sm text-muted-foreground">No drafts yet.</div>
              )}
              {drafts.map(d => (
                <div key={d.id} className={`flex items-center gap-2 text-sm ${d.id === draft.id ? 'font-semibold' : ''}`}>
                  <button className="truncate text-left flex-1" onClick={() => loadDraft(d.id)} title={d.name}>{d.name}</button>
                  <Button size="xs" variant="ghost" onClick={() => duplicateDraft(d.id)}>Duplicate</Button>
                  <Button size="xs" variant="ghost" onClick={() => deleteDraft(d.id)}>Delete</Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => newDraft()}>New</Button>
              <Button size="sm" variant="outline" onClick={() => duplicateDraft(draft.id)}>Save As</Button>
            </div>
          </Card>
          <Card className="p-3 space-y-3">
            <div className="text-sm font-medium opacity-80">Palette</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => addNode("trigger")}>Trigger</Button>
              <Button variant="outline" onClick={() => addNode("condition")}>Condition</Button>
              <Button variant="outline" onClick={() => addNode("action")}>Action</Button>
              <Button variant="outline" onClick={() => addNode("branch")}>Branch</Button>
              <Button variant="outline" onClick={() => addNode("delay")}>Delay</Button>
            </div>
          </Card>

          <Card className="p-3 space-y-3">
            <div className="text-sm font-medium opacity-80">Draft</div>
            <div className="space-y-2">
              <Label htmlFor="wf-name" className="text-xs">Name</Label>
              <Input id="wf-name" value={draft.name} onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => templateAutoAssign()}>Use Template</Button>
              <Button size="sm" variant="outline" onClick={() => clearDraft()}>Clear</Button>
            </div>
          </Card>
        </div>

        {/* Canvas */}
        <div className="col-span-12 md:col-span-6">
          <Card className="h-full relative overflow-hidden">
            {/* Validation banner */}
            <div className="absolute top-0 left-0 right-0 z-10 p-2 flex items-center gap-2">
              {validation.length === 0 ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700">No issues</Badge>
              ) : (
                <>
                  {validation.slice(0, 3).map((v, i) => (
                    <Badge key={i} variant={v.type === 'error' ? 'destructive' : 'outline'} title={v.message}>
                      {v.type === 'error' ? 'Error' : 'Warning'}
                    </Badge>
                  ))}
                  {validation.length > 3 && (
                    <Badge variant="outline">+{validation.length - 3} more</Badge>
                  )}
                </>
              )}
            </div>
            <div
              ref={canvasRef}
              className="absolute inset-0 bg-muted/20"
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
              onClick={() => setSelectedNodeId(null)}
            >
              <EdgesView />
              {draft.nodes.map(n => (
                <NodeView key={n.id} node={n} />
              ))}
            </div>
          </Card>
        </div>

        {/* Inspector */}
        <div className="col-span-12 md:col-span-3 space-y-3">
          <Card className="p-3 space-y-3">
            <div className="text-sm font-medium opacity-80">Inspector</div>
            {!selectedNode && (
              <div className="text-sm text-muted-foreground">Select a node to edit its properties.</div>
            )}

            {selectedNode && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="text-cyan-500"><FontAwesomeIcon icon={nodeIcon(selectedNode.type)} /></div>
                  <div className="text-sm opacity-80 uppercase">{selectedNode.type}</div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="node-label" className="text-xs">Label</Label>
                  <Input id="node-label" value={selectedNode.label} onChange={(e) => setDraft(d => ({
                    ...d,
                    nodes: d.nodes.map(n => n.id === selectedNode.id ? { ...n, label: e.target.value } : n)
                  }))} />
                </div>
                <div className="space-y-1">
                  {validation.filter(v => v.nodeId === selectedNode.id).map((v, i) => (
                    <div key={i} className={`text-xs ${v.type === 'error' ? 'text-red-600' : 'text-amber-600'}`}>{v.message}</div>
                  ))}
                </div>
                <Separator />
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setSelectedNodeId(null)}>Done</Button>
                  <Button size="sm" variant="destructive" onClick={() => removeNode(selectedNode.id)}>Delete</Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </SettingsLayout>
  );
}

export default Workflows;
