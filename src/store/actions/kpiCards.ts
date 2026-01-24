import { createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '@/api/whagonsApi';
import { genericCaches, genericInternalActions } from '@/store/genericSlices';
import { syncReduxForTable } from '@/store/indexedDB/CacheRegistry';

type ReorderCard = { id: number; position: number };

/**
 * Reorder KPI cards (batch endpoint) and eagerly sync local caches + Redux.
 *
 * UI should dispatch this instead of calling `api` directly.
 */
export const reorderKpiCardsAsync = createAsyncThunk<void, { cards: ReorderCard[] }, { state: any }>(
  'kpiCards/reorderKpiCardsAsync',
  async ({ cards }, { dispatch, getState }) => {
    const prev = ((getState() as any)?.kpiCards?.value ?? []) as any[];

    // Optimistic update in Redux immediately
    for (const c of cards) {
      dispatch((genericInternalActions as any).kpiCards.updateItem({ id: c.id, position: c.position }));
    }

    try {
      await api.post('/kpi-cards/reorder', { cards });

      // Update IndexedDB with new positions (best-effort)
      await Promise.all(
        cards.map(async ({ id, position }) => {
          const existing = prev.find((r) => Number((r as any)?.id) === Number(id));
          if (!existing) return;
          await genericCaches.kpiCards.update(id, { ...(existing as any), position });
        })
      );

      // Ensure Redux re-reads from IndexedDB (keeps parity with realtime + other flows)
      await syncReduxForTable('wh_kpi_cards');
    } catch (error) {
      // Rollback optimistic update in Redux
      dispatch((genericInternalActions as any).kpiCards.setLoading(false));
      for (const row of prev) {
        if (row?.id == null) continue;
        dispatch((genericInternalActions as any).kpiCards.updateItem(row));
      }
      throw error;
    }
  }
);

