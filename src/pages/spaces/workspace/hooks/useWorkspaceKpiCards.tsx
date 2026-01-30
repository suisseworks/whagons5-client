import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { TasksCache } from '@/store/indexedDB/TasksCache';
import { BarChart3, Activity, TrendingUp } from 'lucide-react';
import { useLanguage } from '@/providers/LanguageProvider';
import { WorkspaceStats } from './useWorkspaceStats';
import { TaskEvents } from '@/store/eventEmiters/taskEvents';

type KpiCardEntity = {
  id: number;
  user_id?: number | null;
  workspace_id?: number | null;
  name: string;
  type: string;
  query_config: any;
  display_config: any;
  position: number;
  is_enabled: boolean;
};

export type WorkspaceHeaderCard = {
  id: number;
  label: string;
  value: string;
  icon: ReactNode;
  accent: 'indigo' | 'amber' | 'emerald' | 'purple';
  sparkline?: ReactNode;
  helperText?: string;
};

type TrendSparklineProps = {
  data: number[];
  className?: string;
};

const TrendSparkline = ({ data, className }: TrendSparklineProps) => {
  if (!data || data.length === 0) {
    return <div className="text-xs text-muted-foreground">—</div>;
  }
  const width = 100;
  const height = 40;
  const max = Math.max(...data, 1);
  const points = data
    .map((val, idx) => {
      const x = data.length === 1 ? width / 2 : (idx / Math.max(data.length - 1, 1)) * width;
      const y = height - (val / max) * height;
      return `${x},${y}`;
    })
    .join(' ');
  const lastX = data.length === 1 ? width / 2 : width;
  const lastY = height - (data[data.length - 1] / max) * height;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`w-full h-10 ${className || 'text-sky-600'}`}
      role="img"
      aria-label="7 day completion trend"
    >
      <polyline fill="none" stroke="currentColor" strokeWidth="2.4" points={points} strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="2.6" fill="currentColor" />
    </svg>
  );
};

