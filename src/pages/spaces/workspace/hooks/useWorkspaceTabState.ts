import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCurrentWorkspaceTabFromUrl, type Location } from '../utils/routing';
import { WORKSPACE_TAB_PATHS, type WorkspaceTabKey } from '../constants';

export function useWorkspaceTabState(params: {
  location: Location;
  workspaceBasePath: string;
  invalidWorkspaceRoute: boolean;
  invalidWorkspaceId: boolean;
  resolvedOrder: WorkspaceTabKey[];
}) {
  const { location, workspaceBasePath, invalidWorkspaceRoute, invalidWorkspaceId, resolvedOrder } = params;
  const navigate = useNavigate();
  
  const getCurrentTabFromUrl = (): WorkspaceTabKey => {
    return getCurrentWorkspaceTabFromUrl({ location, workspaceBasePath });
  };

  const initialTab = getCurrentTabFromUrl();
  const [activeTab, setActiveTab] = useState<WorkspaceTabKey>(initialTab);
  const [prevActiveTab, setPrevActiveTab] = useState<WorkspaceTabKey>(initialTab);
  const isInitialMountRef = useRef(true);
  const prevWorkspaceIdRef = useRef<string | undefined>(undefined);

  // Save active tab to localStorage when it changes (but not on initial mount)
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    
    if (invalidWorkspaceRoute || invalidWorkspaceId) return;
    
    try {
      const id = location.pathname.match(/\/workspace\/([^/?]+)/)?.[1] || 'all';
      const key = `wh_workspace_last_tab_${id}`;
      localStorage.setItem(key, activeTab);
    } catch (error) {
      console.error('[Workspace] Error saving last tab:', error);
    }
  }, [activeTab, location.pathname, invalidWorkspaceRoute, invalidWorkspaceId]);
  
  // Restore last tab when navigating to a workspace (only on workspace change)
  useEffect(() => {
    if (invalidWorkspaceRoute || invalidWorkspaceId) return;
    
    const id = location.pathname.match(/\/workspace\/([^/?]+)/)?.[1];
    const workspaceChanged = prevWorkspaceIdRef.current !== id;
    prevWorkspaceIdRef.current = id;
    
    if (!workspaceChanged) return;
    
    const workspaceKey = id || 'all';
    
    try {
      const key = `wh_workspace_last_tab_${workspaceKey}`;
      const savedTab = localStorage.getItem(key);
      
      if (savedTab && Object.keys(WORKSPACE_TAB_PATHS).includes(savedTab)) {
        const currentPath = location.pathname;
        const isExactWorkspaceRoot = currentPath === workspaceBasePath || 
                                      currentPath === `${workspaceBasePath}/` || 
                                      currentPath === `${workspaceBasePath}${WORKSPACE_TAB_PATHS.grid}`;
        
        if (savedTab !== 'grid' && isExactWorkspaceRoot) {
          const savedTabPath = WORKSPACE_TAB_PATHS[savedTab as WorkspaceTabKey];
          const targetPath = `${workspaceBasePath}${savedTabPath}`;
          console.log(`[Workspace] Restoring last tab for workspace ${workspaceKey}:`, savedTab, '→', targetPath);
          
          setTimeout(() => {
            navigate(targetPath, { replace: true });
          }, 0);
        } else if (savedTab === 'grid' && !isExactWorkspaceRoot) {
          console.log(`[Workspace] Navigating to root for workspace ${workspaceKey}`);
          setTimeout(() => {
            navigate(workspaceBasePath, { replace: true });
          }, 0);
        }
      }
    } catch (error) {
      console.error('[Workspace] Error restoring last tab:', error);
    }
  }, [location.pathname, navigate, workspaceBasePath, invalidWorkspaceRoute, invalidWorkspaceId]);

  // Sync tab state when URL changes
  useEffect(() => {
    const currentTabFromUrl = getCurrentTabFromUrl();
    if (currentTabFromUrl !== activeTab) {
      setPrevActiveTab(currentTabFromUrl);
      setActiveTab(currentTabFromUrl);
    }
  }, [location.pathname, workspaceBasePath]);

  // Ensure active tab is in resolved order
  useEffect(() => {
    if (invalidWorkspaceRoute || invalidWorkspaceId) return;
    const allowedSet = new Set(resolvedOrder);
    if (!allowedSet.has(activeTab)) {
      const fallbackTab = resolvedOrder[0] || 'grid';
      const targetPath = `${workspaceBasePath}${WORKSPACE_TAB_PATHS[fallbackTab]}`;
      const normalizedTarget = targetPath.replace(/\/+$/, '');
      const normalizedCurrent = location.pathname.replace(/\/+$/, '');
      if (normalizedCurrent !== normalizedTarget) {
        navigate(targetPath, { replace: true });
      }
    }
  }, [resolvedOrder, activeTab, navigate, location.pathname, workspaceBasePath, invalidWorkspaceRoute, invalidWorkspaceId]);

  return {
    activeTab,
    setActiveTab,
    prevActiveTab,
    setPrevActiveTab,
  };
}
