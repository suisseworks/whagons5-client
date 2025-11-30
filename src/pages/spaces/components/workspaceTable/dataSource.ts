// Datasource and refresh helpers for WorkspaceTable

import { DuckTaskCache } from '@/store/database/DuckTaskCache';

export function buildGetRows(refs: any) {
  const { rowCache, workspaceRef, searchRef, statusMapRef, priorityMapRef, spotMapRef, userMapRef, tagMapRef, taskTagsRef, externalFilterModelRef, normalizeFilterModelForQuery, apiRef } = refs;
  // Lightweight adaptive tuner: adjusts cacheBlockSize based on recent getRows durations
  let recentDurations: number[] = [];
  let lastAdjustTs = 0;
  let currentBlockSize: number | null = null;
  const MIN_BLOCK = 20;
  const MAX_BLOCK = 200;
  const TARGET_MS = 16; // aim for <= 16ms work per getRows
  const SAMPLE_COUNT = 10;

  const maybeTune = (dtMs: number, params: any) => {
    try {
      recentDurations.push(dtMs);
      if (recentDurations.length < SAMPLE_COUNT) return;
      const now = performance.now();
      if (now - lastAdjustTs < 3000) {
        // throttle adjustments to at most once per 3s
        recentDurations = [];
        return;
      }
      const avg = recentDurations.reduce((a, b) => a + b, 0) / recentDurations.length;
      recentDurations = [];
      // Initialize current block size from first request size if unknown
      if (currentBlockSize == null) {
        const size = Math.max(1, parseInt(params.endRow) - parseInt(params.startRow));
        currentBlockSize = Number.isFinite(size) ? size : MIN_BLOCK;
      }
      let next = currentBlockSize;
      if (avg > TARGET_MS && currentBlockSize > MIN_BLOCK) {
        // Too slow: shrink by 25%
        next = Math.max(MIN_BLOCK, Math.floor(currentBlockSize * 0.75));
      } else if (avg < TARGET_MS * 0.5 && currentBlockSize < MAX_BLOCK) {
        // Plenty fast: grow by 50%
        next = Math.min(MAX_BLOCK, Math.max(currentBlockSize + 10, Math.floor(currentBlockSize * 1.5)));
      }
      if (next !== currentBlockSize) {
        currentBlockSize = next;
        // Persist suggested size; applied on next init/refresh, not during active scroll
        try {
          localStorage.setItem('wh-cacheBlockSize', String(currentBlockSize));
          if (localStorage.getItem('wh-debug-filters') === 'true') {
            console.log('[WT getRows] tuner suggested cacheBlockSize=', currentBlockSize);
          }
        } catch {}
        lastAdjustTs = now;
      }
    } catch {
      // ignore tuner errors
    }
  };

  const shouldUseDuckDBTasks = (): boolean => {
    try {
      return localStorage.getItem('wh-use-duckdb-tasks') === 'true';
    } catch {
      return false;
    }
  };
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
      const t0 = performance.now();
      await DuckTaskCache.init();
      const normalized: any = { ...params };

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

      const externalFm = (externalFilterModelRef?.current as any) || {};
      const hasExternal = externalFm && Object.keys(externalFm).length > 0;
      const hasGrid = Object.keys(cleanedGridFm).length > 0;

      // Prefer the grid's current model when present; fall back to the last
      // external model (e.g. from presets) when gridFm is empty.
      let mergedFm: any = {};
      if (hasGrid) {
        mergedFm = cleanedGridFm;
      } else if (hasExternal) {
        mergedFm = externalFm;
      }

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
      queryParams.__tagMap = tagMapRef.current;
      queryParams.__taskTags = taskTagsRef.current;

      const duckParams = {
        workspace_id: workspaceRef.current !== 'all' ? workspaceRef.current : undefined,
        search: searchRef.current,
        startRow: normalized.startRow,
        endRow: normalized.endRow,
        sortModel,
      };
      const duckResult = await DuckTaskCache.queryForAgGrid(duckParams);
      const rows: any[] = duckResult.rows || [];
      const total: number = duckResult.rowCount || 0;
      try { if (localStorage.getItem('wh-debug-filters') === 'true') console.log('[WT getRows] result rows=', rows.length, 'total=', total); } catch {}
      rowCache.current.set(cacheKey, { rows, rowCount: total });
      params.successCallback(rows, total);
      const dt = performance.now() - t0;
      maybeTune(dt, params);
    } catch (error) {
      console.error('Error querying local tasks cache:', error);
      params.failCallback();
    }
  };
}

export async function refreshClientSideGrid(gridApi: any, _unused: any, params: any) {
  const { search, workspaceRef, statusMapRef, priorityMapRef, spotMapRef, userMapRef, tagMapRef, taskTagsRef } = params;
  const baseParams: any = { search };
  if (workspaceRef.current !== 'all') baseParams.workspace_id = workspaceRef.current;
  baseParams.__statusMap = statusMapRef.current;
  baseParams.__priorityMap = priorityMapRef.current;
  baseParams.__spotMap = spotMapRef.current;
  baseParams.__userMap = userMapRef.current;
  baseParams.__tagMap = tagMapRef.current;
  baseParams.__taskTags = taskTagsRef.current;

  await DuckTaskCache.init();
  const countResp = await DuckTaskCache.queryForAgGrid({ ...baseParams, startRow: 0, endRow: 0 });
  const totalFiltered = countResp?.rowCount ?? 0;
  const rowsResp = await DuckTaskCache.queryForAgGrid({ ...baseParams, startRow: 0, endRow: totalFiltered });
  const rows = rowsResp?.rows || [];
  gridApi.setGridOption('rowData', rows);
  return rows;
}


