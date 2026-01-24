import { ICellRendererParams } from 'ag-grid-community';

interface ColorAvatarCellProps extends ICellRendererParams {
  colorField?: string;
  showDisabled?: boolean;
  disabledField?: string;
}

export const ColorAvatarCell = ({
  value: name,
  data,
  colorField = 'color',
  showDisabled = false,
  disabledField = 'is_active'
}: ColorAvatarCellProps) => {
  const description = data?.description as string | undefined;
  const color = (data?.[colorField] as string) || '#6B7280';
  const isDisabled = showDisabled && data?.[disabledField] === false;

  return (
    <div className="flex items-center space-x-3 h-full">
      <div 
        className="w-6 h-6 min-w-[1.5rem] rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {name ? name.charAt(0).toUpperCase() : '?'}
      </div>
      <div className="flex flex-col leading-tight">
        <span className={`truncate ${isDisabled ? 'line-through opacity-60' : ''}`}>
          {name}
        </span>
        {description && (
          <span className={`text-xs text-muted-foreground truncate ${isDisabled ? 'line-through opacity-60' : ''}`}>
            {description}
          </span>
        )}
      </div>
    </div>
  );
};
