import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listPresets, savePreset, deletePreset, getPresetById, SavedFilterPreset } from './workspaceTable/filterPresets';

type Option = { id: number; name: string };

export type FilterBuilderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | 'all';
  statuses: Option[];
  priorities: Option[];
  spots: Option[];
  currentModel?: any;
  currentSearchText?: string;
  onApply: (model: any, searchText?: string) => void;
};

type DueQuick = 'any' | 'overdue' | 'today' | 'next7';

const buildModel = (params: {
  statusIds: number[];
  priorityIds: number[];
  spotIds: number[];
  nameContains: string;
  descriptionContains: string;
  dueQuick: DueQuick;
}): any => {
  const model: any = {};
  if (params.statusIds.length) model.status_id = { filterType: 'set', values: params.statusIds };
  if (params.priorityIds.length) model.priority_id = { filterType: 'set', values: params.priorityIds };
  if (params.spotIds.length) model.spot_id = { filterType: 'set', values: params.spotIds };
  if (params.nameContains?.trim()) model.name = { filterType: 'text', type: 'contains', filter: params.nameContains.trim() };
  if (params.descriptionContains?.trim()) model.description = { filterType: 'text', type: 'contains', filter: params.descriptionContains.trim() };

  // Map dueQuick to a date filter model if needed
  if (params.dueQuick !== 'any') {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (params.dueQuick === 'overdue') {
      model.due_date = { filterType: 'date', type: 'dateBefore', filter: startOfToday.toISOString() };
    } else if (params.dueQuick === 'today') {
      model.due_date = { filterType: 'date', type: 'equals', filter: startOfToday.toISOString() };
    } else if (params.dueQuick === 'next7') {
      const end = new Date(startOfToday);
      end.setDate(end.getDate() + 7);
      model.due_date = { operator: 'AND', conditions: [
        { filterType: 'date', type: 'dateAfter', filter: startOfToday.toISOString() },
        { filterType: 'date', type: 'dateBefore', filter: end.toISOString() },
      ] };
    }
  }
  return model;
};

const getInitial = (model?: any) => {
  const coerceSet = (m: any): number[] => Array.isArray(m?.values) ? m.values.map((v: any) => Number(v)).filter((n: any) => Number.isFinite(n)) : [];
  return {
    statusIds: coerceSet(model?.status_id),
    priorityIds: coerceSet(model?.priority_id),
    spotIds: coerceSet(model?.spot_id),
    nameContains: model?.name?.filter || '',
    descriptionContains: model?.description?.filter || '',
    dueQuick: 'any' as DueQuick,
  };
};

const useOptions = (items: Option[]) => useMemo(() => (items || []).map(i => ({ id: Number(i.id), name: i.name })), [items]);

