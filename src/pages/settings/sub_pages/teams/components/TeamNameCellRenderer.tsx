import { ICellRendererParams } from 'ag-grid-community';

export const TeamNameCellRenderer = (props: ICellRendererParams) => {
  const name = props.value as string;
  const description = props.data?.description as string | null | undefined;
  const color = props.data?.color || '#6B7280';
  const isActive = props.data?.is_active !== false;
  return (
    <div className="flex items-center space-x-3 h-full">
      <div 
        className="w-6 h-6 min-w-[1.5rem] rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {name ? name.charAt(0).toUpperCase() : '?'}
      </div>
      <div className="flex flex-col leading-tight">
        <span className={`truncate ${isActive ? '' : 'line-through opacity-60'}`}>{name}</span>
        {description ? (
          <span className={`text-xs text-muted-foreground truncate ${isActive ? '' : 'line-through opacity-60'}`}>{description}</span>
        ) : null}
      </div>
    </div>
  );
};
