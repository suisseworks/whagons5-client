import { useEffect, useState } from 'react';
import type { WorkspaceTabKey } from '../constants';

export function useWorkspaceDisplayOptions(workspaceKey: string) {
  const [showHeaderKpis, setShowHeaderKpis] = useState<boolean>(() => {
    try {
      const key = `wh_workspace_show_kpis_${workspaceKey}`;
      const saved = localStorage.getItem(key);
      return saved == null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const [tagDisplayMode, setTagDisplayMode] = useState<'icon' | 'icon-text'>(() => {
    try {
      const key = `wh_workspace_tag_display_mode_${workspaceKey}`;
      const saved = localStorage.getItem(key);
      return saved === 'icon' || saved === 'icon-text' ? saved : 'icon-text';
    } catch {
      return 'icon-text';
    }
  });

  const [visibleTabs, setVisibleTabs] = useState<WorkspaceTabKey[]>(() => {
    const defaultTabs: WorkspaceTabKey[] = ['grid', 'calendar', 'scheduler', 'map', 'board', 'whiteboard'];
    try {
      const key = `wh_workspace_visible_tabs_${workspaceKey}`;
      const raw = localStorage.getItem(key);
      if (!raw) return defaultTabs;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        const parsedTabs = parsed as WorkspaceTabKey[];
        // Always ensure grid is included
        return Array.from(new Set(['grid', ...parsedTabs]));
      }
    } catch {}
    return defaultTabs;
  });

  // Reload per-workspace values when key changes
  useEffect(() => {
    try {
      const key = `wh_workspace_show_kpis_${workspaceKey}`;
      const saved = localStorage.getItem(key);
      setShowHeaderKpis(saved == null ? true : saved === 'true');
    } catch {}
    try {
      const key = `wh_workspace_tag_display_mode_${workspaceKey}`;
      const saved = localStorage.getItem(key);
      setTagDisplayMode(saved === 'icon' || saved === 'icon-text' ? saved : 'icon-text');
    } catch {}
    try {
      const key = `wh_workspace_visible_tabs_${workspaceKey}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
          const parsedTabs = parsed as WorkspaceTabKey[];
          // Always ensure grid is included
          setVisibleTabs(Array.from(new Set(['grid', ...parsedTabs])));
        }
      } else {
        setVisibleTabs(['grid', 'calendar', 'scheduler', 'map', 'board', 'whiteboard']);
      }
    } catch {}
  }, [workspaceKey]);

  // External events coming from Settings screen
  useEffect(() => {
    const handler = (e: any) => {
      const eventWorkspaceId = e?.detail?.workspaceId || 'all';
      if (eventWorkspaceId !== workspaceKey) return;
      const v = e?.detail?.showKpis;
      if (typeof v === 'boolean') setShowHeaderKpis(v);
      const tagMode = e?.detail?.tagDisplayMode;
      if (tagMode === 'icon' || tagMode === 'icon-text') setTagDisplayMode(tagMode);
    };
    window.addEventListener('wh:displayOptionsChanged', handler as any);
    return () => window.removeEventListener('wh:displayOptionsChanged', handler as any);
  }, [workspaceKey]);

  useEffect(() => {
    const handler = (e: any) => {
      const eventWorkspaceId = e?.detail?.workspaceId || 'all';
      if (eventWorkspaceId !== workspaceKey) return;
      const tabs = e?.detail?.visibleTabs;
      if (Array.isArray(tabs) && tabs.every((x) => typeof x === 'string')) {
        setVisibleTabs(Array.from(new Set(['grid', ...(tabs as WorkspaceTabKey[])])));
      }
    };
    window.addEventListener('wh:workspaceTabsChanged', handler as any);
    return () => window.removeEventListener('wh:workspaceTabsChanged', handler as any);
  }, [workspaceKey]);

  return { showHeaderKpis, tagDisplayMode, visibleTabs };
}

