/**
 * Priority column definition with priority pill renderer
 */

import { Flag } from 'lucide-react';
import { ColumnBuilderOptions } from './types';
import { createPriorityPaletteCache } from './shared/utils';

export function createPriorityColumn(opts: ColumnBuilderOptions) {
  const {
    priorityMap,
    prioritiesLoaded,
    filteredPriorities,
  } = opts;

  const getPriorityPalette = createPriorityPaletteCache();

  return {
    field: 'priority_id',
    headerName: 'Priority',
    sortable: true,
    filter: 'agSetColumnFilter',
    suppressHeaderMenuButton: true,
    suppressHeaderFilterButton: true,
    cellStyle: {
      overflow: 'visible',
      textOverflow: 'clip',
      whiteSpace: 'nowrap',
    },
    valueFormatter: (p: any) => {
      const meta: any = priorityMap[p.value as number];
      return meta?.name || `#${p.value}`;
    },
    filterParams: {
      values: (params: any) => {
        const ids = (filteredPriorities || []).map((p: any) => Number((p as any).id));
        params.success(ids);
      },
      suppressMiniFilter: false,
      valueFormatter: (p: any) => {
        const meta: any = priorityMap[p.value as number];
        return meta?.name || `#${p.value}`;
      },
    },
    cellRenderer: (p: any) => {
      if (!p.data) {
        return (
          <div className="flex items-center h-full py-1">
            <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
          </div>
        );
      }
      if (!prioritiesLoaded || p.value == null) return (<div className="flex items-center h-full py-1"><span className="opacity-0">.</span></div>);
      const meta: any = priorityMap[p.value as number];
      if (!meta) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
      const name = meta.name;
      const palette = getPriorityPalette(Number(p.value), name, meta?.color);
      const pill = (
        <div className="inline-flex items-center h-full py-1.5">
          <span
            className="inline-flex items-center gap-2 rounded-[12px] px-3 py-1 text-[13px] font-medium leading-none whitespace-nowrap"
            style={{ background: palette.bg, color: palette.text }}
          >
            <Flag className="h-3.5 w-3.5 flex-shrink-0" style={{ color: palette.text, opacity: 0.9 }} />
            <span>{name}</span>
          </span>
        </div>
      );
      return pill;
    },
    width: 110,
    minWidth: 110,
    maxWidth: 140,
  };
}
