import api from '@/api/whagonsApi';

export interface IncrementalRepairContext {
  table: string;
  serverTable: string;
  endpoint: string;
  idField: string;
  buildRowExprSql: () => string;
  computeLocalBlocksFromRowExpr: () => Promise<Array<{
    block_id: number;
    min_row_id: number;
    max_row_id: number;
    row_count: number;
    block_hash: string;
  }>>;
  computeLocalRowHashesInRange: (minId: number, maxId: number) => Promise<Array<{ row_id: number; row_hash: string }>>;
  bulkUpsert: (rows: any[]) => Promise<void>;
  remove: (id: number | string) => Promise<void>;
  fetchAll: () => Promise<boolean>;
  migrateSchema: () => Promise<boolean>;
  init: () => Promise<boolean>;
  log: (...args: any[]) => void;
  dlog: (...args: any[]) => void;
}

/**
 * Incremental repair using block-level hash comparison.
 * Compares local and server block hashes to identify mismatched blocks,
 * then fetches and updates only the changed rows.
 */
export async function incrementalRepairFromIntegrity(ctx: IncrementalRepairContext): Promise<void> {
  if (!(await ctx.init())) return;

  // Compute local blocks from computed row hashes
  const localBlocks = await ctx.computeLocalBlocksFromRowExpr();

  // Fetch server blocks
  let serverBlocksResp;
  let serverBlocks: Array<{ block_id: number; block_hash: string; min_row_id: number; max_row_id: number; row_count: number }> = [];
  try {
    serverBlocksResp = await api.get('/integrity/blocks', { params: { table: ctx.serverTable } });
    serverBlocks = (serverBlocksResp.data?.data ?? serverBlocksResp.data ?? []) as typeof serverBlocks;
  } catch (e: any) {
    // If integrity endpoint not available, bail (keep current data)
    const status = e?.response?.status;
    if (status && status >= 400) {
      ctx.dlog('incrementalRepairFromIntegrity: integrity endpoint not available; skipping', { table: ctx.serverTable, status });
      return;
    }
    throw e;
  }

  if (!serverBlocks || serverBlocks.length === 0) {
    return;
  }

  const localMap = new Map(localBlocks.map((b) => [b.block_id, b]));
  const mismatchedBlocks: number[] = [];
  const mismatchDetails: Array<{
    blockId: number;
    reason: string;
    local?: any;
    server?: any;
  }> = [];

  for (const sb of serverBlocks) {
    const blkId = Number((sb as any).block_id);
    if (!Number.isFinite(blkId)) continue;
    const lb = localMap.get(blkId);
    const sHash = String((sb as any).block_hash ?? '');
    const sCount = Number((sb as any).row_count ?? 0);
    const sMinId = Number((sb as any).min_row_id ?? 0);
    const sMaxId = Number((sb as any).max_row_id ?? 0);
    
    if (!lb) {
      mismatchedBlocks.push(blkId);
      mismatchDetails.push({
        blockId: blkId,
        reason: 'missing_local',
        server: { block_hash: sHash, row_count: sCount, min_row_id: sMinId, max_row_id: sMaxId },
      });
    } else if (!lb.block_hash) {
      mismatchedBlocks.push(blkId);
      mismatchDetails.push({
        blockId: blkId,
        reason: 'no_local_hash',
        local: { block_hash: null, row_count: lb.row_count },
        server: { block_hash: sHash, row_count: sCount },
      });
    } else if (lb.block_hash !== sHash) {
      mismatchedBlocks.push(blkId);
      mismatchDetails.push({
        blockId: blkId,
        reason: 'hash_mismatch',
        local: {
          block_hash: lb.block_hash,
          row_count: lb.row_count,
          min_row_id: lb.min_row_id,
          max_row_id: lb.max_row_id,
        },
        server: {
          block_hash: sHash,
          row_count: sCount,
          min_row_id: sMinId,
          max_row_id: sMaxId,
        },
      });
    } else if (lb.row_count !== sCount) {
      mismatchedBlocks.push(blkId);
      mismatchDetails.push({
        blockId: blkId,
        reason: 'count_mismatch',
        local: { row_count: lb.row_count, block_hash: lb.block_hash },
        server: { row_count: sCount, block_hash: sHash },
      });
    }
  }
  // Also consider local blocks that the server no longer has
  const serverBlockIds = new Set(serverBlocks.map((sb: any) => Number(sb.block_id)).filter((n) => Number.isFinite(n)));
  for (const lb of localBlocks) {
    if (!serverBlockIds.has(lb.block_id)) {
      mismatchedBlocks.push(lb.block_id);
      mismatchDetails.push({
        blockId: lb.block_id,
        reason: 'missing_server',
        local: {
          block_hash: lb.block_hash,
          row_count: lb.row_count,
          min_row_id: lb.min_row_id,
          max_row_id: lb.max_row_id,
        },
      });
    }
  }

  if (!mismatchedBlocks.length) {
    if (serverBlocks.length > 0) {
      const firstBlock = serverBlocks[0];
      const blockId = Number((firstBlock as any).block_id);
      if (Number.isFinite(blockId)) {
        const minId = Number((firstBlock as any).min_row_id ?? blockId * 1024);
        const maxId = Number((firstBlock as any).max_row_id ?? (blockId + 1) * 1024 - 1);
        
        const serverRowsResp = await api.get(`/integrity/blocks/${blockId}/rows`, {
          params: { table: ctx.serverTable },
        });
        const serverRows: Array<{ row_id: number; row_hash: string }> =
          (serverRowsResp.data?.data ?? serverRowsResp.data ?? []) as any[];
        const serverRowMap = new Map<number, string>();
        for (const r of serverRows) {
          const id = Number((r as any).row_id);
          const h = (r as any).row_hash;
          if (!Number.isFinite(id) || !h) continue;
          serverRowMap.set(id, String(h));
        }

        const localRows = await ctx.computeLocalRowHashesInRange(minId, maxId);
        const localRowMap = new Map<number, string>();
        for (const r of localRows) {
          const id = Number((r as any).row_id);
          const h = (r as any).row_hash;
          if (!Number.isFinite(id)) continue;
          localRowMap.set(id, h ? String(h) : '');
        }

        const rowMismatches: number[] = [];
        for (const [rowId, localHash] of localRowMap.entries()) {
          const sh = serverRowMap.get(rowId);
          if (sh && localHash && sh !== localHash) {
            rowMismatches.push(rowId);
          }
        }
        
        if (rowMismatches.length > 0) {
          mismatchedBlocks.push(...serverBlocks.map((b: any) => Number(b.block_id)).filter((id: number) => Number.isFinite(id)));
        } else {
          return;
        }
      } else {
        return;
      }
    } else {
      return;
    }
  }

  const uniqueBlocks = Array.from(new Set(mismatchedBlocks));
  for (const blockId of uniqueBlocks) {
    const sb = serverBlocks.find((b: any) => Number(b.block_id) === Number(blockId));
    let minId: number;
    let maxId: number;
    if (sb && Number.isFinite(Number((sb as any).min_row_id))) {
      minId = Number((sb as any).min_row_id);
      maxId = Number((sb as any).max_row_id);
    } else {
      const BLOCK_SIZE = 1024;
      const base = blockId * BLOCK_SIZE;
      minId = base;
      maxId = base + BLOCK_SIZE - 1;
    }

    let serverRows: Array<{ row_id: number; row_hash: string }> = [];
    try {
      const serverRowsResp = await api.get(`/integrity/blocks/${blockId}/rows`, {
        params: { table: ctx.serverTable },
      });
      serverRows = (serverRowsResp.data?.data ?? serverRowsResp.data ?? []) as any[];
    } catch (e: any) {
      if (e?.response?.status !== 404) {
        ctx.log('incrementalRepairFromIntegrity: failed to fetch server rows for block', { blockId, error: e });
      }
    }
    const serverRowMap = new Map<number, string>();
    for (const r of serverRows) {
      const id = Number((r as any).row_id);
      const h = (r as any).row_hash;
      if (!Number.isFinite(id) || !h) continue;
      serverRowMap.set(id, String(h));
    }

    const localRows = await ctx.computeLocalRowHashesInRange(minId, maxId);
    const localRowMap = new Map<number, string>();
    for (const r of localRows) {
      const id = Number((r as any).row_id);
      const h = (r as any).row_hash;
      if (!Number.isFinite(id)) continue;
      localRowMap.set(id, h ? String(h) : '');
    }

    const toRefetch: number[] = [];
    for (const [rowId, localHash] of localRowMap.entries()) {
      const sh = serverRowMap.get(rowId);
      if (!sh || !localHash || sh !== localHash) {
        toRefetch.push(rowId);
      }
    }
    for (const [rowId] of serverRowMap.entries()) {
      if (!localRowMap.has(rowId)) {
        toRefetch.push(rowId);
      }
    }

    if (toRefetch.length > 0) {
      const chunk = 1000;
      const fetchedIds = new Set<number>();
      for (let i = 0; i < toRefetch.length; i += chunk) {
        const ids = toRefetch.slice(i, i + chunk);
        try {
          const resp = await api.get(ctx.endpoint, {
            params: {
              ids: ids.join(','),
              per_page: ids.length,
              page: 1,
            },
          });
          const rows = (resp.data?.data ?? resp.data?.rows ?? []) as Array<Record<string, any>>;
          if (rows && rows.length) {
            for (const r of rows) {
              const idNum = Number((r as any)[ctx.idField]);
              if (Number.isFinite(idNum)) fetchedIds.add(idNum);
            }
            await ctx.bulkUpsert(rows as any[]);
          } else {
            const idsSet = new Set(ids.map((id) => Number(id)));
            const hasServerRowsForIds = Array.from(idsSet).some((id) => serverRowMap.has(id));
            if (!hasServerRowsForIds) {
              // Rows deleted on server
            } else {
              // Fallback to full fetch - this shouldn't happen often
              const fetchAllResp = await api.get(ctx.endpoint);
              const allRows = (fetchAllResp.data?.data ?? fetchAllResp.data?.rows ?? []) as Array<Record<string, any>>;
              if (allRows && allRows.length) {
                await ctx.bulkUpsert(allRows as any[]);
              }
              for (const id of serverRowMap.keys()) fetchedIds.add(id);
              break;
            }
          }
        } catch (e) {
          ctx.dlog('incrementalRepairFromIntegrity: batch ids fetch failed', e);
        }
      }

      const serverIds = new Set<number>(Array.from(serverRowMap.keys()));
      for (const localId of Array.from(localRowMap.keys())) {
        if (!serverIds.has(localId)) {
          await ctx.remove(localId);
        }
      }
    }
  }
}

