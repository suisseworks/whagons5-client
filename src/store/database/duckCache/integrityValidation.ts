import api from '@/api/whagonsApi';
import { DuckDB } from '../DuckDB';

export interface IntegrityValidationContext {
  table: string;
  serverTable: string;
  endpoint: string;
  validating: { current: boolean };
  init: () => Promise<boolean>;
  getLocalRowCount: () => Promise<number>;
  computeLocalGlobalHash: () => Promise<string | null>;
  repairFromIdRanges: (serverRowCount: number) => Promise<void>;
  incrementalRepairFromIntegrity: () => Promise<void>;
  fetchAll?: () => Promise<boolean>;
  bootstrapFromApi?: () => Promise<void>;
  ensurePopulated?: () => Promise<void>;
  log: (...args: any[]) => void;
  dlog: (...args: any[]) => void;
  debugEnabled: () => boolean;
}

/**
 * Validate integrity by comparing local and server hashes.
 * Handles row count repair and hash-based incremental repair.
 */
export async function validateIntegrity(ctx: IntegrityValidationContext, serverGlobal?: string | null): Promise<boolean> {
  if (ctx.validating.current) {
    ctx.dlog('validate: already running, skipping re-entry');
    return true;
  }
  
  // Debug gate to disable any network activity
  try {
    if (localStorage.getItem('wh-disable-fetch') === 'true') {
      ctx.log('validate: network disabled via wh-disable-fetch; skipping integrity calls');
      ctx.validating.current = false;
      return true;
    }
  } catch {}
  
  ctx.validating.current = true;
  try {
    if (!(await ctx.init())) {
      ctx.validating.current = false;
      return false;
    }

    const debugEnabled = ctx.debugEnabled();

    // STEP 1: Fetch global hash + row_count from server FIRST
    let serverGlobalHash: string | null | undefined = serverGlobal;
    let serverRowCount: number | null = null;
    
    if (serverGlobalHash === undefined) {
      try {
        const resp = await api.get('/integrity/global', {
          params: { table: ctx.serverTable },
        });
        const data = resp.data?.data ?? resp.data;
        serverGlobalHash = (data?.global_hash ?? null) as string | null;
        serverRowCount = data?.row_count != null ? Number(data.row_count) : null;
        
        if (!serverGlobalHash) {
          ctx.log('validate: no server global_hash, ensuring local population only');
          if (ctx.ensurePopulated) {
            await ctx.ensurePopulated();
          }
          ctx.validating.current = false;
          return true;
        }
      } catch (e: any) {
        const status = e?.response?.status;
        if (status && status >= 400 && status < 500) {
          ctx.log('validate: integrity/global not available, ensuring local population', e);
          if (ctx.ensurePopulated) {
            await ctx.ensurePopulated();
          }
          ctx.validating.current = false;
          return true;
        }
        ctx.log('validate: integrity/global error, ensuring local population', e);
        if (ctx.ensurePopulated) {
          await ctx.ensurePopulated();
        }
        ctx.validating.current = false;
        return false;
      }
    } else if (serverGlobalHash === null) {
      ctx.log('validate: server global explicitly null, skipping integrity and ensuring population');
      if (ctx.ensurePopulated) {
        await ctx.ensurePopulated();
      }
      ctx.validating.current = false;
      return true;
    }

    // STEP 2: Compare row counts FIRST (before computing expensive hash)
    let localRowCount = await ctx.getLocalRowCount();

    if (
      ctx.ensurePopulated &&
      serverRowCount !== null &&
      serverRowCount > 0 &&
      localRowCount === 0
    ) {
      ctx.dlog('validate: local cache empty, ensuring population before integrity comparison');
      try {
        await ctx.ensurePopulated();
        localRowCount = await ctx.getLocalRowCount();
      } catch (populateError) {
        ctx.log('validate: ensurePopulated failed', populateError);
      }
    }

    const rowCountMatch = serverRowCount !== null && localRowCount === serverRowCount;

    // Only log row count mismatch when serverRowCount is available and doesn't match
    // Skip logging when serverRowCount is null to avoid noise
    if (!rowCountMatch && serverRowCount !== null) {
      ctx.dlog(`Row count mismatch: server=${serverRowCount}, local=${localRowCount}`);
    }

    // STEP 3: If row counts don't match, repair using ID range comparison
    if (!rowCountMatch && serverRowCount !== null) {
      const difference = Math.abs(localRowCount - serverRowCount);
      const differenceRatio = localRowCount > 0 ? difference / localRowCount : 1;
      
      if (debugEnabled) {
        console.warn(`[${ctx.serverTable}] ❌ Row count mismatch - repairing with ID ranges (NOT computing hash yet)`, {
          serverRowCount,
          localRowCount,
          difference,
          differenceRatio: (differenceRatio * 100).toFixed(1) + '%',
        });
      }
      
      // If difference is huge (>50% or >10k rows), wipe and refetch for speed
      if (differenceRatio > 0.5 || difference > 10000) {
        ctx.dlog(`HUGE mismatch (${difference} rows, ${(differenceRatio * 100).toFixed(1)}%) - wiping and refetching`);
        await DuckDB.exec(`DELETE FROM ${ctx.table}`);
        
        if (ctx.bootstrapFromApi) {
          await ctx.bootstrapFromApi();
        } else if (ctx.fetchAll) {
          await ctx.fetchAll();
        }
      } else {
        // Use ID range-based repair
        await ctx.repairFromIdRanges(serverRowCount);
      }
      
      // Re-check row count after repair
      const finalLocalRowCount = await ctx.getLocalRowCount();
      if (finalLocalRowCount !== serverRowCount) {
        console.error(`[${ctx.serverTable}] ⚠️ Row count still mismatched after repair (${finalLocalRowCount} vs ${serverRowCount}) - skipping hash computation`);
        ctx.validating.current = false;
        return false;
      }
    }

    // STEP 4: Only NOW compute local hash and compare (AFTER row count is fixed)
    const localGlobal = await ctx.computeLocalGlobalHash();
    const hashMatch = Boolean(serverGlobalHash && localGlobal && serverGlobalHash === localGlobal);

    // Only log hash mismatches, not every comparison
    if (!hashMatch) {
      ctx.dlog(`Hash mismatch: server=${(serverGlobalHash || '').slice(0, 16)}..., local=${(localGlobal || '').slice(0, 16)}...`);
      ctx.log('validate: global hash mismatch, running incremental repair', {
        serverGlobal: (serverGlobalHash || '').slice(0, 16),
        localGlobal: (localGlobal || '').slice(0, 16),
      });
    } else {
      ctx.log('validate: global hash match', { table: ctx.serverTable });
    }

    if (hashMatch) {
      ctx.validating.current = false;
      return true;
    }

    // STEP 5: If hash still mismatches after row count repair, use block-based incremental repair
    await ctx.incrementalRepairFromIntegrity();

    ctx.validating.current = false;
    return true;
  } catch (e) {
    ctx.log('validate: unexpected error', e);
    ctx.validating.current = false;
    return false;
  }
}

