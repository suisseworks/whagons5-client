// Grid configuration and styling utilities for WorkspaceTable
import React from 'react';

export const GRID_STYLES = {
  container: { width: '100%', height: '100%' },
  grid: { height: '100%', width: '100%' },
  loadingSpinner: 'flex items-center justify-center h-full',
};

export const GRID_CONSTANTS = {
  ROW_HEIGHT: 64,
  HEADER_HEIGHT: 44,
  ROW_BUFFER: 20,
  CLIENT_THRESHOLD: 1000,
  CACHE_BLOCK_SIZE: 800,
  MAX_CONCURRENT_REQUESTS: 1,
  MAX_BLOCKS_IN_CACHE: 30,
};

export const createLoadingSpinner = () => (
  <div className="w-full h-full flex flex-col bg-background">
    {/* Header */}
    <div className="h-[44px] w-full border-b flex items-center px-6 gap-4 bg-muted/20">
      <div className="h-4 w-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      <div className="ml-auto flex gap-4">
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    </div>
    {/* Body */}
    <div className="flex-1 p-0 overflow-hidden">
      {Array.from({ length: 15 }).map((_, i) => (
        <div 
            key={i} 
            className="h-[64px] w-full border-b border-border/50 flex items-center px-6 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-backwards"
            style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="flex-1 flex flex-col gap-2">
             <div className="h-4 w-[30%] bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
             <div className="h-3 w-[20%] bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          </div>
          <div className="h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
        </div>
      ))}
    </div>
  </div>
);

export const createGridContainer = (children: React.ReactNode) => {
  let densityClass = 'wh-density-comfortable';
  try {
    const v = (localStorage.getItem('wh_workspace_density') as any) || 'comfortable';
    if (v === 'compact') densityClass = 'wh-density-compact';
    else if (v === 'spacious') densityClass = 'wh-density-spacious';
    else densityClass = 'wh-density-comfortable';
  } catch {}
  return (
    <div style={GRID_STYLES.container} className={`ag-theme-quartz wh-workspace-grid wh-modern-grid ${densityClass} h-full w-full overflow-x-auto`}>
      <div style={GRID_STYLES.grid}>
        {children}
      </div>
    </div>
  );
};
