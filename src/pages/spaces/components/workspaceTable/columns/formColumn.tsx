/**
 * Form column: shows the Form associated to the task's Template (template.form_id -> form.name)
 */

import { FileText } from 'lucide-react';
import { ColumnBuilderOptions } from './types';

export function createFormColumn(opts: ColumnBuilderOptions) {
  const t = opts.t || ((key: string, fallback?: string) => fallback || key);

  return {
    colId: 'form',
    headerName: t('workspace.columns.form', 'Form'),
    width: 160,
    minWidth: 140,
    maxWidth: 220,
    sortable: true,
    filter: false,
    valueGetter: (p: any) => {
      const tplId = Number(p?.data?.template_id);
      if (!Number.isFinite(tplId) || tplId <= 0) return '';
      const tpl = opts.templateMap?.[tplId];
      const formId = Number((tpl as any)?.form_id);
      if (!Number.isFinite(formId) || formId <= 0) return '';
      const form = opts.formMap?.[formId];
      return String((form as any)?.name || '');
    },
    cellRenderer: (p: any) => {
      // Loading placeholder when row data isn't ready (infinite row model)
      if (!p.data) {
        return (
          <div className="flex items-center h-full py-2">
            <div className="h-3 w-16 bg-muted animate-pulse rounded" />
          </div>
        );
      }

      const tplId = Number(p?.data?.template_id);
      if (!Number.isFinite(tplId) || tplId <= 0) {
        return (
          <div className="flex items-center h-full py-2">
            <span className="text-[12px] text-muted-foreground">—</span>
          </div>
        );
      }

      const tpl = opts.templateMap?.[tplId];
      const formId = Number((tpl as any)?.form_id);
      if (!Number.isFinite(formId) || formId <= 0) {
        return (
          <div className="flex items-center h-full py-2">
            <span className="text-[12px] text-muted-foreground">—</span>
          </div>
        );
      }

      const form = opts.formMap?.[formId];
      const name = String((form as any)?.name || '').trim();

      if (!name) {
        return (
          <div className="flex items-center h-full py-2">
            <span className="text-[12px] text-muted-foreground">—</span>
          </div>
        );
      }

      return (
        <div className="flex items-center h-full py-2 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/60 border border-border min-w-0">
            <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-[12px] text-foreground truncate">{name}</span>
          </div>
        </div>
      );
    },
  };
}

