export type WorkspaceTabKey = 'grid' | 'calendar' | 'scheduler' | 'map' | 'board' | 'statistics' | 'settings';
export type SettingsTabKey = 'favorites' | 'basics' | 'advanced' | 'plugins';
export type WorkspaceSettingsTabKey = 'overview' | 'users' | 'filters' | 'display';

export interface TabAnimationConfig<T extends string = string> {
  order: T[];
  distance: string | number;
  transition: {
    duration: number;
    type: 'spring';
    stiffness: number;
    damping: number;
  };
}

export const TAB_ANIMATION: TabAnimationConfig<WorkspaceTabKey> = {
	order: ['grid', 'calendar', 'scheduler', 'map', 'board', 'statistics', 'settings'],
  distance: '80vw',
  transition: {
    duration: 0.05,
    type: 'spring',
    stiffness: 400,
    damping: 32,
  },
};

export const SETTINGS_TAB_ANIMATION: TabAnimationConfig<SettingsTabKey> = {
  order: ['favorites', 'basics', 'advanced', 'plugins'],
  distance: '80vw',
  transition: {
    duration: 0.05,
    type: 'spring',
    stiffness: 400,
    damping: 32,
  },
};

export const WORKSPACE_SETTINGS_TAB_ANIMATION: TabAnimationConfig<WorkspaceSettingsTabKey> = {
  order: ['display', 'overview', 'users', 'filters'],
  distance: '80vw',
  transition: {
    duration: 0.05,
    type: 'spring',
    stiffness: 400,
    damping: 32,
  },
};

function negativeDistance(distance: string | number): string | number {
  if (typeof distance === 'number') return -distance;
  return distance.startsWith('-') ? distance : `-${distance}`;
}

/**
 * Generic function to calculate the initial X position for tab animations based on direction.
 * Uses the provided config to determine tab order and animation distance.
 */
export function getTabInitialX<T extends string>(
  prev: T | string | null | undefined,
  next: T | string,
  config: TabAnimationConfig<T>
): string | number {
  if (!prev || prev === next) return 0;
  const from = config.order.indexOf(prev as T);
  const to = config.order.indexOf(next as T);
  if (from === -1 || to === -1) return 0;
  return to > from ? config.distance : negativeDistance(config.distance);
}

/**
 * Legacy function for workspace tabs - uses TAB_ANIMATION config by default.
 * @deprecated Use getTabInitialX with explicit config instead for better type safety.
 */
export function getWorkspaceTabInitialX(
  prev: WorkspaceTabKey | string | null | undefined,
  next: WorkspaceTabKey | string
): string | number {
  return getTabInitialX(prev, next, TAB_ANIMATION);
}

/**
 * Convenience function for settings tabs.
 */
export function getSettingsTabInitialX(
  prev: SettingsTabKey | string | null | undefined,
  next: SettingsTabKey | string
): string | number {
  return getTabInitialX(prev, next, SETTINGS_TAB_ANIMATION);
}

/**
 * Convenience function for workspace settings tabs.
 */
export function getWorkspaceSettingsTabInitialX(
  prev: WorkspaceSettingsTabKey | string | null | undefined,
  next: WorkspaceSettingsTabKey | string
): string | number {
  return getTabInitialX(prev, next, WORKSPACE_SETTINGS_TAB_ANIMATION);
}


