// Datasource and refresh helpers for WorkspaceTable

export function buildGetRows(TasksCache: any, refs: any) {
  const { rowCache, workspaceRef, searchRef, statusMapRef, priorityMapRef, spotMapRef, userMapRef, normalizeFilterModelForQuery } = refs;
  return async (params: any) => {
    const cacheKey = `${workspaceRef.current}-${params.startRow}-${params.endRow}-${JSON.stringify(params.filterModel || {})}-${JSON.stringify(params.sortModel || [])}-${searchRef.current}`;
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
      if (normalized.filterModel) {
        normalized.filterModel = normalizeFilterModelForQuery(normalized.filterModel);
      }
      const queryParams: any = {
        ...normalized,
        search: searchRef.current,
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


