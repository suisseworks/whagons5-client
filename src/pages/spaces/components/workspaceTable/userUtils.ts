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

export const getUserNames = (userIds: any, userMap: Record<number, User>): string => {
  if (!userIds) return 'No users assigned';

  // Handle different possible formats
  let userIdArray: number[] = [];

  try {
    if (Array.isArray(userIds)) {
      userIdArray = userIds;
    } else if (typeof userIds === 'string') {
      // Try to parse JSON string
      const parsed = JSON.parse(userIds);
      userIdArray = Array.isArray(parsed) ? parsed : [];
    } else if (typeof userIds === 'number') {
      // Handle single user ID
      userIdArray = [userIds];
    }

    // Ensure userIdArray is actually an array
    if (!Array.isArray(userIdArray)) {
      console.warn('userIds is not an array:', userIds);
      return 'No users assigned';
    }

    if (userIdArray.length === 0) return 'No users assigned';

    const userNames = userIdArray
      .map(id => userMap[id])
      .filter((user): user is User => user != null)
      .map(user => user.name || `User ${user.id}`)
      .join(', ');

    return userNames;
  } catch (error) {
    console.error('Error processing userIds:', error, userIds);
    return 'No users assigned';
  }
};

export const getUsersFromIds = (userIds: any, userMap: Record<number, User>): User[] => {
  if (!userIds) return [];

  // Handle different possible formats
  let userIdArray: number[] = [];

  try {
    if (Array.isArray(userIds)) {
      userIdArray = userIds;
    } else if (typeof userIds === 'string') {
      // Try to parse JSON string
      const parsed = JSON.parse(userIds);
      userIdArray = Array.isArray(parsed) ? parsed : [];
    } else if (typeof userIds === 'number') {
      // Handle single user ID
      userIdArray = [userIds];
    }

    // Ensure userIdArray is actually an array
    if (!Array.isArray(userIdArray)) {
      console.warn('userIds is not an array:', userIds);
      return [];
    }

    if (userIdArray.length === 0) return [];

    return userIdArray
      .map(id => userMap[id])
      .filter((user): user is User => user != null) as User[];
  } catch (error) {
    console.error('Error processing userIds:', error, userIds);
    return [];
  }
};

export const formatDueDate = (dateString: string | null): string => {
  if (!dateString) return 'No due date';

  const date = dayjs(dateString);
  const now = dayjs();

  if (date.isBefore(now)) {
    return `${date.fromNow()} overdue`;
  } else {
    return `Due ${date.fromNow()}`;
  }
};

export const formatResponseDate = (dateString: string | null): string => {
  if (!dateString) return 'No response';

  const date = dayjs(dateString);
  const now = dayjs();
  const formatted = formatDueDate(dateString);

  if (date.isBefore(now)) {
    return formatted.replace('Due ', 'Responded ').replace('overdue', 'late');
  } else {
    return formatted.replace('Due ', 'Responded ');
  }
};

export const formatResolutionDate = (dateString: string | null): string => {
  if (!dateString) return 'No resolution';

  const date = dayjs(dateString);
  const now = dayjs();
  const formatted = formatDueDate(dateString);

  if (date.isBefore(now)) {
    return formatted.replace('Due ', 'Resolved ').replace('overdue', 'late');
  } else {
    return formatted.replace('Due ', 'Resolved ');
  }
};
