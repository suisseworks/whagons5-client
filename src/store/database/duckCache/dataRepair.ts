import { DuckDB } from '../DuckDB';
import api from '@/api/whagonsApi';

export interface DataRepairContext {
  table: string;
  serverTable: string;
  endpoint: string;
  idField: string;
  qi: (name: string) => string;
  getLocalRowCount: () => Promise<number>;
  fetchAll: () => Promise<boolean>;
  bulkUpsert: (rows: any[]) => Promise<void>;
  bootstrapFromApi?: () => Promise<void>;
  batchFetchEndpoint?: string;
  log: (...args: any[]) => void;
  dlog: (...args: any[]) => void;
}

/**
 * Convert sorted array of IDs into continuous ranges.
 */
export function idsToRanges(ids: number[]): Array<{ start: number; end: number }> {
  if (ids.length === 0) return [];
  
  const sorted = [...ids].sort((a, b) => a - b);
  const ranges: Array<{ start: number; end: number }> = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];
  
  for (let i = 1; i < sorted.length; i++) {
    const currentId = sorted[i];
    // If current ID is consecutive, extend the range
    if (currentId === rangeEnd + 1) {
      rangeEnd = currentId;
    } else {
      // Gap found, save current range and start new one
      ranges.push({ start: rangeStart, end: rangeEnd });
      rangeStart = currentId;
      rangeEnd = currentId;
    }
  }
  // Don't forget the last range
  ranges.push({ start: rangeStart, end: rangeEnd });
  
  return ranges;
}

/**
 * Efficient repair method when row counts differ.
 * Fetches continuous ID ranges from server and compares with local ID ranges
 * to find missing/extra rows. Streams missing IDs in one request when possible.
 */
export async function repairFromIdRanges(ctx: DataRepairContext, serverRowCount: number): Promise<void> {
  if (!(await DuckDB.init())) return;

  const debugEnabled = (() => {
    try { return localStorage.getItem('wh-debug-integrity') === 'true'; } catch { return false; }
  })();

  const idCol = ctx.qi(ctx.idField);
  let localIds: number[] = [];
  try {
    const localIdsResult = await DuckDB.query(
      `SELECT CAST(${idCol} AS BIGINT) AS id FROM ${ctx.table} WHERE ${idCol} IS NOT NULL ORDER BY ${idCol}`
    );
    if (localIdsResult) {
      const arr = (localIdsResult as any).toArray?.() ?? [];
      localIds = arr.map((r: any) => Number(r.id)).filter((id: number) => Number.isFinite(id));
    }
  } catch (e: any) {
    ctx.log('repairFromIdRanges: failed to get local IDs', e);
    return;
  }

  let serverRanges: Array<{ start: number; end: number }> = [];
  let serverIdsArray: number[] = [];
  
  try {
    const rangesResp = await api.get('/integrity/id-ranges', {
      params: { table: ctx.serverTable },
    });
    serverRanges = (rangesResp.data?.data ?? rangesResp.data ?? []) as Array<{ start: number; end: number }>;
    for (const range of serverRanges) {
      for (let id = range.start; id <= range.end; id++) {
        serverIdsArray.push(id);
      }
    }
  } catch (e) {
    ctx.log('repairFromIdRanges: failed to fetch ID ranges, falling back to pagination', { error: e });
    let page = 1;
    const perPage = 1000;
    let hasMore = true;

    while (hasMore) {
      try {
        const resp = await api.get(ctx.endpoint, {
          params: {
            page,
            per_page: perPage,
            sort_by: ctx.idField,
            sort_direction: 'asc',
            fields: ctx.idField,
          },
        });
        const rows = (resp.data?.data ?? resp.data?.rows ?? resp.data) as Array<Record<string, any>>;
        if (!Array.isArray(rows)) break;

        for (const row of rows) {
          const id = Number((row as any)[ctx.idField]);
          if (Number.isFinite(id)) {
            serverIdsArray.push(id);
          }
        }

        const pagination = resp.data?.pagination;
        hasMore = pagination?.has_next_page ?? (rows.length === perPage);
        page++;

        if (serverIdsArray.length >= serverRowCount) break;
      } catch (err) {
        ctx.log('repairFromIdRanges: failed to fetch page', { page, error: err });
        break;
      }
    }
    serverRanges = idsToRanges(serverIdsArray);
  }

  const localIdsSet = new Set<number>(localIds);
  const serverIds = new Set<number>(serverIdsArray);
  const missingIds = Array.from(serverIds).filter(id => !localIdsSet.has(id));
  const extraIds = Array.from(localIdsSet).filter(id => !serverIds.has(id));

  if (extraIds.length > 0) {
    const deleteBatchSize = 1000;
    for (let i = 0; i < extraIds.length; i += deleteBatchSize) {
      const batch = extraIds.slice(i, i + deleteBatchSize);
      const idsStr = batch.map(id => String(id)).join(',');
      try {
        await DuckDB.exec(`DELETE FROM ${ctx.table} WHERE ${idCol} IN (${idsStr})`);
      } catch (e) {
        ctx.log('repairFromIdRanges: failed to delete batch', e);
      }
    }
  }

  if (missingIds.length > 0) {
    const maxIdsPerRequest = 10000;
    if (missingIds.length <= maxIdsPerRequest && ctx.batchFetchEndpoint) {
      try {
        const resp = await api.post(ctx.batchFetchEndpoint, { ids: missingIds });
        const rows = (resp.data?.data ?? []) as any[];
        if (rows && rows.length > 0) {
          await ctx.bulkUpsert(rows);
        }
      } catch (e) {
        ctx.log('repairFromIdRanges: failed to fetch all missing IDs, chunking', { error: e });
        await fetchMissingIdsInChunks(ctx, missingIds);
      }
    } else {
      await fetchMissingIdsInChunks(ctx, missingIds);
    }
  }
}

/**
 * Fetch missing IDs in chunks to avoid overwhelming the server.
 */
export async function fetchMissingIdsInChunks(ctx: DataRepairContext, missingIds: number[]): Promise<void> {
  const chunkSize = ctx.batchFetchEndpoint ? 10000 : 1000;
  let fallbackToFetchAll = false;
  
  for (let i = 0; i < missingIds.length; i += chunkSize) {
    if (fallbackToFetchAll) break;
    
    const chunk = missingIds.slice(i, i + chunkSize);
    try {
      let rows: any[] = [];
      if (ctx.batchFetchEndpoint) {
        const resp = await api.post(ctx.batchFetchEndpoint, { ids: chunk });
        rows = (resp.data?.data ?? []) as any[];
      } else {
        const resp = await api.get(ctx.endpoint, {
          params: {
            ids: chunk.join(','),
            per_page: chunk.length,
            page: 1,
          },
        });
        rows = (resp.data?.data ?? resp.data?.rows ?? []) as any[];
      }

      if (rows && rows.length > 0) {
        await ctx.bulkUpsert(rows);
      } else if (chunk.length > 0 && i === 0) {
        if (ctx.bootstrapFromApi) {
          await ctx.bootstrapFromApi();
          fallbackToFetchAll = true;
        } else {
          await ctx.fetchAll();
          fallbackToFetchAll = true;
        }
      }
    } catch (e) {
      ctx.log('fetchMissingIdsInChunks: failed to fetch chunk', { chunk: chunk.slice(0, 5), error: e });
      if (i === 0 && (e as any)?.response?.status !== 404) {
        if (ctx.bootstrapFromApi) {
          await ctx.bootstrapFromApi();
        } else {
          await ctx.fetchAll();
        }
        fallbackToFetchAll = true;
      }
    }
  }
}

