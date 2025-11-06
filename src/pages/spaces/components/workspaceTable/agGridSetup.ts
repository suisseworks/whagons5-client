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
});

export const createGridOptions = (useClientSide: boolean, clientRows: any[] = [], collapseGroups: boolean = true) => ({
  ...(useClientSide ? {
    // Client-Side Row Model
    rowData: clientRows,
    getRowId: (params: any) => String(params.data.id),
    groupDisplayType: 'groupRows',
    groupDefaultExpanded: collapseGroups ? 0 : 1,
  } : {
    // Infinite Row Model
    rowModelType: 'infinite' as const,
    cacheBlockSize: 500,
    maxConcurrentDatasourceRequests: 1,
    maxBlocksInCache: 10,
    getRowId: (params: any) => String(params.data.id),
  }),
  // Default sort by created_at descending (newest first)
  sortModel: [{ colId: 'created_at', sort: 'desc' }],
  animateRows: true,
  suppressColumnVirtualisation: true,
  suppressNoRowsOverlay: false,
  loading: false,
});
