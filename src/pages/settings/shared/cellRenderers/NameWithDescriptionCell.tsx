import { ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";

interface NameWithDescriptionCellProps extends ICellRendererParams {
  icon?: IconDefinition;
  iconColor?: string;
  showDisabled?: boolean;
  disabledField?: string;
  showPrivate?: boolean;
  privateField?: string;
}

export const NameWithDescriptionCell = ({
  value: name,
  data,
  icon,
  iconColor = '#6B7280',
  showDisabled = false,
  disabledField = 'enabled',
  showPrivate = false,
  privateField = 'is_private'
}: NameWithDescriptionCellProps) => {
  const description = data?.description as string | undefined;
  const isDisabled = showDisabled && data?.[disabledField] === false;
  const isPrivate = showPrivate && data?.[privateField] === true;

  return (
    <div className="flex items-center h-full space-x-2">
      {icon && (
        <FontAwesomeIcon
          icon={icon}
          className="w-4 h-4"
          style={{ color: iconColor }}
        />
      )}
      <div className="flex flex-col justify-center flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`leading-tight ${isDisabled ? 'line-through opacity-60' : ''}`}>
            {name}
          </span>
          {isPrivate && (
            <FontAwesomeIcon
              icon="lock" as any
              className="w-3 h-3 text-muted-foreground"
              title="Private"
            />
          )}
        </div>
        {description && (
          <span className="text-xs text-muted-foreground leading-snug line-clamp-2">
            {description}
          </span>
        )}
      </div>
    </div>
  );
};
