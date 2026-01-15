import { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTags } from '@fortawesome/free-solid-svg-icons';
import { iconService } from '@/database/iconService';

// Icon cache to prevent reloading icons when components remount
const iconCache = new Map<string, any>();
const iconLoadingPromises = new Map<string, Promise<any>>();

function normalizeFaClass(iconClass: string): string {
  const iconCls = (iconClass || '').trim();
  if (!iconCls) return '';
  const faClassMatch = iconCls.match(/^(fas|far|fal|fat|fab|fad|fass)\s+fa-(.+)$/);
  if (faClassMatch) return faClassMatch[2];
  if (iconCls.startsWith('fa-')) return iconCls.substring(3);
  return iconCls;
}

export function useIconDefinition(iconClass?: string | null, fallback: any = faTags) {
  const iconCls = (iconClass || '').trim();
  const [iconDef, setIconDef] = useState<any>(() => {
    if (iconCls && iconCache.has(iconCls)) return iconCache.get(iconCls);
    return iconCls ? null : fallback;
  });

  useEffect(() => {
    let cancelled = false;

    const loadIcon = async () => {
      if (!iconCls) {
        if (!cancelled) setIconDef(fallback);
        return;
      }

      if (iconCache.has(iconCls)) {
        if (!cancelled) setIconDef(iconCache.get(iconCls));
        return;
      }

      if (iconLoadingPromises.has(iconCls)) {
        try {
          const icon = await iconLoadingPromises.get(iconCls);
          if (!cancelled) setIconDef(icon || fallback);
        } catch {
          if (!cancelled) setIconDef(fallback);
        }
        return;
      }

      const parsed = normalizeFaClass(iconCls);

      const loadPromise = (async () => {
        try {
          const icon = await iconService.getIcon(parsed);
          const finalIcon = icon || fallback;
          iconCache.set(iconCls, finalIcon);
          iconLoadingPromises.delete(iconCls);
          return finalIcon;
        } catch {
          iconCache.set(iconCls, fallback);
          iconLoadingPromises.delete(iconCls);
          return fallback;
        }
      })();

      iconLoadingPromises.set(iconCls, loadPromise);

      try {
        const icon = await loadPromise;
        if (!cancelled && iconCls === (iconClass || '').trim()) setIconDef(icon || fallback);
      } catch {
        if (!cancelled && iconCls === (iconClass || '').trim()) setIconDef(fallback);
      }
    };

    loadIcon();
    return () => {
      cancelled = true;
    };
  }, [fallback, iconClass, iconCls]);

  return iconDef;
}

export function IconBadge(props: { iconClass?: string | null; color?: string; size?: 'sm' | 'xs' }) {
  const iconCls = (props.iconClass || '').trim();
  const iconDef = useIconDefinition(iconCls, faTags);
  const size = props.size || 'sm';

  // Preserve prior behavior: CategoryIconSmall rendered nothing until iconClass existed and loaded
  if (!iconCls || !iconDef) return null;

  const dims = size === 'xs' ? { box: 'w-5 h-5', font: 10 } : { box: 'w-6 h-6', font: 12 };

  return (
    <div
      className={`${dims.box} min-w-[1.5rem] rounded-lg flex items-center justify-center flex-shrink-0`}
      style={{ backgroundColor: props.color || '#6b7280' }}
    >
      <FontAwesomeIcon icon={iconDef} style={{ color: '#ffffff', fontSize: `${dims.font}px` }} className="text-white" />
    </div>
  );
}

