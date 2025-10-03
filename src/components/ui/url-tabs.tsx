import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/animated/Tabs';

interface TabItem {
  value: string;
  label: string | React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

interface UrlTabsProps {
  tabs: TabItem[];
  defaultValue?: string;
  basePath?: string; // Base path for URL construction (e.g., "/workspace/1/settings")
  tabParam?: string; // URL parameter name for the tab (default: "tab")
  className?: string;
  children?: React.ReactNode;
  onValueChange?: (value: string) => void;
  // Path mode: map logical value -> path suffix (e.g., { users: '/users', overview: '' })
  pathMap?: Record<string, string>;
}

/**
 * URL-based tab persistence component that syncs tab state with URL parameters.
 * When tabs change, the URL updates, and when the page loads, it reads the tab from the URL.
 * This allows for deep linking to specific tabs and proper browser back/forward behavior.
 */
export function UrlTabs({
  tabs,
  defaultValue,
  basePath,
  tabParam = 'tab',
  className,
  children,
  onValueChange,
  pathMap,
}: UrlTabsProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Get current tab from URL or use default
  const getCurrentTabFromUrl = (): string => {
    // Path mode if pathMap is provided
    if (basePath && pathMap) {
      const normalizedBase = basePath.replace(/\/+$/, '');
      if (location.pathname.startsWith(normalizedBase)) {
        const rest = location.pathname.slice(normalizedBase.length) || '';
        // Normalize values to start with '/'
        const entries = Object.entries(pathMap).map(([k, v]) => [k, (v || '') as string]) as Array<[string,string]>;
        // Sort by descending length to prefer more specific prefixes
        entries.sort((a, b) => (b[1].length || 0) - (a[1].length || 0));
        for (const [key, value] of entries) {
          const val = value || '';
          if (val === '' && (rest === '' || rest === '/')) {
            if (tabs.some(t => t.value === key)) return key;
          } else if (rest === val || rest.replace(/\/$/, '') === val.replace(/\/$/, '') || rest.startsWith(val.endsWith('/') ? val : `${val}/`)) {
            if (tabs.some(t => t.value === key)) return key;
          }
        }
      }
    }

    // Query mode
    const urlParams = new URLSearchParams(location.search);
    const tabFromUrl = urlParams.get(tabParam);
    if (tabFromUrl && tabs.some(t => t.value === tabFromUrl)) return tabFromUrl;
    return defaultValue || tabs[0]?.value || '';
  };

  const [activeTab, setActiveTab] = useState(getCurrentTabFromUrl);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);

    if (basePath) {
      // Path mode
      if (pathMap) {
        const normalizedBase = basePath.replace(/\/+$/, '');
        const seg = pathMap[value] || '';
        const newUrl = `${normalizedBase}${seg}`;
        navigate(newUrl, { replace: true });
      } else {
        // Query mode
        const urlParams = new URLSearchParams(location.search);
        urlParams.set(tabParam, value);
        const search = `?${tabParam}=${encodeURIComponent(value)}`;
        const newUrl = `${basePath}${search}`;
        navigate(newUrl, { replace: true });
      }
    }

    // Call external handler if provided
    onValueChange?.(value);
  };

  // Update active tab when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const currentTabFromUrl = getCurrentTabFromUrl();
    if (currentTabFromUrl !== activeTab) {
      setActiveTab(currentTabFromUrl);
    }
  }, [location.search, location.pathname]);

  // Update active tab when tabs prop changes (e.g., tabs become available)
  useEffect(() => {
    if (!activeTab && tabs.length > 0) {
      const currentTabFromUrl = getCurrentTabFromUrl();
      setActiveTab(currentTabFromUrl || defaultValue || tabs[0].value);
    }
  }, [tabs]);

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className={className}>
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}

      {children}
    </Tabs>
  );
}

export default UrlTabs;
