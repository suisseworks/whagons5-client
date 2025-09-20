import { memo, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentTenant } from "@/api/whagonsApi";

export const VisualTransitions = memo(function VisualTransitions({
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
  const nodeWidth = 160;
  const nodeHeight = 70;
  const hGap = 80;
  const vGap = 30;

  const [posById, setPosById] = useState<Record<number, { x: number; y: number }>>({});

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
      statuses.forEach((s: any, idx: number) => {
        if (next[s.id] == null) {
          const col = idx % 3;
          const row = Math.floor(idx / 3);
          next[s.id] = { x: col * (nodeWidth + hGap), y: row * (nodeHeight + vGap) };
        }
      });
      for (const k of Object.keys(next)) {
        const id = Number(k);
        if (!statuses.find((s: any) => Number(s.id) === id)) delete next[id];
      }
      return next;
    });
  }, [statuses]);

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

  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);

  const patternColor = 'hsl(var(--foreground) / 0.04)';
  const checkerBackgroundStyle = {
    backgroundImage: `linear-gradient(45deg, ${patternColor} 25%, transparent 25%, transparent 75%, ${patternColor} 75%, ${patternColor}), linear-gradient(45deg, ${patternColor} 25%, transparent 25%, transparent 75%, ${patternColor} 75%, ${patternColor})`,
    backgroundPosition: '0 0, 10px 10px',
    backgroundSize: '20px 20px'
  } as const;

  return (
    <div className="border rounded-md p-4 overflow-auto" style={{ minHeight: 320 }}>
      <div
        className="relative"
        style={{ width, height, ...checkerBackgroundStyle }}
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
            <marker id="arrow-blue" viewBox="0 0 10 10" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
            </marker>
            <marker id="arrow-red" viewBox="0 0 10 10" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
            </marker>
            <marker id="arrow-draft" viewBox="0 0 10 10" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#60a5fa" />
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

            let x1 = srcCenter.x, y1 = srcCenter.y;
            if (Math.abs(dy) > Math.abs(dx)) {
              if (dy > 0) {
                x1 = a.x + nodeWidth / 2; y1 = a.y + nodeHeight + margin;
              } else {
                x1 = a.x + nodeWidth / 2; y1 = a.y - margin;
              }
            } else {
              if (dx > 0) {
                x1 = a.x + nodeWidth + margin; y1 = a.y + nodeHeight / 2;
              } else {
                x1 = a.x - margin; y1 = a.y + nodeHeight / 2;
              }
            }

            let x2 = dstCenter.x, y2 = dstCenter.y;
            if (Math.abs(dy) > Math.abs(dx)) {
              if (dy > 0) {
                x2 = b.x + nodeWidth / 2; y2 = b.y - margin;
              } else {
                x2 = b.x + nodeWidth / 2; y2 = b.y + nodeHeight + margin;
              }
            } else {
              if (dx > 0) {
                x2 = b.x - margin; y2 = b.y + nodeHeight / 2;
              } else {
                x2 = b.x + nodeWidth + margin; y2 = b.y + nodeHeight / 2;
              }
            }

            const verticalDominant = Math.abs(dy) > Math.abs(dx);
            let c1x: number; let c1y: number; let c2x: number; let c2y: number;
            if (verticalDominant) {
              const k = dy > 0 ? 60 : -60;
              c1x = x1; c1y = y1 + k;
              c2x = x2; c2y = y2 - k;
            } else {
              const k = dx > 0 ? 60 : -60;
              c1x = x1 + k; c1y = y1;
              c2x = x2 - k; c2y = y2;
            }
            const segdx = x2 - x1; const segdy = y2 - y1;
            const segLen2 = Math.max(1, segdx*segdx + segdy*segdy);
            const corridor = 36;
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
            if (verticalDominant) {
              c1x = x1; c2x = x2;
            } else {
              c1y = y1; c2y = y2;
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


