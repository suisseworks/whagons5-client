// Datasource and refresh helpers for WorkspaceTable

export function buildGetRows(TasksCache: any, refs: any) {
  const { rowCache, workspaceRef, searchRef, statusMapRef, priorityMapRef, spotMapRef, userMapRef, externalFilterModelRef, normalizeFilterModelForQuery } = refs;
  return async (params: any) => {
   // Default sortModel to created_at desc if not provided
    const sortModel = params.sortModel && params.sortModel.length > 0 
      ? params.sortModel 
      : [{ colId: 'created_at', sort: 'desc' }];
    
    const cacheKey = `${workspaceRef.current}-${params.startRow}-${params.endRow}-${JSON.stringify(params.filterModel || {})}-${JSON.stringify(sortModel)}-${searchRef.current}`;
    if (rowCache.current.has(cacheKey)) {
      const cachedData = rowCache.current.get(cacheKey)!;
      params.successCallback(cachedData.rows, cachedData.rowCount);
      return;
    }
    try {
      if (!TasksCache.initialized) {
        await TasksCache.init();
      }
      const normalized: any = { ...params };
      // Read persisted model as a fallback (ensures we filter even when grid omits params.filterModel)
      let persisted: any = {};
      try {
        const key = `wh_workspace_filters_${workspaceRef.current || 'all'}`;
        const raw = localStorage.getItem(key);
        if (raw) persisted = JSON.parse(raw) || {};
      } catch {}
      // Merge filters: persisted -> external -> grid (but ignore grid filters with empty values)
      // AG Grid returns empty values array for set filters when "show all" is selected
      const gridFm = params?.filterModel || {};
      const cleanedGridFm: any = {};
      for (const [key, value] of Object.entries(gridFm)) {
        // For set filters, empty values array means "show all" - ignore it
        if (value && typeof value === 'object' && (value as any).filterType === 'set') {
          const values = (value as any).values || [];
          if (values.length > 0) {
            cleanedGridFm[key] = value;
          }
        } else {
          // For other filter types, include them
          cleanedGridFm[key] = value;
        }
      }
      
      // Merge: persisted -> external -> cleaned grid (grid overrides only if it has actual filter values)
      const mergedFm = { ...(persisted || {}), ...(externalFilterModelRef?.current || {}), ...cleanedGridFm };
      normalized.filterModel = Object.keys(mergedFm).length > 0 ? normalizeFilterModelForQuery(mergedFm) : undefined;
      try {
        if (localStorage.getItem('wh-debug-filters') === 'true') {
          console.log('[WT getRows] merged filter=', JSON.stringify(mergedFm, null, 2));
          console.log('[WT getRows] normalized filterModel=', JSON.stringify(normalized.filterModel, null, 2));
          console.log('[WT getRows] search=', searchRef.current, 'ws=', workspaceRef.current);
        }
      } catch {}
      const queryParams: any = {
        ...normalized,
        search: searchRef.current,
        sortModel: sortModel, // Always include sortModel, defaulting to created_at desc
      };
      if (workspaceRef.current !== 'all') {
        queryParams.workspace_id = workspaceRef.current;
      }
      queryParams.__statusMap = statusMapRef.current;
      queryParams.__priorityMap = priorityMapRef.current;
      queryParams.__spotMap = spotMapRef.current;
      queryParams.__userMap = userMapRef.current;

      const result = await TasksCache.queryTasks(queryParams);
      const rows = result?.rows || [];
      const total = result?.rowCount || 0;
      try { if (localStorage.getItem('wh-debug-filters') === 'true') console.log('[WT getRows] result rows=', rows.length, 'total=', total); } catch {}
      rowCache.current.set(cacheKey, { rows, rowCount: total });
      params.successCallback(rows, total);
    } catch (error) {
      console.error('Error querying local tasks cache:', error);
      params.failCallback();
    }
  };
}

export async function refreshClientSideGrid(gridApi: any, TasksCache: any, params: any) {
  const { search, workspaceRef, statusMapRef, priorityMapRef, spotMapRef, userMapRef } = params;
  const baseParams: any = { search };
  if (workspaceRef.current !== 'all') baseParams.workspace_id = workspaceRef.current;
  baseParams.__statusMap = statusMapRef.current;
  baseParams.__priorityMap = priorityMapRef.current;
  baseParams.__spotMap = spotMapRef.current;
  baseParams.__userMap = userMapRef.current;

  const countResp = await TasksCache.queryTasks({ ...baseParams, startRow: 0, endRow: 0 });
  const totalFiltered = countResp?.rowCount ?? 0;
  const rowsResp = await TasksCache.queryTasks({ ...baseParams, startRow: 0, endRow: totalFiltered });
  const rows = rowsResp?.rows || [];
  gridApi.setGridOption('rowData', rows);
  return rows;
}


