import { ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileAlt, faLock } from "@fortawesome/free-solid-svg-icons";
import { NameWithDescriptionCell } from "../../../shared/cellRenderers";

export const TemplateNameCellRenderer = (props: ICellRendererParams) => {
  const templateName = props.value;
  const isPrivate = (props.data as any)?.is_private === true;
  const isEnabled = (props.data as any)?.enabled !== false;

  return (
    <div className="flex items-center h-full space-x-2">
      <FontAwesomeIcon
        icon={faFileAlt}
        className="w-4 h-4 text-gray-300"
      />
      <div className="flex flex-col justify-center flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`leading-tight ${!isEnabled ? 'line-through opacity-60' : ''}`}>
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
          <span className="text-xs text-muted-foreground leading-snug line-clamp-2">
            {(props.data as any).description}
          </span>
        )}
      </div>
    </div>
  );
};
