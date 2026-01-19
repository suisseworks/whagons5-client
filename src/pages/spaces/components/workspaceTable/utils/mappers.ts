// Pure mapping utilities for WorkspaceTable
import type { User } from '@/store/types';

function createRecordMap<T>(items: any[], getId: (item: any) => number | undefined, getValue: (item: any, id: number) => T): Record<number, T> {
  const m: Record<number, T> = {};
  for (const item of items || []) {
    const id = getId(item);
    if (id != null && Number.isFinite(id)) m[id] = getValue(item, id);
  }
  return m;
}

export function createStatusMap(globalStatuses: any[]): Record<number, any> {
  return createRecordMap(globalStatuses,
    (st) => st && typeof st.id !== 'undefined' ? Number(st.id) : undefined,
    (st, id) => ({ name: st.name || `Status ${id}`, color: st.color, icon: st.icon, action: st.action })
  );
}

export function createPriorityMap(priorities: any[]): Record<number, any> {
  return createRecordMap(priorities,
    (p) => p && typeof p.id !== 'undefined' ? Number(p.id) : undefined,
    (p, id) => ({ name: p.name || `Priority ${id}`, color: p.color, level: p.level })
  );
}

export function createSpotMap(spots: any[]): Record<number, any> {
  return createRecordMap(spots,
    (s) => s && typeof s.id !== 'undefined' ? Number(s.id) : undefined,
    (s, id) => ({ name: s.name || `Spot ${id}`, description: s.description })
  );
}

export function createUserMap(users: any[]): Record<number, User> {
  const m: Record<number, User> = {};
  for (const user of users || []) {
    m[user.id] = user;
  }
  return m;
}

export function createCategoryToGroup(categories: any[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const c of categories || []) {
    const id = Number((c as any).id);
    const gid = Number((c as any).status_transition_group_id);
    if (Number.isFinite(id) && Number.isFinite(gid)) m.set(id, gid);
  }
  return m;
}

export function createTransitionsByGroupFrom(statusTransitions: any[]): Map<number, Map<number, Set<number>>> {
  const map = new Map<number, Map<number, Set<number>>>();
  for (const tr of statusTransitions || []) {
    const g = Number((tr as any).status_transition_group_id);
    const from = Number((tr as any).from_status);
    const to = Number((tr as any).to_status);
    if (!Number.isFinite(g) || !Number.isFinite(from) || !Number.isFinite(to)) continue;
    if (!map.has(g)) map.set(g, new Map());
    const inner = map.get(g)!;
    if (!inner.has(from)) inner.set(from, new Set());
    inner.get(from)!.add(to);
  }
  return map;
}

export function getAllowedNextStatusesFactory(
  categoryToGroup: Map<number, number>,
  transitionsByGroupFrom: Map<number, Map<number, Set<number>>>
) {
  return (task: any): number[] => {
    const groupId = categoryToGroup.get(Number(task.category_id));
    if (!groupId) return [];
    const byFrom = transitionsByGroupFrom.get(groupId);
    if (!byFrom) return [];
    const set = byFrom.get(Number(task.status_id));
    return set ? Array.from(set.values()) : [];
  };
}

export function createFilteredPriorities(priorities: any[], defaultCategoryId: number | null): any[] {
  if (defaultCategoryId == null) return priorities;
  return (priorities || []).filter((p: any) => Number((p as any).category_id) === Number(defaultCategoryId));
}

export function createTagMap(tags: any[]): Record<number, any> {
  return createRecordMap(tags,
    (t) => t && typeof t.id !== 'undefined' ? Number(t.id) : undefined,
    (t, id) => ({ name: t.name || `Tag ${id}`, color: t.color || '#6B7280', icon: t.icon || null })
  );
}


