/**
 * Form column: shows the Form associated to the task's Template (template.form_id -> form.name)
 * Clickable to open the form fill dialog.
 */

import { FileText, CheckCircle2 } from 'lucide-react';
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

      const taskId = Number(p?.data?.id);
      const taskName = p?.data?.name;
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
      const formVersionId = Number((form as any)?.current_version_id);

      if (!name) {
        return (
          <div className="flex items-center h-full py-2">
            <span className="text-[12px] text-muted-foreground">—</span>
          </div>
        );
      }

      // Check if the task has a form submission
      const taskForm = opts.taskFormsMap?.get(taskId);
      const isFilled = !!taskForm;
      const existingTaskFormId = taskForm?.id;
      const existingData = taskForm?.data;

      // Handle click to open form dialog
      const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (opts.onOpenFormDialog && Number.isFinite(formVersionId) && formVersionId > 0) {
          opts.onOpenFormDialog({
            taskId,
            taskName,
            formId,
            formVersionId,
            existingTaskFormId,
            existingData,
          });
        }
      };

      // Style based on fill status
      const baseClasses = "inline-flex items-center gap-1.5 px-2 py-1 rounded-md min-w-0 transition-colors";
      const filledClasses = "bg-green-500/10 border border-green-500/30 hover:bg-green-500/20";
      const unfilledClasses = "bg-muted/60 border border-border hover:bg-muted/80";
      const clickableClasses = opts.onOpenFormDialog ? "cursor-pointer" : "";

      return (
        <div className="flex items-center h-full py-2 min-w-0">
          <button
            type="button"
            onClick={handleClick}
            className={`${baseClasses} ${isFilled ? filledClasses : unfilledClasses} ${clickableClasses}`}
            title={isFilled ? 'Form filled - click to edit' : 'Click to fill form'}
          >
            {isFilled ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            )}
            <span className={`text-[12px] truncate ${isFilled ? 'text-green-700 dark:text-green-400' : 'text-foreground'}`}>
              {name}
            </span>
          </button>
        </div>
      );
    },
    onCellClicked: (params: any) => {
      // Prevent row click when clicking form column
      params.event?.stopPropagation();
    },
  };
}

