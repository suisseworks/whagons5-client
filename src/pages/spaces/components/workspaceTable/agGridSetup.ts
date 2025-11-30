// AG Grid setup and configuration utilities for WorkspaceTable

export const AG_GRID_LICENSE = import.meta.env.VITE_AG_GRID_LICENSE_KEY as string | undefined;

export const loadAgGridModules = async (): Promise<boolean> => {
  try {
    const community: any = await import('ag-grid-community');
    const enterprise: any = await import('ag-grid-enterprise');

    const { ModuleRegistry } = community;

    const pick = (pkg: any, name: string) => (pkg && pkg[name]) || null;

    const toRegister = [
      // community
      'TextFilterModule',
      'NumberFilterModule',
      'DateFilterModule',
      'CustomFilterModule',
      'ExternalFilterModule',
      'QuickFilterModule',
      'ClientSideRowModelModule',
      'InfiniteRowModelModule',
      // enterprise
      'RowGroupingModule',
      'SetFilterModule',
      'MultiFilterModule',
      'AdvancedFilterModule',
      'ServerSideRowModelModule',
    ]
      .map((n) => pick(community, n) || pick(enterprise, n))
      .filter(Boolean);

    ModuleRegistry.registerModules(toRegister);

    // Set up license if available
    if (AG_GRID_LICENSE) {
      const { LicenseManager } = enterprise;
      LicenseManager.setLicenseKey(AG_GRID_LICENSE);
    } else {
      console.warn('AG Grid Enterprise license key (VITE_AG_GRID_LICENSE_KEY) is missing.');
    }

    return true;
  } catch (error) {
    console.error('Failed to load AG Grid modules:', error);
    return false;
  }
};

export const createDefaultColDef = () => ({
  minWidth: 100,
  sortable: true,
  filter: false,
  resizable: true,
  floatingFilter: false,
  // Disable menu icon (ellipsis) on columns to prevent it appearing next to priority tags
  suppressMenuIcon: true,
  suppressHeaderMenuButton: true,
});

export const createGridOptions = (useClientSide: boolean, clientRows: any[] = [], collapseGroups: boolean = true) => ({
  ...(useClientSide ? {
    // Client-Side Row Model
    rowData: clientRows,
    getRowId: (params: any) => String(params.data.id),
    groupDisplayType: 'groupRows',
    groupDefaultExpanded: collapseGroups ? 0 : 1,
    // Allow AG Grid to handle client-side filtering when rowData is fully loaded
    suppressClientSideFiltering: false,
  } : {
    // Infinite Row Model
    rowModelType: 'infinite' as const,
    cacheBlockSize: (() => {
      try {
        const v = parseInt(localStorage.getItem('wh-cacheBlockSize') || '');
        if (Number.isFinite(v) && v >= 20 && v <= 200) return v;
      } catch {}
      return 20;
    })(),
    cacheOverflowSize: (() => {
      try {
        const v = parseInt(localStorage.getItem('wh-cacheBlockSize') || '');
        if (Number.isFinite(v) && v >= 20 && v <= 200) return Math.max(10, Math.floor(v * 0.5));
      } catch {}
      return 10;
    })(),
    infiniteInitialRowCount: 500,
    maxConcurrentDatasourceRequests: 4,
    maxBlocksInCache: 70,
    getRowId: (params: any) => String(params.data.id),
  }),
  // Default sort by created_at descending (newest first)
  sortModel: [{ colId: 'created_at', sort: 'desc' }],
  animateRows: false, // Disabled for scroll performance
  suppressColumnVirtualisation: false,
  suppressNoRowsOverlay: false,
  loading: false,
  suppressScrollOnNewData: true, // Prevent scroll jumps
  debounceVerticalScrollbar: false,
  // Disable context menu and menu icons to prevent ellipsis appearing next to priority tags
  suppressContextMenu: true,
  suppressMenuHide: true,
});
