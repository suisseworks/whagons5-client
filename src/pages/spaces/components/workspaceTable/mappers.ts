// Pure mapping utilities for WorkspaceTable
import type { User } from '@/store/types';

export function createStatusMap(globalStatuses: any[]): Record<number, any> {
  const m: Record<number, any> = {};
  for (const st of globalStatuses || []) {
    const anySt: any = st as any;
    if (anySt && typeof anySt.id !== 'undefined') {
      const idNum = Number(anySt.id);
      m[idNum] = { name: anySt.name || `Status ${idNum}`, color: anySt.color, icon: anySt.icon, action: anySt.action } as any;
    }
  }
  return m;
}

export function createPriorityMap(priorities: any[]): Record<number, any> {
  const m: Record<number, any> = {};
  for (const priority of priorities || []) {
    const anyPriority: any = priority as any;
    if (anyPriority && typeof anyPriority.id !== 'undefined') {
      const idNum = Number(anyPriority.id);
      m[idNum] = { name: anyPriority.name || `Priority ${idNum}`, color: anyPriority.color, level: anyPriority.level } as any;
    }
  }
  return m;
}

export function createSpotMap(spots: any[]): Record<number, any> {
  const m: Record<number, any> = {};
  for (const spot of spots || []) {
    const anySpot: any = spot as any;
    if (anySpot && typeof anySpot.id !== 'undefined') {
      const idNum = Number(anySpot.id);
      m[idNum] = { name: anySpot.name || `Spot ${idNum}`, description: anySpot.description } as any;
    }
  }
  return m;
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
  const m: Record<number, any> = {};
  for (const tag of tags || []) {
    const anyTag: any = tag as any;
    if (anyTag && typeof anyTag.id !== 'undefined') {
      const idNum = Number(anyTag.id);
      m[idNum] = { name: anyTag.name || `Tag ${idNum}`, color: anyTag.color || '#6B7280' };
    }
  }
  return m;
}


