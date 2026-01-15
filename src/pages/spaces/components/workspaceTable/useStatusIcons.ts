/**
 * Hook for loading and managing status icons
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { iconService } from '@/database/iconService';

/**
 * Hook to load status icons and provide a getter function
 */
export function useStatusIcons(statuses: any[]) {
  const [statusIcons, setStatusIcons] = useState<{ [key: string]: any }>({});
  const [defaultStatusIcon, setDefaultStatusIcon] = useState<any>(null);

  // Load default status icon
  useEffect(() => {
    const loadDefaultIcon = async () => {
      try {
        const icon = await iconService.getIcon('circle');
        setDefaultStatusIcon(icon);
      } catch (error) {
        console.error('Error loading default status icon:', error);
        setDefaultStatusIcon('fa-circle');
      }
    };
    loadDefaultIcon();
  }, []);

  // Load status icons when statuses change
  useEffect(() => {
    const loadStatusIcons = async () => {
      if (!statuses || statuses.length === 0) return;

      const iconNames = statuses
        .map((status: any) => status.icon)
        .filter(Boolean);

      if (iconNames.length > 0) {
        try {
          const icons = await iconService.loadIcons(iconNames);
          setStatusIcons(icons);
        } catch (error) {
          console.error('Error loading status icons:', error);
        }
      }
    };

    loadStatusIcons();
  }, [statuses]);

  // Function to get status icon similar to AppSidebar
  const getStatusIcon = useCallback((iconName?: string) => {
    if (!iconName || typeof iconName !== 'string') {
      return defaultStatusIcon;
    }

    // Parse FontAwesome class format to get the actual icon name
    let parsedIconName = iconName;

    // Handle FontAwesome class format (fas fa-icon-name, far fa-icon-name, etc.)
    const faClassMatch = iconName.match(/^(fas|far|fal|fat|fab|fad|fass)\s+fa-(.+)$/);
    if (faClassMatch) {
      parsedIconName = faClassMatch[2]; // Return just the icon name part
    } else if (iconName.startsWith('fa-')) {
      // Handle fa-prefix format (fa-icon-name -> icon-name)
      parsedIconName = iconName.substring(3);
    }

    return statusIcons[parsedIconName] || defaultStatusIcon;
  }, [statusIcons, defaultStatusIcon]);

  return { getStatusIcon, statusIcons, defaultStatusIcon };
}