export default function FilterBuilderDialog(props: FilterBuilderDialogProps) {
  const { open, onOpenChange, workspaceId, statuses, priorities, spots, currentModel, currentSearchText, onApply } = props;

  const statusOptions = useOptions(statuses);
  const priorityOptions = useOptions(priorities);
  const spotOptions = useOptions(spots);

  const [nameContains, setNameContains] = useState('');
  const [descriptionContains, setDescriptionContains] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<number[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<number[]>([]);
  const [selectedSpots, setSelectedSpots] = useState<number[]>([]);
  const [dueQuick, setDueQuick] = useState<DueQuick>('any');

  const [presets, setPresets] = useState<SavedFilterPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | ''>('');
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    if (!open) return;
    setPresets(listPresets(workspaceId));
  }, [open, workspaceId]);

  useEffect(() => {
    if (!open) return;
    const init = getInitial(currentModel);
    setSelectedStatuses(init.statusIds);
    setSelectedPriorities(init.priorityIds);
    setSelectedSpots(init.spotIds);
    setNameContains(init.nameContains || '');
    setDescriptionContains(init.descriptionContains || '');
    setDueQuick('any');
    setSelectedPresetId('');
    setPresetName('');
  }, [open, currentModel, currentSearchText]);

  const toggleId = (list: number[], id: number): number[] => list.includes(id) ? list.filter(x => x !== id) : [...list, id];

  const apply = () => {
    const model = buildModel({
      statusIds: selectedStatuses,
      priorityIds: selectedPriorities,
      spotIds: selectedSpots,
      nameContains,
      descriptionContains,
      dueQuick,
    });
    onApply(model);
    onOpenChange(false);
  };

  const onLoadPreset = (id: string) => {
    const p = getPresetById(id);
    if (!p) return;
    setSelectedPresetId(p.id);
    const init = getInitial(p.model);
    setSelectedStatuses(init.statusIds);
    setSelectedPriorities(init.priorityIds);
    setSelectedSpots(init.spotIds);
    setNameContains(init.nameContains || '');
    setDescriptionContains(init.descriptionContains || '');
    setDueQuick('any');
  };

  const onSavePreset = () => {
    const name = presetName.trim() || 'Untitled filter';
    const model = buildModel({
      statusIds: selectedStatuses,
      priorityIds: selectedPriorities,
      spotIds: selectedSpots,
      nameContains,
      descriptionContains,
      dueQuick,
    });
    const saved = savePreset({ name, workspaceScope: workspaceId, model, searchText: nameContains });
    setPresets(listPresets(workspaceId));
    setSelectedPresetId(saved.id);
  };

  const onDeletePreset = () => {
    if (!selectedPresetId) return;
    deletePreset(selectedPresetId);
    setPresets(listPresets(workspaceId));
    setSelectedPresetId('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Filters</DialogTitle>
          <DialogDescription>Build a custom filter and optionally save it for reuse.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="border rounded p-2 max-h-40 overflow-auto">
              {statusOptions.map(o => (
                <label key={o.id} className="flex items-center gap-2 py-1">
                  <Checkbox checked={selectedStatuses.includes(o.id)} onCheckedChange={() => setSelectedStatuses(prev => toggleId(prev, o.id))} />
                  <span className="text-sm">{o.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <div className="border rounded p-2 max-h-40 overflow-auto">
              {priorityOptions.map(o => (
                <label key={o.id} className="flex items-center gap-2 py-1">
                  <Checkbox checked={selectedPriorities.includes(o.id)} onCheckedChange={() => setSelectedPriorities(prev => toggleId(prev, o.id))} />
                  <span className="text-sm">{o.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <div className="border rounded p-2 max-h-40 overflow-auto">
              {spotOptions.map(o => (
                <label key={o.id} className="flex items-center gap-2 py-1">
                  <Checkbox checked={selectedSpots.includes(o.id)} onCheckedChange={() => setSelectedSpots(prev => toggleId(prev, o.id))} />
                  <span className="text-sm">{o.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Due</Label>
            <Select value={dueQuick} onValueChange={(v) => setDueQuick(v as DueQuick)}>
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="next7">Next 7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Text contains</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input placeholder="Name contains..." value={nameContains} onChange={(e) => setNameContains(e.target.value)} />
              <Input placeholder="Description contains..." value={descriptionContains} onChange={(e) => setDescriptionContains(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Saved presets</Label>
            <div className="flex gap-2 items-center">
              <Select value={selectedPresetId} onValueChange={onLoadPreset}>
                <SelectTrigger className="min-w-[220px]">
                  <SelectValue placeholder={presets.length ? 'Choose a preset...' : 'No presets yet'} />
                </SelectTrigger>
                <SelectContent>
                  {presets.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Preset name" value={presetName} onChange={(e) => setPresetName(e.target.value)} className="max-w-xs" />
              <Button variant="outline" onClick={onSavePreset}>Save</Button>
              <Button variant="ghost" onClick={onDeletePreset} disabled={!selectedPresetId}>Delete</Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={apply}>Apply filters</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


