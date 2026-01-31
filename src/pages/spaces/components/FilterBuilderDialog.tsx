import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listPresets, savePreset, deletePreset, getPresetById, SavedFilterPreset } from './workspaceTable/utils/filterPresets';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { TagMultiSelect } from '@/components/ui/tag-multi-select';
import { useLanguage } from '@/providers/LanguageProvider';

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
  const { t } = useLanguage();
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
    const name = presetName.trim() || t('workspace.filters.untitledFilter', 'Untitled filter');
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
          <DialogTitle>{t('workspace.filters.title', 'Filters')}</DialogTitle>
          <DialogDescription className="text-muted-foreground/80">{t('workspace.filters.description', 'Build a custom filter and optionally save it for reuse.')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-normal text-muted-foreground">{t('workspace.filters.status', 'Status')}</Label>
            <MultiSelectCombobox
              options={statusSelectOptions}
              value={selectedStatuses.map(String)}
              onValueChange={(vals) => setSelectedStatuses(vals.map(v => Number(v)).filter((n) => Number.isFinite(n)))}
              placeholder={t('workspace.filters.anyStatus', 'Any status')}
              searchPlaceholder={t('workspace.filters.searchStatuses', 'Search statuses...')}
              className="font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-normal text-muted-foreground">{t('workspace.filters.priority', 'Priority')}</Label>
            <MultiSelectCombobox
              options={prioritySelectOptions}
              value={selectedPriorities.map(String)}
              onValueChange={(vals) => setSelectedPriorities(vals.map(v => Number(v)).filter((n) => Number.isFinite(n)))}
              placeholder={t('workspace.filters.anyPriority', 'Any priority')}
              searchPlaceholder={t('workspace.filters.searchPriorities', 'Search priorities...')}
              className="font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-normal text-muted-foreground">{t('workspace.filters.location', 'Location')}</Label>
            <MultiSelectCombobox
              options={spotSelectOptions}
              value={selectedSpots.map(String)}
              onValueChange={(vals) => setSelectedSpots(vals.map(v => Number(v)).filter((n) => Number.isFinite(n)))}
              placeholder={t('workspace.filters.anyLocation', 'Any location')}
              searchPlaceholder={t('workspace.filters.searchLocations', 'Search locations...')}
              className="font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-normal text-muted-foreground">{t('workspace.filters.owner', 'Owner')}</Label>
            <MultiSelectCombobox
              options={ownerSelectOptions}
              value={selectedOwners.map(String)}
              onValueChange={(vals) => setSelectedOwners(vals.map(v => Number(v)).filter((n) => Number.isFinite(n)))}
              placeholder={t('workspace.filters.anyOwner', 'Any owner')}
              searchPlaceholder={t('workspace.filters.searchOwners', 'Search owners...')}
              className="font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-normal text-muted-foreground">{t('workspace.filters.tags', 'Tags')}</Label>
            <TagMultiSelect
              tags={tagOptions}
              value={selectedTags}
              onValueChange={(vals) => setSelectedTags(vals.filter((n) => Number.isFinite(n)))}
              placeholder={t('workspace.filters.anyTag', 'Any tag')}
              searchPlaceholder={t('workspace.filters.searchTags', 'Search tags...')}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-normal text-muted-foreground">{t('workspace.filters.due', 'Due')}</Label>
            <Select value={dueQuick} onValueChange={(v) => setDueQuick(v as DueQuick)}>
              <SelectTrigger className="font-normal">
                <SelectValue placeholder={t('workspace.filters.any', 'Any')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t('workspace.filters.any', 'Any')}</SelectItem>
                <SelectItem value="overdue">{t('workspace.filters.overdue', 'Overdue')}</SelectItem>
                <SelectItem value="today">{t('workspace.filters.today', 'Today')}</SelectItem>
                <SelectItem value="next7">{t('workspace.filters.next7Days', 'Next 7 days')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-normal text-muted-foreground">{t('workspace.filters.textContains', 'Text contains (name or description)')}</Label>
            <Input 
              placeholder={t('workspace.filters.textContainsPlaceholder', 'e.g. leak, HVAC, meeting')} 
              value={textContains} 
              onChange={(e) => setTextContains(e.target.value)} 
              className="font-normal"
            />
          </div>

          <div className="space-y-2 md:col-span-2 pt-2 border-t border-border/50">
            <Label className="text-xs font-normal text-muted-foreground">{t('workspace.filters.savedPresets', 'Saved presets')}</Label>
            <div className="flex gap-2 items-center flex-wrap">
              <Select value={selectedPresetId} onValueChange={onLoadPreset}>
                <SelectTrigger className="min-w-[180px] flex-1 max-w-[220px] font-normal">
                  <SelectValue placeholder={presets.length ? t('workspace.filters.choosePreset', 'Choose a preset...') : t('workspace.filters.noPresetsYet', 'No presets yet')} />
                </SelectTrigger>
                <SelectContent>
                  {presets.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input 
                placeholder={t('workspace.filters.presetName', 'Preset name')} 
                value={presetName} 
                onChange={(e) => setPresetName(e.target.value)} 
                className="flex-1 min-w-[140px] max-w-[180px] font-normal" 
              />
              <Button variant="outline" size="sm" onClick={onSavePreset}>{t('workspace.filters.save', 'Save')}</Button>
              <Button variant="ghost" size="sm" onClick={onDeletePreset} disabled={!selectedPresetId} className="text-muted-foreground">{t('workspace.filters.delete', 'Delete')}</Button>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('workspace.filters.cancel', 'Cancel')}</Button>
          <Button onClick={apply}>{t('workspace.filters.applyFilters', 'Apply filters')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


