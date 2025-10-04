// Grid configuration and styling utilities for WorkspaceTable
import React from 'react';

export const GRID_STYLES = {
  container: { width: '100%', height: '100%' },
  grid: { height: '100%', width: '100%' },
  loadingSpinner: 'flex items-center justify-center h-full',
};

export const GRID_CONSTANTS = {
  ROW_HEIGHT: 80,
  HEADER_HEIGHT: 44,
  ROW_BUFFER: 50,
  CLIENT_THRESHOLD: 1000,
  CACHE_BLOCK_SIZE: 500,
  MAX_CONCURRENT_REQUESTS: 1,
  MAX_BLOCKS_IN_CACHE: 10,
};

export const createLoadingSpinner = () => (
  <div className={GRID_STYLES.loadingSpinner}>
    <i className="fas fa-spinner fa-pulse fa-2x"></i>
  </div>
);

export const createGridContainer = (children: React.ReactNode) => (
  <div style={GRID_STYLES.container} className="ag-theme-quartz wh-workspace-grid h-full w-full">
    <div style={GRID_STYLES.grid}>
      {children}
    </div>
  </div>
);
