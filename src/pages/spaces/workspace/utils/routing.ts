import type { Location } from 'react-router-dom';
import { WORKSPACE_TAB_PATHS, type WorkspaceTabKey } from '../constants';

export type { Location };

export function getWorkspaceIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/\/workspace\/([^/?]+)/);
  return match ? match[1] : undefined;
}

export function getWorkspaceBasePath(id: string | undefined) {
  return `/workspace/${id || 'all'}`.replace(/\/+$/, '');
}

export function isAllWorkspacesRoute(pathname: string, id: string | undefined) {
  return pathname === '/workspace/all' || id === 'all';
}

export function getCurrentWorkspaceTabFromUrl(params: {
  location: Location;
  workspaceBasePath: string;
}): WorkspaceTabKey {
  const { location, workspaceBasePath } = params;
  const normalizedBase = workspaceBasePath.replace(/\/+$/, '');
  if (location.pathname.startsWith(normalizedBase)) {
    const rest = location.pathname.slice(normalizedBase.length) || '';
    const entries = Object.entries(WORKSPACE_TAB_PATHS) as Array<[WorkspaceTabKey, string]>;
    entries.sort((a, b) => (b[1].length || 0) - (a[1].length || 0));
    for (const [key, value] of entries) {
      const val = value || '';
      if (val === '' && (rest === '' || rest === '/')) {
        return key;
      } else if (
        rest === val ||
        rest.replace(/\/$/, '') === val.replace(/\/$/, '') ||
        rest.startsWith(val.endsWith('/') ? val : `${val}/`)
      ) {
        return key;
      }
    }
  }
  return 'grid';
}

