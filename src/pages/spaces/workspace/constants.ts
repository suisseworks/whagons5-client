export const WORKSPACE_TAB_PATHS = {
  grid: '',
  calendar: '/calendar',
  scheduler: '/scheduler',
  map: '/map',
  board: '/board',
  settings: '/settings',
  statistics: '/statistics',
} as const;

export type WorkspaceTabKey = keyof typeof WORKSPACE_TAB_PATHS;

export const DEFAULT_TAB_SEQUENCE: WorkspaceTabKey[] = [
  'grid',
  'calendar',
  'scheduler',
  'map',
  'board',
  'statistics',
  'settings',
];

// Tabs that cannot be reordered
export const FIXED_TABS: WorkspaceTabKey[] = ['statistics', 'settings'];

// Tabs always visible even if user hides others
export const ALWAYS_VISIBLE_TABS: WorkspaceTabKey[] = ['grid', 'statistics', 'settings'];

