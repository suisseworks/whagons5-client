import { useState, useEffect } from "react";
import { ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { iconService } from '@/database/iconService';
import { faTags } from "@fortawesome/free-solid-svg-icons";

interface IconCellProps extends ICellRendererParams {
  iconField?: string;
  colorField?: string;
  defaultIcon?: IconDefinition;
  fallbackIcon?: IconDefinition;
}

export const IconCell = ({
  value: name,
  data,
  iconField = 'icon',
  colorField = 'color',
  defaultIcon = faTags,
  fallbackIcon = faTags
}: IconCellProps) => {
  const [icon, setIcon] = useState<IconDefinition>(defaultIcon);
  const iconClass = data?.[iconField] as string | undefined;
  const color = (data?.[colorField] as string) || '#6B7280';

  useEffect(() => {
    const loadIcon = async () => {
      if (!iconClass) {
        setIcon(defaultIcon);
        return;
      }

      try {
        const parts = iconClass.split(' ');
        const last = parts[parts.length - 1];
        const loadedIcon = await iconService.getIcon(last);
        setIcon(loadedIcon || fallbackIcon);
      } catch (error) {
        console.error('Error loading icon:', error);
        setIcon(fallbackIcon);
      }
    };

    loadIcon();
  }, [iconClass, defaultIcon, fallbackIcon]);

  return (
    <div className="flex items-center space-x-3 h-full">
      <FontAwesomeIcon
        icon={icon}
        className="w-4 h-4"
        style={{ color }}
      />
      <div className="flex flex-col leading-tight">
        <span>{name}</span>
        {data?.description && (
          <span className="text-xs text-muted-foreground truncate">
            {data.description}
          </span>
        )}
      </div>
    </div>
  );
};
