import { useState, useEffect } from "react";
import { ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTags } from "@fortawesome/free-solid-svg-icons";
import { iconService } from '@/database/iconService';

export const CategoryNameCellRenderer = (props: ICellRendererParams) => {
  const [icon, setIcon] = useState<any>(faTags);
  const categoryIcon = props.data?.icon;
  const categoryColor = props.data?.color || '#6B7280';
  const categoryName = props.value;

  useEffect(() => {
    const loadIcon = async () => {
      if (!categoryIcon) {
        setIcon(faTags);
        return;
      }

      try {
        // Parse FontAwesome icon class (e.g., "fas fa-hat-wizard")
        const iconClasses = categoryIcon.split(' ');
        const iconName = iconClasses[iconClasses.length - 1]; // Get the last part (hat-wizard)

        // Use iconService to load the icon dynamically
        const loadedIcon = await iconService.getIcon(iconName);
        setIcon(loadedIcon || faTags);
      } catch (error) {
        console.error('Error loading category icon:', error);
        setIcon(faTags);
      }
    };

    loadIcon();
  }, [categoryIcon]);

  return (
    <div className="flex items-center space-x-3 h-full">
      <FontAwesomeIcon
        icon={icon}
        className="w-4 h-4"
        style={{ color: categoryColor }}
      />
      <div className="flex flex-col leading-tight">
        <span className={!props.data?.enabled ? "line-through text-muted-foreground" : undefined}>{categoryName}</span>
        {props.data?.description ? (
          <span className={`text-xs truncate ${!props.data?.enabled ? "line-through text-muted-foreground" : "text-muted-foreground"}`}>{props.data.description}</span>
        ) : null}
      </div>
    </div>
  );
};
