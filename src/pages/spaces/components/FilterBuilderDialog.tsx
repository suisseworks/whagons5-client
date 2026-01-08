import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listPresets, savePreset, deletePreset, getPresetById, SavedFilterPreset } from './workspaceTable/filterPresets';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { TagMultiSelect } from '@/components/ui/tag-multi-select';

type Option = { id: number; name: string };
type TagOption = { id: number; name: string; color?: string | null };

export type FilterBuilderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | 'all';
  statuses: Option[];
  priorities: Option[];
  spots: Option[];
  owners: Option[];
  tags: TagOption[];
  currentModel?: any;
  currentSearchText?: string;
  onApply: (model: any, searchText?: string) => void;
};

type DueQuick = 'any' | 'overdue' | 'today' | 'next7';

const buildModel = (params: {
  statusIds: number[];
  priorityIds: number[];
  spotIds: number[];
  ownerIds: number[];
  tagIds: number[];
  textContains: string;
  dueQuick: DueQuick;
}): any => {
  const model: any = {};
  if (params.statusIds.length) model.status_id = { filterType: 'set', values: params.statusIds };
  if (params.priorityIds.length) model.priority_id = { filterType: 'set', values: params.priorityIds };
  if (params.spotIds.length) model.spot_id = { filterType: 'set', values: params.spotIds };
  if (params.ownerIds.length) model.user_ids = { filterType: 'set', values: params.ownerIds };
  if (params.tagIds.length) model.tag_ids = { filterType: 'set', values: params.tagIds };
  if (params.textContains?.trim()) {
    const v = params.textContains.trim();
    model.name = { filterType: 'text', type: 'contains', filter: v };
    model.description = { filterType: 'text', type: 'contains', filter: v };
  }

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
    ownerIds: coerceSet(model?.user_ids),
    tagIds: coerceSet(model?.tag_ids),
    textContains: model?.name?.filter || model?.description?.filter || '',
    dueQuick: 'any' as DueQuick,
  };
};

const useOptions = (items: Option[]) => useMemo(() => (items || []).map(i => ({ id: Number(i.id), name: i.name })), [items]);

export default function FilterBuilderDialog(props: FilterBuilderDialogProps) {
  const { open, onOpenChange, workspaceId, statuses, priorities, spots, owners, tags, currentModel, currentSearchText, onApply } = props;

  const statusOptions = useOptions(statuses);
  const priorityOptions = useOptions(priorities);
  const spotOptions = useOptions(spots);
  const ownerOptions = useOptions(owners);
  const tagOptions = useMemo(() => (tags || []).map(t => ({ id: Number(t.id), name: t.name, color: t.color })), [tags]);

  const statusSelectOptions = useMemo(
    () => statusOptions.map((i) => ({ value: String(i.id), label: i.name || `#${i.id}` })),
    [statusOptions]
  );
  const prioritySelectOptions = useMemo(
    () => priorityOptions.map((i) => ({ value: String(i.id), label: i.name || `#${i.id}` })),
    [priorityOptions]
  );
  const spotSelectOptions = useMemo(
    () => spotOptions.map((i) => ({ value: String(i.id), label: i.name || `#${i.id}` })),
    [spotOptions]
  );
  const ownerSelectOptions = useMemo(
    () => ownerOptions.map((i) => ({ value: String(i.id), label: i.name || `#${i.id}` })),
    [ownerOptions]
  );

  const [textContains, setTextContains] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<number[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<number[]>([]);
  const [selectedSpots, setSelectedSpots] = useState<number[]>([]);
  const [selectedOwners, setSelectedOwners] = useState<number[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
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
    setSelectedOwners(init.ownerIds);
    setSelectedTags(init.tagIds);
    setTextContains(init.textContains || '');
    setDueQuick('any');
    setSelectedPresetId('');
    setPresetName('');
  }, [open, currentModel, currentSearchText]);

  const apply = () => {
    const model = buildModel({
      statusIds: selectedStatuses,
      priorityIds: selectedPriorities,
      spotIds: selectedSpots,
      ownerIds: selectedOwners,
      tagIds: selectedTags,
      textContains,
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
    setSelectedOwners(init.ownerIds);
    setSelectedTags(init.tagIds);
    setTextContains(init.textContains || '');
    setDueQuick('any');
  };

  const onSavePreset = () => {
    const name = presetName.trim() || 'Untitled filter';
    const model = buildModel({
      statusIds: selectedStatuses,
      priorityIds: selectedPriorities,
      spotIds: selectedSpots,
      ownerIds: selectedOwners,
      tagIds: selectedTags,
      textContains,
      dueQuick,
    });
    const saved = savePreset({ name, workspaceScope: workspaceId, model, searchText: textContains });
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
            <MultiSelectCombobox
              options={statusSelectOptions}
              value={selectedStatuses.map(String)}
              onValueChange={(vals) => setSelectedStatuses(vals.map(v => Number(v)).filter((n) => Number.isFinite(n)))}
              placeholder="Any status"
              searchPlaceholder="Search statuses..."
            />
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <MultiSelectCombobox
              options={prioritySelectOptions}
              value={selectedPriorities.map(String)}
              onValueChange={(vals) => setSelectedPriorities(vals.map(v => Number(v)).filter((n) => Number.isFinite(n)))}
              placeholder="Any priority"
              searchPlaceholder="Search priorities..."
            />
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <MultiSelectCombobox
              options={spotSelectOptions}
              value={selectedSpots.map(String)}
              onValueChange={(vals) => setSelectedSpots(vals.map(v => Number(v)).filter((n) => Number.isFinite(n)))}
              placeholder="Any location"
              searchPlaceholder="Search locations..."
            />
          </div>

          <div className="space-y-2">
            <Label>Owner</Label>
            <MultiSelectCombobox
              options={ownerSelectOptions}
              value={selectedOwners.map(String)}
              onValueChange={(vals) => setSelectedOwners(vals.map(v => Number(v)).filter((n) => Number.isFinite(n)))}
              placeholder="Any owner"
              searchPlaceholder="Search owners..."
            />
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <TagMultiSelect
              tags={tagOptions}
              value={selectedTags}
              onValueChange={(vals) => setSelectedTags(vals.filter((n) => Number.isFinite(n)))}
              placeholder="Any tag"
              searchPlaceholder="Search tags..."
            />
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
            <Label>Text contains (name or description)</Label>
            <Input placeholder="e.g. leak, HVAC, meeting" value={textContains} onChange={(e) => setTextContains(e.target.value)} />
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


