import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentTenant } from "@/api/whagonsApi";
import { useTheme } from "@/providers/ThemeProvider";
import { useLanguage } from "@/providers/LanguageProvider";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faMinus, faRotateRight } from "@fortawesome/free-solid-svg-icons";

// (Auto-organize removed; action column ordering no longer needed here)

// Status Palette Component
const StatusPalette = memo(function StatusPalette({
  availableStatuses,
  onDragStart,
  onDragEnd
}: {
  availableStatuses: any[];
  onDragStart: (statusId: number) => void;
  onDragEnd: () => void;
}) {
  const { t } = useLanguage();
  const ts = (key: string, fallback: string) => t(`settings.statuses.transitions.visual.${key}`, fallback);

  const handleDragStart = (e: React.DragEvent, statusId: number) => {
    e.dataTransfer.setData('statusId', statusId.toString());
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart(statusId);
  };

  const handleDragEnd = () => {
    onDragEnd();
  };

  return (
    <div className="w-72 bg-card rounded-xl p-5 border-2 shadow-lg flex-shrink-0 flex flex-col max-h-full">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="font-semibold text-sm text-foreground">
          {ts("palette.title", "Estados Disponibles")}
        </h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {availableStatuses.length}
        </span>
      </div>
      <div className="space-y-2 flex-1 overflow-y-auto pr-2 min-h-0">
        {availableStatuses.map((status) => (
          <div
            key={status.id}
            draggable
            onDragStart={(e) => handleDragStart(e, status.id)}
            onDragEnd={handleDragEnd}
            className="p-3 bg-background rounded-lg border-2 hover:bg-accent hover:border-primary/50 cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md overflow-hidden"
            style={{ 
              borderLeftWidth: '4px',
              borderLeftColor: `${status.color || '#e5e7eb'}CC`
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 shadow-inner"
                style={{ backgroundColor: `${status.color || '#e5e7eb'}E6` }}
              />
              <span className="font-medium text-sm flex-1">{status.name}</span>
              <div className="flex gap-1">
                {status.initial && (
                  <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                    {ts("palette.initial", "I")}
                  </span>
                )}
                {status.system && (
                  <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full font-medium">
                    {ts("palette.system", "S")}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export const VisualTransitions = memo(function VisualTransitions({
  allStatuses,
  activeStatuses,
  transitions,
  onToggle,
  onAddStatus,
  onRemoveStatus,
  selectedGroupId,
  embedded = false
}: {
  allStatuses: any[];
  activeStatuses: any[];
  transitions: any[];
  onToggle: (fromId: number, toId: number) => void;
  onAddStatus: (statusId: number) => void;
  onRemoveStatus: (statusId: number) => void;
  selectedGroupId: number | null;
  embedded?: boolean;
}) {
  const { t } = useLanguage();
  const ts = (key: string, fallback: string) => t(`settings.statuses.transitions.visual.${key}`, fallback);
  const nodeWidth = 180;
  const nodeHeight = 90;
  const hGap = 120;
  const vGap = 50;
  const EDGE_OFFSET_STEP = 18;

  const [posById, setPosById] = useState<Record<number, { x: number; y: number }>>({});
  const [zoom, setZoom] = useState(1);
  const posByIdRef = useRef<Record<number, { x: number; y: number }>>({});
  const movingRef = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null);
  const edgeRafRef = useRef<number | null>(null);
  const cursorRafRef = useRef<number | null>(null);
  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null);
  const nodeElsRef = useRef<Record<number, HTMLDivElement | null>>({});
  const persistTimerRef = useRef<number | null>(null);
  const edgePathRefs = useRef<Record<string, SVGPathElement | null>>({});

  const tenant = getCurrentTenant();
  const storageKey = useMemo(() => (
    selectedGroupId ? `wh_status_positions:${tenant || 'default'}:${selectedGroupId}` : null
  ), [tenant, selectedGroupId]);

  // Keep ref in sync with state (state only changes on initialization / auto-organize / drag-end commit).
  useEffect(() => {
    posByIdRef.current = posById;
  }, [posById]);

  useEffect(() => {
    setPosById((prev) => {
      const next = { ...prev } as Record<number, { x: number; y: number }>;
      
      // First, try to load from localStorage
      if (storageKey) {
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw) as Record<string, { x: number; y: number }>;
            if (parsed && typeof parsed === 'object') {
              for (const k of Object.keys(parsed)) {
                const id = Number(k);
                const p = parsed[k];
                if (p && typeof p.x === 'number' && typeof p.y === 'number') {
                  next[id] = { x: p.x, y: p.y };
                }
              }
            }
          }
        } catch {
          // ignore parse errors
        }
      }
      
      // Then, initialize any missing positions with default grid layout
      activeStatuses.forEach((s: any, idx: number) => {
        if (next[s.id] == null) {
          const col = idx % 3;
          const row = Math.floor(idx / 3);
          next[s.id] = { x: col * (nodeWidth + hGap), y: row * (nodeHeight + vGap) };
        }
      });
      
      // Remove positions for statuses no longer in activeStatuses
      for (const k of Object.keys(next)) {
        const id = Number(k);
        if (!activeStatuses.find((s: any) => Number(s.id) === id)) delete next[id];
      }
      
      return next;
    });
  }, [activeStatuses, storageKey]);

  const schedulePersist = useCallback((next: Record<number, { x: number; y: number }>) => {
    if (!storageKey) return;
    if (persistTimerRef.current != null) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // best-effort only
      }
    }, 250);
  }, [storageKey]);

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [hoverTarget, setHoverTarget] = useState<number | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [isShiftHeld, setIsShiftHeld] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const nodes = activeStatuses.map((s: any) => ({ ...s, x: posById[s.id]?.x ?? 0, y: posById[s.id]?.y ?? 0 }));
  const idToPos: Record<number, { x: number; y: number }> = {};
  for (const s of nodes) idToPos[s.id] = { x: s.x, y: s.y };

  const getCenter = (id: number) => {
    const p = idToPos[id];
    if (!p) return { x: 0, y: 0 };
    return { x: p.x + nodeWidth / 2, y: p.y + nodeHeight / 2 };
  };

  type DisplayEdge = {
    key: string;
    from: number;
    to: number;
    bidi: boolean;
    // Canonical directed key used for ordering offsets when not bidi.
    dirKey: string;
    // Underlying transitions to toggle/remove (1 for directed, 2 for bidirectional).
    toggles: Array<{ from: number; to: number }>;
  };

  const displayEdges = useMemo<DisplayEdge[]>(() => {
    const pairMap: Record<string, { min: number; max: number; minToMax?: boolean; maxToMin?: boolean }> = {};

    transitions.forEach((tr: any) => {
      const a = Number(tr.from_status);
      const b = Number(tr.to_status);
      const min = Math.min(a, b);
      const max = Math.max(a, b);
      const pk = `${min}|${max}`;
      if (!pairMap[pk]) pairMap[pk] = { min, max };
      if (a === min && b === max) pairMap[pk].minToMax = true;
      if (a === max && b === min) pairMap[pk].maxToMin = true;
    });

    const edges: DisplayEdge[] = [];
    Object.values(pairMap).forEach(({ min, max, minToMax, maxToMin }) => {
      if (minToMax && maxToMin) {
        edges.push({
          key: `${min}<->${max}`,
          from: min,
          to: max,
          bidi: true,
          dirKey: `${min}->${max}`,
          toggles: [{ from: min, to: max }, { from: max, to: min }],
        });
      } else if (minToMax) {
        edges.push({
          key: `${min}->${max}`,
          from: min,
          to: max,
          bidi: false,
          dirKey: `${min}->${max}`,
          toggles: [{ from: min, to: max }],
        });
      } else if (maxToMin) {
        edges.push({
          key: `${max}->${min}`,
          from: max,
          to: min,
          bidi: false,
          dirKey: `${max}->${min}`,
          toggles: [{ from: max, to: min }],
        });
      }
    });

    return edges;
  }, [transitions]);

  const displayEdgeByKey = useMemo<Record<string, DisplayEdge>>(() => {
    const map: Record<string, DisplayEdge> = {};
    displayEdges.forEach((e) => { map[e.key] = e; });
    return map;
  }, [displayEdges]);

  const displayEdgeKeysByNode = useMemo<Record<number, string[]>>(() => {
    const map: Record<number, string[]> = {};
    displayEdges.forEach((e) => {
      (map[e.from] ??= []).push(e.key);
      (map[e.to] ??= []).push(e.key);
    });
    return map;
  }, [displayEdges]);

  const edgeOrdering = useMemo(() => {
    const outMap: Record<number, number[]> = {};
    const inMap: Record<number, number[]> = {};

    transitions.forEach((t: any) => {
      if (!outMap[t.from_status]) outMap[t.from_status] = [];
      if (!inMap[t.to_status]) inMap[t.to_status] = [];

      if (!outMap[t.from_status].includes(t.to_status)) {
        outMap[t.from_status].push(t.to_status);
      }
      if (!inMap[t.to_status].includes(t.from_status)) {
        inMap[t.to_status].push(t.from_status);
      }
    });

    const outIndex: Record<string, number> = {};
    const outCount: Record<number, number> = {};
    Object.entries(outMap).forEach(([from, list]) => {
      list.forEach((to, idx) => {
        outIndex[`${from}->${to}`] = idx;
      });
      outCount[Number(from)] = list.length;
    });

    const inIndex: Record<string, number> = {};
    const inCount: Record<number, number> = {};
    Object.entries(inMap).forEach(([to, list]) => {
      list.forEach((from, idx) => {
        inIndex[`${from}->${to}`] = idx;
      });
      inCount[Number(to)] = list.length;
    });

    return { outIndex, outCount, inIndex, inCount };
  }, [transitions]);

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  const getPos = useCallback((id: number) => {
    const p = posByIdRef.current[id] ?? idToPos[id];
    return p ? { x: p.x, y: p.y } : null;
  }, [idToPos]);

  const computeEdgePath = useCallback((fromId: number, toId: number, dirKey: string, bidi: boolean) => {
    const from = getPos(fromId);
    const to = getPos(toId);
    if (!from || !to) return null;

    const dx = (to.x + nodeWidth / 2) - (from.x + nodeWidth / 2);
    const dy = (to.y + nodeHeight / 2) - (from.y + nodeHeight / 2);

    let fromSide: 'top' | 'right' | 'bottom' | 'left';
    let toSide: 'top' | 'right' | 'bottom' | 'left';
    if (Math.abs(dy) > Math.abs(dx)) {
      fromSide = dy > 0 ? 'bottom' : 'top';
      toSide = dy > 0 ? 'top' : 'bottom';
    } else {
      fromSide = dx > 0 ? 'right' : 'left';
      toSide = dx > 0 ? 'left' : 'right';
    }

    // If bidirectional, center the edge (no offsets) so one line represents both directions.
    let outOffset = 0;
    let inOffset = 0;
    if (!bidi) {
      const outCount = edgeOrdering.outCount[fromId] ?? 1;
      const outIdx = edgeOrdering.outIndex[dirKey] ?? 0;
      outOffset = (outIdx - (outCount - 1) / 2) * EDGE_OFFSET_STEP;

      const inCount = edgeOrdering.inCount[toId] ?? 1;
      const inIdx = edgeOrdering.inIndex[dirKey] ?? 0;
      inOffset = (inIdx - (inCount - 1) / 2) * EDGE_OFFSET_STEP;
    }

    const anchorPoint = (p: { x: number; y: number }, side: 'top' | 'right' | 'bottom' | 'left', offset: number) => {
      const arrowOffset = 5; // Space for arrow head
      switch (side) {
        case 'top':
          return { x: clamp(p.x + nodeWidth / 2 + offset, p.x + 8, p.x + nodeWidth - 8), y: p.y - arrowOffset };
        case 'bottom':
          return { x: clamp(p.x + nodeWidth / 2 + offset, p.x + 8, p.x + nodeWidth - 8), y: p.y + nodeHeight + arrowOffset };
        case 'left':
          return { x: p.x - arrowOffset, y: clamp(p.y + nodeHeight / 2 + offset, p.y + 8, p.y + nodeHeight - 8) };
        case 'right':
          return { x: p.x + nodeWidth + arrowOffset, y: clamp(p.y + nodeHeight / 2 + offset, p.y + 8, p.y + nodeHeight - 8) };
      }
    };

    const a = anchorPoint(from, fromSide, outOffset);
    const b = anchorPoint(to, toSide, inOffset);

    // Smooth cubic Bézier; control points depend on predominant direction.
    const x1 = a.x; const y1 = a.y;
    const x2 = b.x; const y2 = b.y;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;

    let c1x = mx, c1y = y1, c2x = mx, c2y = y2;
    if (Math.abs(dy) > Math.abs(dx)) {
      c1x = x1; c1y = my;
      c2x = x2; c2y = my;
    }

    return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
  }, [EDGE_OFFSET_STEP, edgeOrdering, getPos, nodeHeight, nodeWidth]);

  const setEdgePathD = useCallback((edge: DisplayEdge) => {
    const d = computeEdgePath(edge.from, edge.to, edge.dirKey, edge.bidi);
    const el = edgePathRefs.current[edge.key];
    if (el && d) el.setAttribute('d', d);
  }, [computeEdgePath]);

  const scheduleEdgeUpdate = useCallback((onlyNodeId?: number) => {
    if (edgeRafRef.current != null) return;
    edgeRafRef.current = window.requestAnimationFrame(() => {
      edgeRafRef.current = null;
      if (onlyNodeId != null) {
        const keys = displayEdgeKeysByNode[onlyNodeId] ?? [];
        keys.forEach((k) => {
          const edge = displayEdgeByKey[k];
          if (edge) setEdgePathD(edge);
        });
      } else {
        displayEdges.forEach((edge) => setEdgePathD(edge));
      }
    });
  }, [displayEdgeByKey, displayEdgeKeysByNode, displayEdges, setEdgePathD]);

  const commitPositions = useCallback(() => {
    const next = { ...posByIdRef.current };
    setPosById(next);
    schedulePersist(next);
  }, [schedulePersist]);

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const container = containerRef.current as HTMLDivElement;
    const rect = container.getBoundingClientRect();
    const rel = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const moving = movingRef.current;
    if (moving) {
      // Calculate new position
      let nx = rel.x - moving.offsetX;
      let ny = rel.y - moving.offsetY;
      
      // Get container dimensions accounting for zoom
      const containerWidth = rect.width / zoom;
      const containerHeight = rect.height / zoom;
      
      // Clamp position to keep node within bounds
      nx = clamp(nx, 0, containerWidth - nodeWidth);
      ny = clamp(ny, 0, containerHeight - nodeHeight);
      
      // Update DOM directly (no React rerender per mousemove).
      const el = nodeElsRef.current[moving.id];
      if (el) {
        el.style.transform = `translate3d(${nx}px, ${ny}px, 0)`;
      }
      // Keep ref updated so we can commit once on drag end.
      posByIdRef.current[moving.id] = { x: nx, y: ny };
      scheduleEdgeUpdate(moving.id);
      return;
    }
    if (dragFrom != null) {
      // Cursor preview line updates can be expensive; batch to RAF.
      pendingCursorRef.current = rel;
      if (cursorRafRef.current == null) {
        cursorRafRef.current = window.requestAnimationFrame(() => {
          cursorRafRef.current = null;
          setCursor(pendingCursorRef.current);
        });
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const statusId = e.dataTransfer.getData('statusId');
    if (statusId) {
      const id = parseInt(statusId);
      // Check if status is not already in active statuses
      if (!activeStatuses.find(s => s.id === id)) {
        onAddStatus(id);
      }
    }
  };

  const handlePaletteDragStart = (_statusId: number) => {};

  const handlePaletteDragEnd = () => {};

  // Track shift key for transition mode cursor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftHeld(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftHeld(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Cleanup timers/RAFs on unmount
  useEffect(() => {
    return () => {
      if (edgeRafRef.current != null) window.cancelAnimationFrame(edgeRafRef.current);
      if (cursorRafRef.current != null) window.cancelAnimationFrame(cursorRafRef.current);
      if (persistTimerRef.current != null) window.clearTimeout(persistTimerRef.current);
    };
  }, []);

  const stopDrag = () => {
    if (movingRef.current) {
      commitPositions();
    }
    setDragFrom(null);
    setCursor(null);
    setHoverTarget(null);
    movingRef.current = null;
    setMovingId(null);
  };

  const transitionsSet = useMemo(() => {
    const set = new Set<string>();
    for (const t of transitions) set.add(`${t.from_status}->${t.to_status}`);
    return set;
  }, [transitions]);

  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);

  // Use theme detection for cleaner background
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Cleaner dot grid background
  const checkerBackgroundStyle = {
    backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
    backgroundImage: `radial-gradient(circle at 1px 1px, ${isDarkMode ? 'rgba(148, 163, 184, 0.15)' : 'rgba(203, 213, 225, 0.3)'} 1px, transparent 0)`,
    backgroundSize: '40px 40px'
  } as const;

  // Calculate available statuses (not in active statuses)
  const availableStatuses = allStatuses.filter(status =>
    !activeStatuses.find(active => active.id === status.id)
  );

  // Initial edge render / reflow when data changes.
  useEffect(() => {
    scheduleEdgeUpdate();
  }, [scheduleEdgeUpdate, posById, transitions, zoom]);

  return (
    <div className={embedded ? "h-full w-full flex gap-4" : "border rounded-md p-5 flex gap-4 h-[calc(100vh-12rem)]"}>
      <StatusPalette
        availableStatuses={availableStatuses}
        onDragStart={handlePaletteDragStart}
        onDragEnd={handlePaletteDragEnd}
      />
      <div className="flex-1 min-h-0 flex flex-col gap-3 min-w-0">
        {/* Help Banner */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex-shrink-0">
          <div className="flex items-start gap-2 text-sm">
            <span className="text-blue-600 dark:text-blue-400">💡</span>
            <div className="flex-1 space-y-1">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                {ts("help.title", "Cómo usar el editor visual:")}
              </p>
              <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5 ml-4 list-disc">
                <li>{ts("help.drag", "Arrastra estados desde la paleta")}</li>
                <li>{ts("help.shift", "Shift + Click y arrastra para crear transiciones")}</li>
                <li>{ts("help.click", "Click en flechas para eliminarlas")}</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <p className="text-sm text-muted-foreground">
            {ts("help.instructions", "Arrastra estados para reposicionarlos manualmente.")}
          </p>
        </div>
        <div className="relative flex-1 min-h-0">
          {/* Zoom Controls */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 bg-background border rounded-lg shadow-lg p-2 z-10">
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setZoom(z => Math.min(z + 0.1, 2))}
              className="h-8 w-8 p-0"
              title={ts("zoom.in", "Acercar")}
            >
              <FontAwesomeIcon icon={faPlus} className="text-xs" />
            </Button>
            <span className="text-xs text-center text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))}
              className="h-8 w-8 p-0"
              title={ts("zoom.out", "Alejar")}
            >
              <FontAwesomeIcon icon={faMinus} className="text-xs" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setZoom(1)}
              className="h-8 w-8 p-0"
              title={ts("zoom.reset", "Restablecer zoom")}
            >
              <FontAwesomeIcon icon={faRotateRight} className="text-xs" />
            </Button>
          </div>

          <div
            className="relative overflow-auto rounded-lg border h-full w-full"
          >
            <div
              ref={containerRef}
              className="w-full h-full"
              style={{ 
                ...checkerBackgroundStyle,
                transform: `scale(${zoom})`,
                transformOrigin: 'top left'
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={stopDrag}
              onMouseUp={stopDrag}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEdge && selectedGroupId) {
                  const edge = displayEdgeByKey[selectedEdge];
                  if (edge?.toggles?.length) {
                    edge.toggles.forEach(({ from, to }) => onToggle(from, to));
                    setSelectedEdge(null);
                    e.preventDefault();
                  }
                }
                if (e.key === 'Escape') {
                  setSelectedEdge(null);
                }
              }}
            >
              {/* Edges (fast SVG, no DOM measuring) */}
              <svg className="absolute inset-0" width="100%" height="100%" style={{ pointerEvents: 'none' }}>
                <defs>
                  <marker
                    id="wh-status-arrowhead"
                    markerWidth="12"
                    markerHeight="10"
                    refX="6"
                    refY="5"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <path d="M 0 0 L 12 5 L 0 10 z" fill={isDarkMode ? "#64748b" : "#475569"} opacity="0.6" />
                  </marker>
                  <marker
                    id="wh-status-arrowhead-start"
                    markerWidth="12"
                    markerHeight="10"
                    refX="6"
                    refY="5"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <path d="M 12 0 L 0 5 L 12 10 z" fill={isDarkMode ? "#64748b" : "#475569"} opacity="0.6" />
                  </marker>
                </defs>
                {displayEdges.map((edge) => {
                  const key = edge.key;
                  const hovered = hoverEdge === key;
                  const selected = selectedEdge === key;
                  const stroke = selected
                    ? "#f87171"
                    : hovered
                      ? "#60a5fa"
                      : (isDarkMode ? "rgba(148, 163, 184, 0.5)" : "rgba(100, 116, 139, 0.4)");
                  const strokeWidth = selected ? 3 : (hovered ? 2.5 : 1.5);
                  return (
                    <path
                      key={`${key}-p`}
                      ref={(el) => { edgePathRefs.current[key] = el; }}
                      d={computeEdgePath(edge.from, edge.to, edge.dirKey, edge.bidi) ?? ''}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      fill="none"
                      markerEnd="url(#wh-status-arrowhead)"
                      markerStart={edge.bidi ? "url(#wh-status-arrowhead-start)" : undefined}
                      style={{ pointerEvents: 'stroke' }}
                      onMouseEnter={() => setHoverEdge(key)}
                      onMouseLeave={() => setHoverEdge(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!selectedGroupId) return;
                        setSelectedEdge((prev) => (prev === key ? null : key));
                      }}
                    />
                  );
                })}
              </svg>

            {dragFrom != null && cursor && (() => {
              const a = getCenter(dragFrom);
              const x1 = a.x;
              const y1 = a.y;
              const x2 = hoverTarget != null ? getCenter(hoverTarget).x : cursor.x;
              const y2 = hoverTarget != null ? getCenter(hoverTarget).y : cursor.y;
              const mx = (x1 + x2) / 2;
              const path = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
              return <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%"><path d={path} stroke="#93c5fd" strokeWidth={2} strokeDasharray="6 4" strokeLinecap="round" fill="none" opacity="0.7" /></svg>;
            })()}

            {nodes.map((s: any) => (
              <div
                id={`node-${s.id}`}
                key={s.id}
                ref={(el) => { nodeElsRef.current[s.id] = el; }}
                className={`absolute rounded-xl border-2 shadow-lg bg-card select-none ${
                  // Disable transitions while dragging so the node tracks the cursor instantly.
                  movingId === s.id 
                    ? 'transition-none cursor-grabbing' 
                    : `transition-[transform,box-shadow,background-color] duration-200 ${
                        selectedGroupId 
                          ? (isShiftHeld ? 'cursor-crosshair' : 'cursor-grab')
                          : 'cursor-default'
                      }`
                } ${
                  dragFrom != null && hoverTarget === s.id 
                    ? (transitionsSet.has(`${dragFrom}->${s.id}`) 
                      ? 'ring-4 ring-red-300/40 shadow-red-300/30' 
                      : 'ring-4 ring-blue-300/40 shadow-blue-300/30'
                    ) 
                    : ''
                }`}
                style={{ 
                  transform: `translate3d(${s.x}px, ${s.y}px, 0)`,
                  width: nodeWidth, 
                  height: nodeHeight, 
                  borderColor: `${s.color || '#e5e7eb'}50`,
                  borderTopColor: `${s.color || '#e5e7eb'}80`,
                  borderTopWidth: '6px',
                  willChange: movingId === s.id ? 'transform' : undefined
                }}
                onMouseDown={(ev) => {
                  if (ev.shiftKey && selectedGroupId) {
                    setDragFrom(s.id);
                    const rect = (containerRef.current as HTMLDivElement).getBoundingClientRect();
                    setCursor({ x: ev.clientX - rect.left, y: ev.clientY - rect.top });
                  } else {
                    const rect = (ev.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const offsetX = ev.clientX - rect.left;
                    const offsetY = ev.clientY - rect.top;
                    movingRef.current = { id: s.id, offsetX, offsetY };
                    setMovingId(s.id);
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
                <div className="h-full w-full flex flex-col items-center justify-center relative p-3">
                  <div className="text-center flex-1 flex flex-col justify-center">
                    <div className="font-semibold text-sm mb-1">{s.name}</div>
                    {(s.initial || s.system) && (
                      <div className="flex items-center justify-center gap-1">
                        {s.initial && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                            {ts("node.initial", "Inicial")}
                          </span>
                        )}
                        {s.system && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-600 dark:text-gray-400 font-medium">
                            {ts("node.system", "Sistema")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {selectedGroupId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveStatus(s.id);
                      }}
                      className="absolute -top-3 -right-3 w-7 h-7 bg-red-500 text-white rounded-full text-sm font-bold hover:bg-red-600 transition-all hover:scale-110 shadow-lg"
                      title={ts("removeFromWorkflow", "Eliminar del flujo de trabajo")}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});


