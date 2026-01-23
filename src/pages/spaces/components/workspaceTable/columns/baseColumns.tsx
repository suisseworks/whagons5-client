/**
 * Base column definitions: ID, Notes, Due Date, Location, Last Modified
 */

import dayjs from 'dayjs';
import { MessageSquare } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ColumnBuilderOptions } from './types';
import { createVisibilityChecker } from './shared/utils';

export function createBaseColumns(opts: ColumnBuilderOptions) {
  const {
    onDeleteTask,
    onLogTask,
    taskNotes,
    taskAttachments,
    spotMap,
    spotsLoaded,
    formatDueDate,
    visibleColumns,
  } = opts;

  const isVisible = createVisibilityChecker(visibleColumns);

  const t = opts.t || ((key: string, fallback?: string) => fallback || key);
  
  return [
    {
      field: 'id',
      headerName: t('workspace.columns.id', 'ID'),
      width: 75,
      minWidth: 70,
      maxWidth: 85,
      sortable: true,
      cellClass: 'wh-id-cell',
      valueFormatter: (p: any) => (p?.value ?? ''),
      comparator: (valueA: any, valueB: any) => {
        // Ensure numeric sorting
        const numA = Number(valueA);
        const numB = Number(valueB);
        if (!Number.isFinite(numA) && !Number.isFinite(numB)) return 0;
        if (!Number.isFinite(numA)) return -1;
        if (!Number.isFinite(numB)) return 1;
        return numA - numB;
      },
      cellStyle: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        paddingRight: '4px',
      },
      suppressHeaderMenuButton: false,
      cellRenderer: (p: any) => {
        const id = p?.value;
        const taskId = Number(p?.data?.id);
        const hasValidId = Number.isFinite(taskId);
        const api = p?.api;
        const node = p?.node;
        const isSelected = node?.isSelected?.() ?? false;
        
        if (!hasValidId) {
          return (
            <div className="flex flex-col items-center justify-center gap-2 h-full w-full">
              <span className="flex items-center justify-center px-1.5 py-0.5 rounded-md bg-muted/60 border border-border text-[11px] font-mono text-muted-foreground">
                {id ?? ''}
              </span>
              <div className="flex items-center justify-center w-6 h-6">
                <div className="w-5 h-5 rounded-full border-2 border-muted bg-background opacity-50" />
              </div>
            </div>
          );
        }
        
        return (
          <div className="flex flex-col items-center justify-center gap-2 h-full w-full">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center px-1.5 py-0.5 rounded-md bg-muted/60 border border-border text-[11px] font-mono text-muted-foreground hover:bg-muted/80 cursor-pointer transition-colors"
                  aria-label="Task actions"
                >
                  {id ?? ''}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="right" sideOffset={4} className="w-44">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onLogTask?.(taskId); }}>
                  Log
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDeleteTask?.(taskId); }}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Custom circular checkbox - prevents row click */}
            <div 
              className="flex items-center justify-center w-6 h-6 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (node) {
                  node.setSelected(!isSelected);
                  requestAnimationFrame(() => {
                    api?.refreshCells?.({ rowNodes: [node], force: true });
                  });
                }
              }}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                isSelected 
                  ? 'bg-primary border-primary' 
                  : 'bg-background border-border hover:border-primary/50'
              }`}>
                {isSelected && (
                  <div className="w-2.5 h-2.5 rounded-full bg-white dark:bg-background" />
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      colId: 'notes',
      headerName: '',
      width: 60,
      minWidth: 60,
      maxWidth: 60,
      filter: false,
      sortable: false,
      cellRenderer: (p: any) => {
        const taskId = p.data?.id;
        if (!taskId) return null;
        
        const notesCount = (taskNotes || []).filter((n: any) => Number(n.task_id) === Number(taskId)).length;
        const attachmentsCount = (taskAttachments || []).filter((a: any) => Number(a.task_id) === Number(taskId)).length;
        const total = notesCount + attachmentsCount;
        
        return (
          <div className="flex items-center justify-center h-full w-full">
             <div 
               className={`relative group cursor-pointer flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted transition-colors ${total === 0 ? 'opacity-30 hover:opacity-100' : ''}`}
               onClick={(e) => {
                e.stopPropagation();
                const event = new CustomEvent('wh:openTaskNotes', { detail: { taskId, taskName: p.data?.name } });
                window.dispatchEvent(event);
             }}>
              <MessageSquare className={`w-4 h-4 ${total > 0 ? 'text-green-600 fill-green-600/10' : 'text-muted-foreground'}`} />
              {total > 0 && (
                <div className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-green-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border-2 border-background">
                  {total}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      field: 'due_date',
      headerName: t('workspace.columns.due', 'Due'),
      filter: false,
      cellRenderer: (p: any) => {
        if (!p.data) {
          return (
            <div className="flex items-center h-full py-2">
              <div className="h-3 w-16 bg-muted animate-pulse rounded" />
            </div>
          );
        }
        const dueDate = p.data?.due_date;
        if (!dueDate) {
          return (
            <div className="flex items-center h-full py-2">
              <span className="text-[12px] text-muted-foreground"></span>
            </div>
          );
        }
        const d = dayjs(dueDate);
        const now = dayjs();
        const isOverdue = d.isBefore(now, 'day');
        const daysDiff = d.diff(now, 'day');
        const urgent = !isOverdue && daysDiff <= 2;
        const colorCls = isOverdue ? 'text-red-600' : urgent ? 'text-amber-600' : 'text-muted-foreground';
        const inner = (
          <div className="flex items-center h-full py-2">
            <span className={`inline-flex items-center ${colorCls}`}>
              <span className="text-[12px]">{isOverdue ? d.fromNow() : `in ${Math.abs(daysDiff)} day${Math.abs(daysDiff) === 1 ? '' : 's'}`}</span>
            </span>
          </div>
        );
        const node = (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>{inner}</TooltipTrigger>
              <TooltipContent side="top">{d.format('MMM D, YYYY')} • {d.fromNow()}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
        return node;
      },
      width: 120,
      minWidth: 100,
      maxWidth: 160,
    },
    {
      field: 'spot_id',
      headerName: t('workspace.columns.location', 'Location'),
      sortable: true,
      filter: 'agSetColumnFilter',
      rowGroup: opts.groupField === 'spot_id' ? true : undefined,
      hide: opts.groupField === 'spot_id' ? true : !isVisible('spot_id'),
      valueFormatter: (p: any) => {
        const meta: any = spotMap[p.value as number];
        return meta?.name || `#${p.value}`;
      },
      filterParams: {
        values: (params: any) => {
          const ids = Object.keys(spotMap).map((k: any) => Number(k));
          params.success(ids);
        },
        suppressMiniFilter: false,
        valueFormatter: (p: any) => {
          const meta: any = spotMap[p.value as number];
          return meta?.name || `#${p.value}`;
        },
      },
      cellRenderer: (p: any) => {
        if (!p.data) {
          return (
            <div className="flex items-center h-full py-1">
              <div className="h-3 w-24 bg-muted animate-pulse rounded" />
            </div>
          );
        }
        if (!spotsLoaded) return (<div className="flex items-center h-full py-1"><span className="opacity-0">.</span></div>);
        if (p.value == null) return (<div className="flex items-center h-full py-2"><span className="text-[12px] text-muted-foreground"></span></div>);
        const meta: any = spotMap[p.value as number];
        if (!meta) return (<div className="flex items-center h-full py-2"><span className="opacity-0">.</span></div>);
        const name = meta.name;
        const tag = (
          <div className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className="truncate max-w-[160px]">{name}</span>
          </div>
        );
        const node = (
          <div className="flex items-center h-full py-1">{tag}</div>
        );
        return node;
      },
      flex: 2,
      minWidth: 180,
    },
    {
      field: 'updated_at',
      colId: 'created_at',
      headerName: t('workspace.columns.lastModified', 'Last modified'),
      sortable: true,
      filter: false,
      valueGetter: (p: any) => {
        return p.data?.updated_at || p.data?.created_at;
      },
      comparator: (valueA: any, valueB: any) => {
        if (!valueA && !valueB) return 0;
        if (!valueA) return -1;
        if (!valueB) return 1;
        const dateA = new Date(valueA).getTime();
        const dateB = new Date(valueB).getTime();
        return dateA - dateB;
      },
      cellRenderer: (p: any) => {
        if (!p.data) {
          return (
            <div className="flex items-center h-full py-2">
              <div className="h-3 w-20 bg-muted animate-pulse rounded" />
            </div>
          );
        }
        const updatedAt = p.data?.updated_at || p.data?.created_at;
        if (!updatedAt) {
          return (
            <div className="flex items-center h-full py-2">
              <span className="text-[12px] text-muted-foreground">—</span>
            </div>
          );
        }
        const d = dayjs(updatedAt);
        const inner = (
          <div className="flex items-center h-full py-2">
            <span className="inline-flex items-center text-muted-foreground">
              <span className="text-[12px]">{d.fromNow()}</span>
            </span>
          </div>
        );
        const node = (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>{inner}</TooltipTrigger>
              <TooltipContent side="top">{d.format('MMM D, YYYY, h:mm A')} • {d.fromNow()}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
        return node;
      },
      width: 120,
      minWidth: 100,
      maxWidth: 160,
    },
    {
      field: 'tag_ids',
      headerName: 'Tags (filter)',
      hide: true,
      filter: 'agSetColumnFilter',
      filterValueGetter: (p: any) => {
        const taskId = Number(p.data?.id);
        if (!Number.isFinite(taskId)) return [];
        const ids = (opts.taskTagsMap && opts.taskTagsMap.get(taskId)) || [];
        return (ids || []).map((id: any) => Number(id)).filter((n: number) => Number.isFinite(n));
      },
      filterParams: {
        values: (params: any) => {
          const ids = Object.keys(opts.tagMap || {})
            .map((k: any) => Number(k))
            .filter((n: number) => Number.isFinite(n));
          params.success(ids);
        },
        suppressMiniFilter: false,
        valueFormatter: (p: any) => {
          const tag = opts.tagMap?.[p.value as number];
          return tag?.name || `#${p.value}`;
        },
      },
      width: 120,
      minWidth: 100,
      maxWidth: 140,
    },
  ];
}
