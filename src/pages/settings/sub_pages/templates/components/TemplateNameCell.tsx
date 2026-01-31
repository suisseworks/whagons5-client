import { ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/free-solid-svg-icons";

export const TemplateNameCellRenderer = (props: ICellRendererParams) => {
  const templateName = props.value;
  const isPrivate = (props.data as any)?.is_private === true;
  const isEnabled = (props.data as any)?.enabled !== false;

  return (
    <div className="flex items-center h-full">
      <div className="flex flex-col justify-center flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-medium leading-tight ${!isEnabled ? 'line-through opacity-60' : ''}`}>
            {templateName}
          </span>
          {isPrivate && (
            <FontAwesomeIcon
              icon={faLock}
              className="w-3 h-3 text-muted-foreground"
              title="Private template"
            />
          )}
        </div>
        {(props.data as any)?.description && (
          <span className="text-xs text-muted-foreground/70 leading-snug line-clamp-2 mt-0.5">
            {(props.data as any).description}
          </span>
        )}
      </div>
    </div>
  );
};
