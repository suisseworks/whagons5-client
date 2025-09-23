export type MessageBoard = {
  id: string;
  name: string;
  description?: string | null;
  workspace_id?: number | null;
  user_ids?: number[];
  team_ids?: number[];
  created_at: string;
  updated_at: string;
};

const STORAGE_KEY = 'wh-message-boards';

function loadAll(): MessageBoard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as MessageBoard[] : [];
  } catch {
    return [];
  }
}

function saveAll(boards: MessageBoard[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const messageBoardsService = {
  list(): MessageBoard[] { return loadAll(); },
  get(id: string): MessageBoard | undefined { return loadAll().find(b => String(b.id) === String(id)); },
  create(input: { name: string; workspace_id?: number | null }): MessageBoard {
    const now = new Date().toISOString();
    const board: MessageBoard = { id: genId(), name: input.name.trim() || 'Untitled', description: '', workspace_id: input.workspace_id ?? null, user_ids: [], team_ids: [], created_at: now, updated_at: now };
    const boards = loadAll();
    boards.push(board); saveAll(boards); return board;
  },
  update(id: string, updates: Partial<MessageBoard>): MessageBoard | undefined {
    const boards = loadAll(); const idx = boards.findIndex(b => String(b.id) === String(id)); if (idx === -1) return undefined;
    boards[idx] = { ...boards[idx], ...updates, updated_at: new Date().toISOString() }; saveAll(boards); return boards[idx];
  },
  remove(id: string): void { saveAll(loadAll().filter(b => String(b.id) !== String(id))); },
  reorder(fromIndex: number, toIndex: number): MessageBoard[] {
    const boards = loadAll();
    if (
      !Number.isInteger(fromIndex) || !Number.isInteger(toIndex) ||
      fromIndex < 0 || fromIndex >= boards.length ||
      toIndex < 0 || toIndex >= boards.length
    ) {
      return boards;
    }
    const updated = boards.slice();
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    saveAll(updated);
    try { window.dispatchEvent(new Event('wh-boards-updated')); } catch {}
    return updated;
  },
};


