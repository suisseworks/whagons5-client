import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { listPinnedPresets, setPinnedOrder, SavedFilterPreset } from './workspaceTable/filterPresets';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | 'all';
  onSaved?: () => void;
};

export default function ReorderPinnedPresetsDialog({ open, onOpenChange, workspaceId, onSaved }: Props) {
  const [items, setItems] = useState<SavedFilterPreset[]>([]);
  const dragIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    try { setItems(listPinnedPresets(workspaceId)); } catch { setItems([]); }
  }, [open, workspaceId]);

  const moveItem = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
  };

  const onDragStart = (idx: number) => {
    dragIndexRef.current = idx;
  };

  const onDropAt = (idx: number) => {
    const from = dragIndexRef.current;
    if (from == null) return;
    moveItem(from, idx);
    dragIndexRef.current = null;
  };

  const save = () => {
    try {
      setPinnedOrder(workspaceId, items.map(i => i.id));
      onSaved?.();
    } catch {}
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reorder pinned presets</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {items.length === 0 && (
            <div className="text-sm text-muted-foreground">No pinned presets yet.</div>
          )}
          <ul className="space-y-2">
            {items.map((p, idx) => (
              <li
                key={p.id}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={() => onDropAt(idx)}
                className="border rounded px-3 py-2 bg-card cursor-move select-none"
                title="Drag to reorder"
              >
                <div className="text-sm">{p.name}</div>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={items.length === 0}>Save order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


