import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentTenant } from "@/api/whagonsApi";
import { useTheme } from "@/providers/ThemeProvider";
import { useLanguage } from "@/providers/LanguageProvider";
import { Button } from "@/components/ui/button";
import Xarrow, { Xwrapper } from "react-xarrows";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faMinus, faRotateRight } from "@fortawesome/free-solid-svg-icons";

const ACTION_COLUMN_ORDER = ["NONE", "WORKING", "PAUSED", "FINISHED"] as const;
const ACTION_COLUMN_MAP: Record<string, number> = ACTION_COLUMN_ORDER.reduce((acc, action, index) => {
  acc[action] = index;
  return acc;
}, {} as Record<string, number>);
const FALLBACK_ACTION_COLUMN = ACTION_COLUMN_ORDER.length;

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
    <div className="w-72 bg-card rounded-xl p-5 border-2 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm text-foreground">
          {ts("palette.title", "Estados Disponibles")}
        </h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {availableStatuses.length}
        </span>
      </div>
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
        {availableStatuses.map((status) => (
          <div
            key={status.id}
            draggable
            onDragStart={(e) => handleDragStart(e, status.id)}
            onDragEnd={handleDragEnd}
            className="p-3 bg-background rounded-lg border-2 hover:bg-accent hover:border-primary/50 cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md"
            style={{ 
              borderLeftWidth: '4px',
              borderLeftColor: status.color || '#e5e7eb' 
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 shadow-inner"
                style={{ backgroundColor: status.color || '#e5e7eb' }}
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

  const tenant = getCurrentTenant();
  const storageKey = useMemo(() => (
    selectedGroupId ? `wh_status_positions:${tenant || 'default'}:${selectedGroupId}` : null
  ), [tenant, selectedGroupId]);

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

  useEffect(() => {
    setPosById((prev) => {
      const next = { ...prev } as Record<number, { x: number; y: number }>;
      activeStatuses.forEach((s: any, idx: number) => {
        if (next[s.id] == null) {
          const col = idx % 3;
          const row = Math.floor(idx / 3);
          next[s.id] = { x: col * (nodeWidth + hGap), y: row * (nodeHeight + vGap) };
        }
      });
      for (const k of Object.keys(next)) {
        const id = Number(k);
        if (!activeStatuses.find((s: any) => Number(s.id) === id)) delete next[id];
      }
      return next;
    });
  }, [activeStatuses]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(posById));
    } catch {
      // best-effort only
    }
  }, [posById, storageKey]);

  const nodes = activeStatuses.map((s: any) => ({ ...s, x: posById[s.id]?.x ?? 0, y: posById[s.id]?.y ?? 0 }));
  const idToPos: Record<number, { x: number; y: number }> = {};
  for (const s of nodes) idToPos[s.id] = { x: s.x, y: s.y };

  const width = Math.max(300, Math.max(...nodes.map(n => n.x + nodeWidth), 0) + 40);
  const height = Math.max(240, Math.max(...nodes.map(n => n.y + nodeHeight), 0) + 40);

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

  const stopDrag = () => {
    setDragFrom(null);
    setCursor(null);
    setHoverTarget(null);
    setMoving(null);
  };

  const transitionsSet = useMemo(() => {
    const set = new Set<string>();
    for (const t of transitions) set.add(`${t.from_status}->${t.to_status}`);
    return set;
  }, [transitions]);

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

  const handleAutoOrganize = useCallback(() => {
    if (!activeStatuses.length) return;

    const columnBuckets: Record<number, Array<{ status: any; index: number }>> = {};
    const columnByStatus: Record<number, number> = {};
    activeStatuses.forEach((status: any, index: number) => {
      const actionKey = String(status.action || '').toUpperCase();
      const column = ACTION_COLUMN_MAP[actionKey] ?? FALLBACK_ACTION_COLUMN;
      if (!columnBuckets[column]) columnBuckets[column] = [];
      columnBuckets[column].push({ status, index });
      columnByStatus[status.id] = column;
    });

    const sortedColumns = Object.keys(columnBuckets).map(Number).sort((a, b) => a - b);
    const layoutPositions: Record<number, { x: number; y: number }> = {};
    const rowSpacing = nodeHeight + vGap;
    const columnSpacing = nodeWidth + hGap;

    sortedColumns.forEach((columnValue, columnIndex) => {
      const bucket = columnBuckets[columnValue];
      bucket.sort((a, b) => {
        if (a.status.initial && !b.status.initial) return -1;
        if (!a.status.initial && b.status.initial) return 1;
        return String(a.status.name || '').localeCompare(String(b.status.name || ''));
      });
      bucket.forEach((entry, rowIndex) => {
        const diagonalShift = (columnIndex % 2 === 0 ? 0 : rowSpacing / 2);
        layoutPositions[entry.status.id] = {
          x: columnIndex * columnSpacing,
          y: rowIndex * rowSpacing + diagonalShift
        };
      });
    });

    const paddingX = 80;
    const paddingY = 60;
    const minX = Math.min(...Object.values(layoutPositions).map((pos) => pos.x));
    const minY = Math.min(...Object.values(layoutPositions).map((pos) => pos.y));

    const normalizedPositions: Record<number, { x: number; y: number }> = {};
    Object.entries(layoutPositions).forEach(([id, pos]) => {
      normalizedPositions[Number(id)] = {
        x: pos.x - minX + paddingX,
        y: pos.y - minY + paddingY
      };
    });

    setPosById(normalizedPositions);
  }, [activeStatuses, hGap, nodeHeight, nodeWidth, transitions, vGap]);

  return (
    <div className={embedded ? "h-full w-full flex gap-4" : "border rounded-md p-5 overflow-auto flex gap-4"}>
      <StatusPalette
        availableStatuses={availableStatuses}
        onDragStart={handlePaletteDragStart}
        onDragEnd={handlePaletteDragEnd}
      />
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        {/* Help Banner */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
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
                <li>{ts("help.organize", "Usa 'Auto organizar' para ordenar")}</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {ts("instructions", "Arrastra estados para reposicionarlos manualmente o usa auto-organizar para una línea base limpia.")}
          </p>
          <Button size="sm" variant="outline" onClick={handleAutoOrganize} disabled={!activeStatuses.length}>
            {ts("autoArrange", "Auto organizar")}
          </Button>
        </div>
        <div className="relative">
          {/* Zoom Controls */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 bg-background border rounded-lg shadow-lg p-2 z-10">
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setZoom(z => Math.min(z + 0.1, 2))}
              className="h-8 w-8 p-0"
              title="Zoom in"
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
              title="Zoom out"
            >
              <FontAwesomeIcon icon={faMinus} className="text-xs" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setZoom(1)}
              className="h-8 w-8 p-0"
              title="Reset zoom"
            >
              <FontAwesomeIcon icon={faRotateRight} className="text-xs" />
            </Button>
          </div>

          <div
            className="relative overflow-auto rounded-lg border"
            style={embedded ? { width: '100%', height: `${height}px` } : { width, height }}
          >
            <div
              ref={containerRef}
              style={{ 
                ...checkerBackgroundStyle,
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                width: `${width}px`,
                height: `${height}px`,
                minWidth: `${width}px`,
                minHeight: `${height}px`
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={stopDrag}
              onMouseUp={stopDrag}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
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
                if (e.key === 'Escape') {
                  setSelectedEdge(null);
                }
              }}
            >
          <Xwrapper>
            {transitions.map((t: any) => {
              const from = idToPos[t.from_status];
              const to = idToPos[t.to_status];
              if (!from || !to) return null;

              const key = `${t.from_status}->${t.to_status}`;
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

              const outCount = edgeOrdering.outCount[t.from_status] ?? 1;
              const outIdx = edgeOrdering.outIndex[key] ?? 0;
              const outOffset = (outIdx - (outCount - 1) / 2) * EDGE_OFFSET_STEP;

              const inCount = edgeOrdering.inCount[t.to_status] ?? 1;
              const inIdx = edgeOrdering.inIndex[key] ?? 0;
              const inOffset = (inIdx - (inCount - 1) / 2) * EDGE_OFFSET_STEP;

              const anchorFor = (side: 'top' | 'bottom' | 'left' | 'right', offset: number) => {
                const offsetObj = side === 'top' || side === 'bottom'
                  ? { x: offset, y: 0 }
                  : { x: 0, y: offset };
                return { position: side, offset: offsetObj };
              };

              const startAnchor = anchorFor(fromSide, outOffset);
              const endAnchor = anchorFor(toSide, inOffset);

              const hovered = hoverEdge === key;
              const selected = selectedEdge === key;

              return (
                <Xarrow
                  key={`${key}-x`}
                  start={`node-${t.from_status}`}
                  end={`node-${t.to_status}`}
                  startAnchor={startAnchor as any}
                  endAnchor={endAnchor as any}
                  path="smooth"
                  curveness={0.25}
                  showHead
                  color={
                    selected ? "#ef4444" : 
                    hovered ? "#3b82f6" : 
                    isDarkMode ? "rgba(148, 163, 184, 0.4)" : "rgba(100, 116, 139, 0.3)"
                  }
                  strokeWidth={selected ? 3 : (hovered ? 2.5 : 1.5)}
                  headSize={selected ? 7 : (hovered ? 6 : 5)}
                  passProps={{
                    onMouseEnter: () => setHoverEdge(key),
                    onMouseLeave: () => setHoverEdge(null),
                    onClick: (e: any) => {
                      e.stopPropagation();
                      if (!selectedGroupId) return;
                      setSelectedEdge(prev => prev === key ? null : key);
                    }
                  }}
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
              return <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%"><path d={path} stroke="#60a5fa" strokeWidth={2} strokeDasharray="6 4" strokeLinecap="round" fill="none" /></svg>;
            })()}

            {nodes.map((s: any) => (
              <div
                id={`node-${s.id}`}
                key={s.id}
                className={`absolute rounded-xl border-2 shadow-lg bg-card select-none transition-all duration-200 ${
                  moving ? 'cursor-move scale-105' : (selectedGroupId ? 'cursor-crosshair hover:scale-105' : 'cursor-default')
                } ${
                  dragFrom != null && hoverTarget === s.id 
                    ? (transitionsSet.has(`${dragFrom}->${s.id}`) 
                      ? 'ring-4 ring-red-400 shadow-red-400/50' 
                      : 'ring-4 ring-blue-400 shadow-blue-400/50'
                    ) 
                    : 'hover:shadow-xl'
                }`}
                style={{ 
                  left: s.x, 
                  top: s.y, 
                  width: nodeWidth, 
                  height: nodeHeight, 
                  borderColor: s.color || '#e5e7eb',
                  boxShadow: moving ? `0 8px 24px ${s.color}40` : undefined
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
                <div className="h-full w-full flex flex-col items-center justify-center relative p-3">
                  {/* Color indicator bar at top */}
                  <div 
                    className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                    style={{ backgroundColor: s.color || '#e5e7eb' }}
                  />
                  
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
            </Xwrapper>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});


