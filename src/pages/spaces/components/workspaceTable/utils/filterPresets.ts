const STORAGE_KEY = 'wh_workspace_saved_filters_v1';
const PIN_STORAGE_KEY = 'wh_workspace_pinned_filters_v1';

export type SavedFilterPreset = {
  id: string;
  name: string;
  workspaceScope: 'all' | string; // 'all' or specific workspace id
  model: any;
  searchText?: string;
  createdAt: number;
  updatedAt: number;
};

type PresetStore = {
  presets: SavedFilterPreset[];
};

const readStore = (): PresetStore => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { presets: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.presets)) return { presets: parsed.presets };
    return { presets: [] };
  } catch {
    return { presets: [] };
  }
};

const writeStore = (store: PresetStore) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
};

type PinStore = { [scope: string]: string[] };

const readPinStore = (): PinStore => {
  try {
    const raw = localStorage.getItem(PIN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writePinStore = (store: PinStore) => {
  try {
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(store));
  } catch {}
};

export const listPresets = (workspaceId: string | 'all'): SavedFilterPreset[] => {
  const { presets } = readStore();
  return presets.filter(p => p.workspaceScope === 'all' || p.workspaceScope === workspaceId);
};

export const savePreset = (preset: Omit<SavedFilterPreset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): SavedFilterPreset => {
  const store = readStore();
  const now = Date.now();
  if (preset.id) {
    const idx = store.presets.findIndex(p => p.id === preset.id);
    if (idx !== -1) {
      const updated: SavedFilterPreset = { ...store.presets[idx], ...preset, updatedAt: now } as SavedFilterPreset;
      store.presets[idx] = updated;
      writeStore(store);
      return updated;
    }
  }
  const id = `p_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const created: SavedFilterPreset = { id, name: preset.name, workspaceScope: preset.workspaceScope, model: preset.model, searchText: preset.searchText, createdAt: now, updatedAt: now };
  store.presets.push(created);
  writeStore(store);
  return created;
};

export const deletePreset = (id: string) => {
  const store = readStore();
  const next = store.presets.filter(p => p.id !== id);
  writeStore({ presets: next });
  // Also remove from pin store across all scopes
  try {
    const pins = readPinStore();
    let changed = false;
    for (const scope of Object.keys(pins)) {
      const list = pins[scope] || [];
      const filtered = list.filter(x => x !== id);
      if (filtered.length !== list.length) { pins[scope] = filtered; changed = true; }
    }
    if (changed) writePinStore(pins);
  } catch {}
};

export const getPresetById = (id: string): SavedFilterPreset | undefined => {
  const { presets } = readStore();
  return presets.find(p => p.id === id);
};

export const listPinnedPresets = (workspaceId: string | 'all'): SavedFilterPreset[] => {
  const pins = readPinStore();
  const pinnedIds = (pins[workspaceId] || []).slice();
  if (pinnedIds.length === 0) return [];
  const all = listPresets(workspaceId);
  const byId = new Map(all.map(p => [p.id, p] as const));
  return pinnedIds.map(id => byId.get(id)).filter(Boolean) as SavedFilterPreset[];
};

export const isPinned = (workspaceId: string | 'all', presetId: string): boolean => {
  const pins = readPinStore();
  const list = pins[workspaceId] || [];
  return list.includes(presetId);
};

export const pinPreset = (workspaceId: string | 'all', presetId: string) => {
  const pins = readPinStore();
  const list = pins[workspaceId] || [];
  const next = [presetId, ...list.filter(x => x !== presetId)].slice(0, 8);
  pins[workspaceId] = next;
  writePinStore(pins);
};

export const unpinPreset = (workspaceId: string | 'all', presetId: string) => {
  const pins = readPinStore();
  const list = pins[workspaceId] || [];
  pins[workspaceId] = list.filter(x => x !== presetId);
  writePinStore(pins);
};

export const togglePin = (workspaceId: string | 'all', presetId: string) => {
  if (isPinned(workspaceId, presetId)) unpinPreset(workspaceId, presetId); else pinPreset(workspaceId, presetId);
};

export const setPinnedOrder = (workspaceId: string | 'all', orderedIds: string[]) => {
  const pins = readPinStore();
  // Only keep ids that are currently pinned in this scope
  const current = new Set((pins[workspaceId] || []));
  const next = orderedIds.filter(id => current.has(id));
  pins[workspaceId] = next;
  writePinStore(pins);
};


