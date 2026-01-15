/**
 * Main column builder - combines all column definitions
 * 
 * This module exports the main `buildWorkspaceColumns` function that combines
 * all column definitions from individual column modules.
 */

import { ColumnBuilderOptions } from './types';
import { createBaseColumns } from './baseColumns';
import { createNameColumn } from './nameColumn';
import { createStatusColumn } from './statusColumn';
import { createPriorityColumn } from './priorityColumn';
import { createOwnerColumn } from './ownerColumn';
import { createConfigColumn } from './configColumnApprovalSla';
import { createCustomFieldColumns } from './customFieldColumns';
import { createVisibilityChecker } from './shared/utils';

/**
 * Build workspace table column definitions
 * 
 * Combines all column modules into a single array of AG Grid column definitions.
 * Handles visibility, grouping, and applies compact styling.
 */
export function buildWorkspaceColumns(opts: ColumnBuilderOptions) {
  // Precompute latest note per task for quick lookup
  const latestNoteByTaskId = new Map<number, { text: string; ts: number }>();
  if (Array.isArray(opts.taskNotes) && opts.taskNotes.length > 0) {
    for (const note of opts.taskNotes as any[]) {
      const taskId = Number((note as any)?.task_id);
      if (!Number.isFinite(taskId)) continue;
      const text = (note as any)?.note;
      if (!text) continue;
      const tsRaw = (note as any)?.updated_at || (note as any)?.created_at;
      const tsParsed = tsRaw ? new Date(tsRaw as any).getTime() : 0;
      const ts = Number.isFinite(tsParsed) ? tsParsed : 0;
      const prev = latestNoteByTaskId.get(taskId);
      if (!prev || ts >= prev.ts) {
        latestNoteByTaskId.set(taskId, { text: String(text), ts });
      }
    }
  }

  const isVisible = createVisibilityChecker(opts.visibleColumns);

  const appendCellClass = (existing: any, cls: string) => {
    if (!existing) return cls;
    if (typeof existing === 'string') return `${existing} ${cls}`;
    if (Array.isArray(existing)) return [...existing, cls];
    return existing;
  };

  // Build all columns
  const cols: any[] = [
    ...createBaseColumns(opts),
    createNameColumn(opts, latestNoteByTaskId),
    createConfigColumn(opts),
    createStatusColumn(opts),
    createPriorityColumn(opts),
    createOwnerColumn(opts),
  ];

  // Add custom field columns
  const customFieldCols = createCustomFieldColumns(opts);
  if (customFieldCols.length > 0) {
    cols.push(...customFieldCols);
  }

  // Apply grouping to status or priority when selected
  if (opts.groupField === 'status_id') {
    const c = cols.find((x: any) => x.field === 'status_id');
    if (c) { c.rowGroup = true; c.hide = true; }
  }
  if (opts.groupField === 'priority_id') {
    const c = cols.find((x: any) => x.field === 'priority_id');
    if (c) { c.rowGroup = true; c.hide = true; }
  }

  // Apply compact styling to secondary columns + visibility handling
  for (const col of cols as any[]) {
    const id = (col.colId as string) || (col.field as string) || '';
    if (id && !['name', 'priority_id', 'user_ids'].includes(id)) {
      col.cellClass = appendCellClass(col.cellClass, 'wh-compact-col');
    }
    if (id === 'name') continue;
    // Skip if grouping logic already forced hide
    if (col.rowGroup && col.hide === true) continue;
    if (!isVisible(id)) {
      col.hide = true;
    }
  }

  return cols;
}
