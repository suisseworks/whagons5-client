import { ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCubes } from "@fortawesome/free-solid-svg-icons";
import { Category } from "@/store/types";
import { useLanguage } from "@/providers/LanguageProvider";

type CategoryActionsRendererParams = {
  onManageFields: (category: Category) => void;
  getFieldCount: (categoryId: number) => number;
};

export const CategoryActionsCellRenderer = (
  props: ICellRendererParams & CategoryActionsRendererParams
) => {
  const { data, onManageFields, getFieldCount } = props;
  const { t } = useLanguage();
  const tc = (key: string, fallback: string) => t(`settings.categories.${key}`, fallback);
  if (!data) return null;
  const category = data as Category;
  const id = Number(category.id);
  const count = getFieldCount(id);
  const label = count > 0 ? tc('grid.actions.fieldsWithCount', `Fields (${count})`).replace('{count}', String(count)) : tc('grid.actions.fields', 'Fields');

  const handleClick = (
    handler: (category: Category) => void,
    event: React.MouseEvent
  ) => {
    event.preventDefault();
    event.stopPropagation();
    // Radix/AG Grid can listen above React; stop the native event too
    (event.nativeEvent as any)?.stopImmediatePropagation?.();
    handler(category);
  };

  return (
    <div className="flex w-full justify-end">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          data-grid-stop-row-click="true"
          onPointerDown={(e) => {
            // Prevent AG Grid from treating this as a row click (which would open Edit)
            e.preventDefault();
            e.stopPropagation();
            // Radix/AG Grid can listen above React; stop the native event too
            (e.nativeEvent as any)?.stopImmediatePropagation?.();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            (e.nativeEvent as any)?.stopImmediatePropagation?.();
          }}
          onClick={(event) => handleClick(onManageFields, event)}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.12)] transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
        >
          <FontAwesomeIcon icon={faCubes} className="h-3 w-3 text-slate-500" />
          {label}
        </button>
      </div>
    </div>
  );
};
