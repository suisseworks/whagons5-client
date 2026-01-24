import { useEffect, useState } from 'react';

export function useWorkspaceRowDensity() {
  const [rowDensity, setRowDensity] = useState<'compact' | 'comfortable' | 'spacious'>(() => {
    try {
      return (localStorage.getItem('wh_workspace_density') as any) || 'spacious';
    } catch { return 'compact'; }
  });
  
  const computedRowHeight = rowDensity === 'compact' ? 40 : rowDensity === 'comfortable' ? 68 : 110;
  
  useEffect(() => {
    try { localStorage.setItem('wh_workspace_density', rowDensity); } catch {}
  }, [rowDensity]);
  
  // Listen for external density changes (from Settings screen)
  useEffect(() => {
    const handler = (e: any) => {
      const v = e?.detail as any;
      if (v === 'compact' || v === 'comfortable' || v === 'spacious') setRowDensity(v);
    };
    window.addEventListener('wh:rowDensityChanged', handler);
    return () => window.removeEventListener('wh:rowDensityChanged', handler);
  }, []);

  return { rowDensity, computedRowHeight };
}
