/**
 * Shared utilities for column renderers
 */

import { AvatarFallback } from "@/components/ui/avatar";

/**
 * Get contrasting text color for a background color
 * Uses the shared utility from columnUtils
 */
import { getContrastTextColor } from '../../columnUtils/color';
export { getContrastTextColor };

export function createVisibilityChecker(visibleColumns?: string[]): (id: string | undefined) => boolean {
  const set = Array.isArray(visibleColumns) ? new Set(visibleColumns) : null;
  return (id) => !set || !id || id === 'name' || id === 'notes' || id === 'id' || set.has(id);
}

/**
 * User initial avatar component
 */
export const UserInitial = ({ user, getUserDisplayName }: { user: any; getUserDisplayName: (user: any) => string }) => {
  const name: string = getUserDisplayName(user) || '';
  const initial = (name.trim().charAt(0) || '?').toUpperCase();
  const userColor = user?.color;
  
  const hasColor = !!userColor && 
                   typeof userColor === 'string' && 
                   userColor.trim() !== '' && 
                   userColor.trim() !== 'null' && 
                   userColor.trim() !== 'undefined';

  const getUserColorStyle = (color?: string | null) => {
    if (!color) return {};
    return {
      backgroundColor: color,
      color: getContrastTextColor(color),
    };
  };
  
  const colorStyle = hasColor ? getUserColorStyle(userColor) : {};
  const fallbackClass = hasColor ? 'text-[11px] font-semibold' : 'text-[11px] font-semibold bg-primary text-primary-foreground';
  const fallbackStyle = hasColor ? colorStyle : undefined;

  return (
    <AvatarFallback
      className={fallbackClass}
      style={fallbackStyle}
    >
      {initial}
    </AvatarFallback>
  );
};

/**
 * Cached user name getter
 */
export function createUserNameCache(getUserDisplayName: (user: any) => string) {
  const userNameCache = new Map<number, string>();
  return (user: any): string => {
    const id = Number((user as any)?.id);
    if (!Number.isFinite(id)) return getUserDisplayName(user);
    const cached = userNameCache.get(id);
    if (cached) return cached;
    const name = getUserDisplayName(user);
    userNameCache.set(id, name);
    return name;
  };
}

/**
 * Priority palette cache
 */
export function createPriorityPaletteCache() {
  const priorityPaletteCache = new Map<number, { bg: string; text: string }>();
  return (priorityId: number, name: string, color?: string) => {
    const cached = priorityPaletteCache.get(priorityId);
    if (cached) return cached;
    const lower = (name || '').toLowerCase();
    const palette =
      lower.includes('high')
        ? { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444' }
        : lower.includes('medium')
          ? { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B' }
          : lower.includes('low')
            ? { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981' }
            : { bg: `color-mix(in oklab, ${(color || '#6B7280')} 12%, #ffffff 88%)`, text: (color || '#6B7280') };
    priorityPaletteCache.set(priorityId, palette);
    return palette;
  };
}
