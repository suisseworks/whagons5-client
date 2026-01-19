// User display and formatting utilities for WorkspaceTable

import type { User } from '@/store/types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

// Extend dayjs with relative time plugin
dayjs.extend(relativeTime);

export const getUserInitials = (user: User): string => {
  if (user?.name) {
    return user.name.split(' ').map(name => name.charAt(0)).join('').toUpperCase().slice(0, 2);
  }
  if (user?.email) {
    return user.email.slice(0, 2).toUpperCase();
  }
  return 'U';
};

export const getUserDisplayName = (user: User): string => {
  return user?.name || user?.email || 'User';
};

function parseUserIds(userIds: any): number[] {
  if (!userIds) return [];
  try {
    let arr: any[] = Array.isArray(userIds) ? userIds : typeof userIds === 'string' ? (JSON.parse(userIds) || []) : typeof userIds === 'number' ? [userIds] : [];
    return Array.isArray(arr) ? arr.filter(id => Number.isFinite(Number(id))).map(Number) : [];
  } catch { return []; }
}

export const getUserNames = (userIds: any, userMap: Record<number, User>): string => {
  const userIdArray = parseUserIds(userIds);
  
  if (userIdArray.length === 0) return 'No users assigned';

  const userNames = userIdArray
    .map(id => userMap[id])
    .filter((user): user is User => user != null)
    .map(user => user.name || `User ${user.id}`)
    .join(', ');

  return userNames;
};

export const getUsersFromIds = (userIds: any, userMap: Record<number, User>): User[] => {
  const userIdArray = parseUserIds(userIds);
  
  if (userIdArray.length === 0) return [];

  return userIdArray
    .map(id => userMap[id])
    .filter((user): user is User => user != null) as User[];
};

function formatDateWithPrefix(d: string | null, prefix: string, overdue = 'overdue', none = `No ${prefix.toLowerCase()}`): string {
  if (!d) return none;
  const date = dayjs(d);
  return date.isBefore(dayjs()) ? `${date.fromNow()} ${overdue}` : `${prefix} ${date.fromNow()}`;
}
export const formatDueDate = (d: string | null) => formatDateWithPrefix(d, 'Due', 'overdue', 'No due date');
export const formatResponseDate = (d: string | null) => formatDateWithPrefix(d, 'Responded', 'late', 'No response');
export const formatResolutionDate = (d: string | null) => formatDateWithPrefix(d, 'Resolved', 'late', 'No resolution');
