import { useMemo } from "react";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { Template, Category } from "@/store/types";
import { TemplateNameCellRenderer } from "../components/TemplateNameCell";
import { CategoryIconRenderer } from "../components/CategoryIconRenderer";

interface ColumnDefsProps {
  categories: Category[];
  priorityById: Map<number, { name: string; color?: string | null }>;
  slaById: Map<number, any>;
  approvalById: Map<number, any>;
  availableCategoryIds: number[];
  handleEdit: (template: Template) => void;
  openSummary: (template: Template) => void;
  translate: (key: string, fallback: string) => string;
}

export const useTemplateColumnDefs = ({
  categories,
  priorityById,
  slaById,
  approvalById,
  availableCategoryIds,
  handleEdit,
  openSummary,
  translate: tt
}: ColumnDefsProps) => {
  return useMemo<ColDef[]>(() => [
    {
      field: 'name',
      headerName: tt('grid.columns.name', 'Template Name'),
      flex: 3,
      minWidth: 250,
      cellRenderer: TemplateNameCellRenderer
    },
    {
      field: 'summary',
      headerName: '',
      width: 70,
      suppressMovable: true,
      cellRenderer: (params: ICellRendererParams) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          data-grid-stop-row-click="true"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            (e.nativeEvent as any)?.stopImmediatePropagation?.();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            (e.nativeEvent as any)?.stopImmediatePropagation?.();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            (e.nativeEvent as any)?.stopImmediatePropagation?.();
            openSummary(params.data as Template);
          }}
          title={tt('grid.columns.summary', 'Summary')}
          aria-label={tt('grid.columns.summary', 'Summary')}
        >
          <FontAwesomeIcon icon={faInfoCircle} className="w-4 h-4 text-muted-foreground" />
        </Button>
      ),
    },
    {
      field: 'category_id',
      headerName: tt('grid.columns.category', 'Category'),
      flex: 1,
      minWidth: 200,
      cellRenderer: (params: ICellRendererParams) => {
        const categoryId = Number(params.value);
        const category = (categories as any[]).find((c: any) => Number(c.id) === categoryId);
        if (!category) {
          return <span className="text-muted-foreground">Category {categoryId}</span>;
        }
        const bg = category.color || '#6b7280';

        return (
          <div className="flex items-center h-full">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: bg, color: '#ffffff' }}
            >
              <CategoryIconRenderer iconClass={category.icon} />
              {category.name}
            </span>
          </div>
        );
      },
      sortable: true,
      filter: 'agSetColumnFilter',
      filterParams: {
        values: availableCategoryIds,
        valueFormatter: (params: any) => {
          if (params.value == null || params.value === undefined || isNaN(Number(params.value))) {
            return '';
          }
          const categoryId = Number(params.value);
          const category = (categories as any[]).find((c: any) => Number(c.id) === categoryId);
          return category?.name || `Category ${categoryId}`;
        },
        searchType: 'match',
        suppressSorting: true,
        suppressSelectAll: true,
        defaultToNothingSelected: true
      }
    },
    {
      field: 'priority_id',
      headerName: tt('grid.columns.priority', 'Priority'),
      flex: 0.8,
      minWidth: 140,
      cellRenderer: (params: ICellRendererParams) => {
        const pid = Number(params.value);
        const p = priorityById.get(pid);
        if (!p) return <span className="text-muted-foreground">—</span>;
        return (
          <Badge
            variant="outline"
            style={{ borderColor: p.color || '#6b7280', color: p.color || '#6b7280' }}
          >
            {p.name}
          </Badge>
        );
      },
      sortable: true,
      filter: true
    },
    {
      field: 'sla_id',
      headerName: tt('grid.columns.sla', 'SLA'),
      flex: 1,
      minWidth: 160,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => {
        const options = Array.from(slaById.entries()).map(([id, sla]) => ({
          value: String(id),
          text: sla?.name || `${sla?.response_time ?? '?'} / ${sla?.resolution_time ?? '?'} min`,
        }));
        const values = [''].concat(options.map(o => o.value));
        return {
          values,
          formatValue: (val: string) => {
            const match = options.find(o => o.value === val);
            return match?.text || val || '';
          }
        } as any;
      },
      cellRenderer: (params: ICellRendererParams) => {
        const sid = Number(params.value);
        const s = slaById.get(sid);
        if (!s) return <span className="text-muted-foreground">—</span>;
        const label = s.name || `${s.response_time ?? '?'} / ${s.resolution_time ?? '?' } min`;
        return (
          <div className="flex items-center h-full">
            <Badge variant="secondary" className="text-xs">
              {label}
            </Badge>
          </div>
        );
      },
      sortable: true,
      filter: true
    },
    {
      field: 'approval_id',
      headerName: tt('grid.columns.approval', 'Approval'),
      flex: 1,
      minWidth: 160,
      cellRenderer: (params: ICellRendererParams) => {
        const aid = Number(params.value);
        const a = approvalById.get(aid);
        if (!a) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex items-center h-full">
            <Badge variant="secondary" className="text-xs">
              {a.name}
            </Badge>
          </div>
        );
      },
      sortable: true,
      filter: true
    }
  ], [categories, priorityById, slaById, approvalById, availableCategoryIds, handleEdit, openSummary, tt]);
};