export function useWorkspaceKpiCards(params: {
  workspaceIdNum: number | null;
  currentUserId: number;
  doneStatusId: number | undefined;
  stats: WorkspaceStats;
}): {
  headerKpiCards: KpiCardEntity[];
  setHeaderKpiCards: (cards: KpiCardEntity[]) => void;
  headerCards: WorkspaceHeaderCard[];
  canReorderHeaderKpis: boolean;
} {
  const { workspaceIdNum, currentUserId, doneStatusId, stats } = params;
  const { t } = useLanguage();

  const allKpiCardsFromRedux = useSelector((s: RootState) => ((s as any).kpiCards?.value ?? []) as KpiCardEntity[]);

  const scopedKpiCardsFromStore = useMemo(() => {
    return (allKpiCardsFromRedux || [])
      .filter((c) => c && typeof c.id === 'number')
      .filter((c) => c.is_enabled !== false)
      .filter((c) => {
        if (workspaceIdNum == null) return c.workspace_id == null;
        return c.workspace_id == null || Number(c.workspace_id) === workspaceIdNum;
      })
      .filter((c) => {
        if (!Number.isFinite(currentUserId)) return c.user_id == null;
        return c.user_id == null || Number(c.user_id) === currentUserId;
      })
      .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
  }, [allKpiCardsFromRedux, workspaceIdNum, currentUserId]);

  const [headerKpiCards, setHeaderKpiCards] = useState<KpiCardEntity[]>([]);

  useEffect(() => {
    setHeaderKpiCards(scopedKpiCardsFromStore);
  }, [scopedKpiCardsFromStore]);

  const statsArePending = stats.loading && stats.total === 0 && stats.inProgress === 0 && stats.completedToday === 0;
  const completedLast7Days = stats.trend.reduce((sum, val) => sum + val, 0);
  const trendDelta = stats.trend.length >= 2 ? stats.trend[stats.trend.length - 1] - stats.trend[stats.trend.length - 2] : 0;

  const normalizeDisplayConfig = (input: any): any => {
    if (!input) return {};
    if (typeof input === 'string') {
      try {
        return JSON.parse(input);
      } catch {
        return {};
      }
    }
    return input;
  };

  const inferAccent = (displayConfigInput: any, cardId?: number): WorkspaceHeaderCard['accent'] => {
    const displayConfig = normalizeDisplayConfig(displayConfigInput);
    const c = String(displayConfig?.color || displayConfig?.badgeClass || displayConfig?.barClass || '').toLowerCase();
    if (c.includes('amber') || c.includes('orange') || c.includes('yellow')) return 'amber';
    if (c.includes('emerald') || c.includes('green')) return 'emerald';
    if (c.includes('indigo') || c.includes('blue') || c.includes('sky') || c.includes('cyan')) return 'indigo';
    if (c.includes('purple') || c.includes('violet')) return 'purple';

    const palette: WorkspaceHeaderCard['accent'][] = ['indigo', 'amber', 'emerald', 'purple'];
    if (typeof cardId === 'number' && Number.isFinite(cardId)) {
      return palette[Math.abs(cardId) % palette.length];
    }
    return 'indigo';
  };

  const getDefaultLabel = (defaultKey?: string) => {
    switch (defaultKey) {
      case 'total':
        return t('workspace.stats.total', 'Total');
      case 'inProgress':
        return t('workspace.stats.inProgress', 'In progress');
      case 'completedToday':
        return t('workspace.stats.completedToday', 'Completed today');
      case 'trend':
        return t('workspace.stats.sevenDayTrend', '7-day trend');
      default:
        return t('workspace.stats.total', 'Total');
    }
  };

  const formatStatValue = (value: number) => (statsArePending ? '—' : value.toLocaleString());

  const getDefaultCardData = (defaultKey?: string): Omit<WorkspaceHeaderCard, 'id'> => {
    switch (defaultKey) {
      case 'inProgress':
        return {
          label: getDefaultLabel(defaultKey),
          value: formatStatValue(stats.inProgress),
          icon: <Activity className="h-5 w-5" />,
          accent: 'amber',
        };
      case 'completedToday':
        return {
          label: getDefaultLabel(defaultKey),
          value: formatStatValue(stats.completedToday),
          icon: <BarChart3 className="h-5 w-5" />,
          accent: 'emerald',
          helperText:
            stats.completedToday === 0 && !statsArePending
              ? t('workspace.stats.startCompleting', 'Start completing tasks to see progress!')
              : undefined,
        };
      case 'trend':
        return {
          label: getDefaultLabel(defaultKey),
          value: statsArePending ? '—' : `${completedLast7Days.toLocaleString()} ${t('workspace.stats.done', 'done')}`,
          icon: <TrendingUp className="h-5 w-5" />,
          accent: 'purple',
          sparkline: <TrendSparkline data={stats.trend} className="text-purple-600" />,
          helperText: statsArePending
            ? ''
            : completedLast7Days === 0
              ? t('workspace.stats.completeFirst', 'Complete your first task to begin tracking progress!')
              : `${trendDelta >= 0 ? '+' : ''}${trendDelta} ${t('workspace.stats.vsYesterday', 'vs yesterday')}`,
        };
      case 'total':
      default:
        return {
          label: getDefaultLabel(defaultKey),
          value: formatStatValue(stats.total),
          icon: <BarChart3 className="h-5 w-5" />,
          accent: 'indigo',
        };
    }
  };

  const defaultComputed = useMemo(() => {
    const m = new Map<number, Omit<WorkspaceHeaderCard, 'id'>>();
    for (const card of headerKpiCards) {
      if (!card?.query_config?.is_default) continue;
      const defaultKey = card.query_config?.default_key as string | undefined;
      m.set(card.id, getDefaultCardData(defaultKey));
    }
    return m;
  }, [
    headerKpiCards,
    stats.total,
    stats.inProgress,
    stats.completedToday,
    stats.trend.join(','),
    stats.loading,
    statsArePending,
    completedLast7Days,
    trendDelta,
    t,
  ]);

  const [customComputed, setCustomComputed] = useState<Map<number, Omit<WorkspaceHeaderCard, 'id'>>>(new Map());
  const [tasksRefreshKey, setTasksRefreshKey] = useState(0);

  useEffect(() => {
    const bump = () => setTasksRefreshKey((prev) => prev + 1);
    const unsubscribers = [
      TaskEvents.on(TaskEvents.EVENTS.TASK_CREATED, bump),
      TaskEvents.on(TaskEvents.EVENTS.TASK_UPDATED, bump),
      TaskEvents.on(TaskEvents.EVENTS.TASK_DELETED, bump),
      TaskEvents.on(TaskEvents.EVENTS.TASKS_BULK_UPDATE, bump),
      TaskEvents.on(TaskEvents.EVENTS.CACHE_INVALIDATE, bump),
    ];
    return () => {
      unsubscribers.forEach((u) => u());
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const toFirstId = (v: any) => {
      if (Array.isArray(v) && v.length > 0) return Number(v[0]);
      return Number(v);
    };

    const buildTaskQuery = (config: any) => {
      const base: any = {};
      if (workspaceIdNum != null) base.workspace_id = workspaceIdNum;
      const filters = config?.filters ?? config ?? {};
      const q: any = { ...base };
      if (filters?.status_id != null) {
        const sid = toFirstId(filters.status_id);
        if (Number.isFinite(sid)) q.status_id = sid;
      }
      if (filters?.priority_id != null) {
        const pid = toFirstId(filters.priority_id);
        if (Number.isFinite(pid)) q.priority_id = pid;
      }
      if (filters?.spot_id != null) {
        const spid = toFirstId(filters.spot_id);
        if (Number.isFinite(spid)) q.spot_id = spid;
      }
      return q;
    };

    const compute = async () => {
      try {
        if (!TasksCache.initialized) await TasksCache.init();

        const next = new Map<number, Omit<WorkspaceHeaderCard, 'id'>>();
        for (const card of headerKpiCards) {
          if (!card || card.is_enabled === false) continue;
          if (card.query_config?.is_default) continue;

          const display = normalizeDisplayConfig(card.display_config);
          const accent = inferAccent(display, card.id);
          const helperText = display?.helperText ? String(display.helperText) : undefined;

          if (card.type === 'task_count') {
            const q = buildTaskQuery(card.query_config?.filters);
            const r = await TasksCache.queryTasks({ ...q, startRow: 0, endRow: 0 });
            const count = Number((r as any)?.rowCount ?? 0);
            next.set(card.id, {
              label: card.name,
              value: statsArePending ? '—' : count.toLocaleString(),
              icon: <BarChart3 className="h-5 w-5" />,
              accent,
              helperText,
            });
          } else if (card.type === 'task_percentage') {
            const numQ = buildTaskQuery(card.query_config?.numerator_filters);
            const denQ = buildTaskQuery(card.query_config?.denominator_filters);
            const [numR, denR] = await Promise.all([
              TasksCache.queryTasks({ ...numQ, startRow: 0, endRow: 0 }),
              TasksCache.queryTasks({ ...denQ, startRow: 0, endRow: 0 }),
            ]);
            const numerator = Number((numR as any)?.rowCount ?? 0);
            const denominator = Number((denR as any)?.rowCount ?? 0);
            const pct = denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
            next.set(card.id, {
              label: card.name,
              value: statsArePending ? '—' : `${pct.toLocaleString()}%`,
              icon: <Activity className="h-5 w-5" />,
              accent,
              helperText:
                helperText ?? (denominator === 0 ? t('kpiCards.noDenominator', 'No data to compare') : undefined),
            });
          } else if (card.type === 'trend') {
            const days = Math.max(3, Math.min(30, Number(card.query_config?.days ?? 7) || 7));
            if (doneStatusId == null) {
              next.set(card.id, {
                label: card.name,
                value: '—',
                icon: <TrendingUp className="h-5 w-5" />,
                accent,
                helperText: helperText ?? t('workspace.stats.noDoneStatus', 'No "done" status configured'),
              });
              continue;
            }
            const midnight = new Date();
            midnight.setHours(0, 0, 0, 0);
            const start = new Date(midnight);
            start.setDate(start.getDate() - (days - 1));
            const q = buildTaskQuery(card.query_config?.filters);
            const trendResp = await TasksCache.queryTasks({ ...q, updated_after: start.toISOString() });
            const rows: any[] = (trendResp as any)?.rows ?? [];
            const series = Array.from({ length: days }, (_, idx) => {
              const dayStart = new Date(start);
              dayStart.setDate(dayStart.getDate() + idx);
              const dayEnd = new Date(dayStart);
              dayEnd.setDate(dayEnd.getDate() + 1);
              return rows.filter(
                (task: any) =>
                  Number(task.status_id) === Number(doneStatusId) &&
                  new Date(task.updated_at) >= dayStart &&
                  new Date(task.updated_at) < dayEnd
              ).length;
            });
            const sum = series.reduce((a, b) => a + b, 0);
            next.set(card.id, {
              label: card.name,
              value: statsArePending ? '—' : `${sum.toLocaleString()} ${t('workspace.stats.done', 'done')}`,
              icon: <TrendingUp className="h-5 w-5" />,
              accent,
              sparkline: (
                <TrendSparkline
                  data={series}
                  className={
                    accent === 'purple'
                      ? 'text-purple-600'
                      : accent === 'emerald'
                        ? 'text-emerald-600'
                        : accent === 'amber'
                          ? 'text-amber-600'
                          : 'text-sky-600'
                  }
                />
              ),
              helperText,
            });
          } else if (card.type === 'custom_query') {
            const q = buildTaskQuery(card.query_config);
            const r = await TasksCache.queryTasks({ ...q, startRow: 0, endRow: 0 });
            const count = Number((r as any)?.rowCount ?? 0);
            next.set(card.id, {
              label: card.name,
              value: statsArePending ? '—' : count.toLocaleString(),
              icon: <BarChart3 className="h-5 w-5" />,
              accent,
              helperText,
            });
          } else {
            next.set(card.id, {
              label: card.name,
              value: '—',
              icon: <BarChart3 className="h-5 w-5" />,
              accent,
              helperText: helperText ?? t('kpiCards.unsupportedType', 'Unsupported KPI card type'),
            });
          }
        }

        if (!cancelled) setCustomComputed(next);
      } catch (error) {
        console.error('[Workspace KPI] Error computing KPI cards:', error);
      }
    };

    compute();
    return () => {
      cancelled = true;
    };
  }, [headerKpiCards, workspaceIdNum, doneStatusId, statsArePending, t, tasksRefreshKey]);

  const headerCardsForRender = useMemo(() => {
    const out: WorkspaceHeaderCard[] = [];
    for (const card of headerKpiCards) {
      const computed = defaultComputed.get(card.id) ?? customComputed.get(card.id);
      if (!computed) continue;
      out.push({ id: card.id, ...computed });
    }
    return out;
  }, [headerKpiCards, defaultComputed, customComputed]);

  const fallbackDefaultCards: WorkspaceHeaderCard[] = [
    { id: -1, ...getDefaultCardData('total') },
    { id: -2, ...getDefaultCardData('inProgress') },
    { id: -3, ...getDefaultCardData('completedToday') },
    { id: -4, ...getDefaultCardData('trend') },
  ];

  const headerCards = headerCardsForRender.length > 0 ? headerCardsForRender : fallbackDefaultCards;

  return {
    headerKpiCards,
    setHeaderKpiCards,
    headerCards,
    canReorderHeaderKpis: headerKpiCards.length > 0,
  };
}
