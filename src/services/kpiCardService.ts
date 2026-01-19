import { TasksCache } from '@/store/indexedDB/TasksCache';

export interface KpiCard {
  id: number;
  name: string;
  type: 'task_count' | 'task_percentage' | 'custom_query' | 'trend' | 'external';
  query_config: any;
  display_config: any;
  workspace_id?: number | null;
  user_id?: number | null;
  position: number;
  is_enabled: boolean;
}

export interface KpiResult {
  value: string | number;
  trend?: number[];
  raw?: any;
}

/**
 * Execute a KPI card query against TasksCache
 */
export async function executeKpiQuery(
  card: KpiCard,
  workspaceId: string | undefined
): Promise<KpiResult> {
  try {
    if (!TasksCache.initialized) {
      await TasksCache.init();
    }

    const baseQuery: any = {};
    
    // Add workspace filter if specified
    if (workspaceId && workspaceId !== 'all') {
      baseQuery.workspace_id = workspaceId;
    }

    // Merge with card query config filters
    const filters = card.query_config?.filters || {};
    const query = { ...baseQuery, ...filters, startRow: 0, endRow: 0 };

    switch (card.type) {
      case 'task_count': {
        const result = await TasksCache.queryTasks(query);
        return {
          value: result?.rowCount ?? 0,
          raw: result,
        };
      }

      case 'task_percentage': {
        // Get numerator count
        const numeratorFilters = card.query_config?.numerator_filters || {};
        const numeratorQuery = { ...baseQuery, ...numeratorFilters, startRow: 0, endRow: 0 };
        const numeratorResult = await TasksCache.queryTasks(numeratorQuery);
        const numerator = numeratorResult?.rowCount ?? 0;

        // Get denominator count
        const denominatorFilters = card.query_config?.denominator_filters || {};
        const denominatorQuery = { ...baseQuery, ...denominatorFilters, startRow: 0, endRow: 0 };
        const denominatorResult = await TasksCache.queryTasks(denominatorQuery);
        const denominator = denominatorResult?.rowCount ?? 1; // Avoid division by zero

        const percentage = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
        
        return {
          value: `${percentage}%`,
          raw: { numerator, denominator, percentage },
        };
      }

      case 'trend': {
        const days = card.query_config?.days || 7;
        const trend = await calculateTrend(card, workspaceId, days);
        const total = trend.reduce((sum, val) => sum + val, 0);
        
        return {
          value: total,
          trend,
        };
      }

      case 'custom_query': {
        // Execute custom query directly
        const result = await TasksCache.queryTasks(query);
        return {
          value: result?.rowCount ?? 0,
          raw: result,
        };
      }

      default:
        return { value: 0 };
    }
  } catch (error) {
    console.error('[KpiCardService] Error executing query:', error);
    return { value: 0 };
  }
}

/**
 * Calculate trend data for a KPI card over N days
 */
export async function calculateTrend(
  card: KpiCard,
  workspaceId: string | undefined,
  days: number = 7
): Promise<number[]> {
  try {
    if (!TasksCache.initialized) {
      await TasksCache.init();
    }

    const baseQuery: any = {};
    
    // Add workspace filter
    if (workspaceId && workspaceId !== 'all') {
      baseQuery.workspace_id = workspaceId;
    }

    // Merge with card filters
    const filters = card.query_config?.filters || {};
    const groupBy = card.query_config?.group_by || 'updated_at';

    // Calculate date range
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const startDate = new Date(midnight);
    startDate.setDate(startDate.getDate() - (days - 1));

    // Query tasks in date range
    const query = { ...baseQuery, ...filters, updated_after: startDate.toISOString() };
    const result = await TasksCache.queryTasks(query);
    const rows: any[] = (result as any)?.rows ?? [];

    // Group by day
    const trend: number[] = Array.from({ length: days }, (_, idx) => {
      const dayStart = new Date(startDate);
      dayStart.setDate(dayStart.getDate() + idx);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      return rows.filter((task: any) => {
        const taskDate = new Date(task[groupBy]);
        return taskDate >= dayStart && taskDate < dayEnd;
      }).length;
    });

    return trend;
  } catch (error) {
    console.error('[KpiCardService] Error calculating trend:', error);
    return Array(days).fill(0);
  }
}

/**
 * Format KPI value based on display configuration
 */
export function formatKpiValue(result: KpiResult, format?: string): string {
  if (format === 'percentage' && typeof result.value === 'number') {
    return `${result.value}%`;
  }
  
  if (typeof result.value === 'number') {
    return result.value.toLocaleString();
  }
  
  return String(result.value);
}
