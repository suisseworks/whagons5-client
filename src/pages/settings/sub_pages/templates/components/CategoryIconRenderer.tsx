import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTags } from "@fortawesome/free-solid-svg-icons";
import { iconService } from '@/database/iconService';

export const CategoryIconRenderer = ({ iconClass }: { iconClass?: string }) => {
  const [icon, setIcon] = useState<any>(faTags);

  useEffect(() => {
    const loadIcon = async () => {
      if (!iconClass) {
        setIcon(faTags);
        return;
      }

      try {
        const parts = iconClass.split(' ');
        const last = parts[parts.length - 1];
        const loadedIcon = await iconService.getIcon(last);
        setIcon(loadedIcon || faTags);
      } catch (error) {
        console.error('Error loading category icon:', error);
        setIcon(faTags);
      }
    };

    loadIcon();
  }, [iconClass]);

  return <FontAwesomeIcon icon={icon} className="w-3.5 h-3.5 mr-1" />;
};
