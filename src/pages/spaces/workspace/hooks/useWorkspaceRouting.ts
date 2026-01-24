import { useMemo } from 'react';
import type { Location } from 'react-router-dom';
import { getWorkspaceBasePath, getWorkspaceIdFromPath, isAllWorkspacesRoute } from '../utils/routing';

export function useWorkspaceRouting(location: Location) {
  return useMemo(() => {
    const id = getWorkspaceIdFromPath(location.pathname);
    const workspaceBasePath = getWorkspaceBasePath(id);
    const isAllWorkspaces = isAllWorkspacesRoute(location.pathname, id);
    const workspaceIdNum = !isAllWorkspaces && id != null ? Number(id) : null;

    const invalidWorkspaceRoute = !id && !isAllWorkspaces;
    const invalidWorkspaceId = !isAllWorkspaces && id !== undefined && isNaN(Number(id));

    return {
      id,
      workspaceBasePath,
      isAllWorkspaces,
      workspaceIdNum,
      invalidWorkspaceRoute,
      invalidWorkspaceId,
    };
  }, [location.pathname]);
}

