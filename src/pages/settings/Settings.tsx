 
import { useEffect, useMemo, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
 
import { Separator } from "@/components/ui/separator";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faTags, 
  faClipboardList, 
  faLocationDot, 
  faUsers, 
  faUser, 
  faSitemap,
  faArrowUpWideShort,
  faGripVertical,
  faStopwatch
} from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import api from "@/api/whagonsApi";
import { useState } from "react";
import { createSwapy } from 'swapy';

function Settings() {
  const navigate = useNavigate();
  const [spotCount, setSpotCount] = useState<number | undefined>(undefined);
  const [cardOrder, setCardOrder] = useState<string[]>([]);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const swapyRef = useRef<ReturnType<typeof createSwapy> | null>(null);
  const draggingRef = useRef<boolean>(false);
  const [slotItemMap, setSlotItemMap] = useState<Array<[string, string]>>([]);
  const hydratedRef = useRef<boolean>(false);
  
  // Hydrate data (idempotent if already loaded)


  // Fetch authoritative spot count from backend
  useEffect(() => {
    let cancelled = false;
    const fetchSpotCount = async () => {
      // 1) Try integrity blocks API (most reliable and cheap for totals)
      try {
        for (const table of ['wh_spots']) {
          try {
            const r = await api.get('/integrity/blocks', { params: { table } });
            const blocks = r?.data?.data || [];
            if (Array.isArray(blocks) && blocks.length) {
              const total = blocks.reduce((sum: number, b: any) => sum + (b?.row_count || 0), 0);
              if (!cancelled && total > 0) { setSpotCount(total); return; }
            }
          } catch (_) { /* try next table name */ }
        }
      } catch (_) { /* fall through to REST fallback */ }

      // 2) Fallback to REST list endpoint and rely on pagination.total if available
      try {
        const resp = await api.get('/spots', { params: { page: 1, per_page: 1 } });
        const total = resp?.data?.pagination?.total
          ?? resp?.data?.total
          ?? resp?.data?.meta?.total
          ?? (resp?.headers && (parseInt((resp.headers as any)['x-total-count']) || undefined));
        if (!cancelled && typeof total === 'number') { setSpotCount(total); return; }
      } catch (_) { /* ignore; will fallback to client-side derivations */ }

      // 3) Final fallback: request a large page and count rows directly
      try {
        const resp = await api.get('/spots', { params: { page: 1, per_page: 1000 } });
        const rows = Array.isArray(resp?.data?.data)
          ? resp.data.data
          : (Array.isArray(resp?.data?.rows) ? resp.data.rows : []);
        if (!cancelled && Array.isArray(rows)) { setSpotCount(rows.length); return; }
      } catch (_) { /* last resort: keep derived value */ }
    };
    fetchSpotCount();
    return () => { cancelled = true; };
  }, []);

  // Select from store
  const categories = useSelector((s: RootState) => s.categories.value);
  const templates = useSelector((s: RootState) => s.templates.value);
  const teams = useSelector((s: RootState) => s.teams.value);
  const tasks = useSelector((s: RootState) => s.tasks.value);
  const workspaces = useSelector((s: RootState) => s.workspaces.value);
  const statuses = useSelector((s: RootState) => s.statuses.value);
  const priorities = useSelector((s: RootState) => s.priorities.value);
  const slas = useSelector((s: RootState) => s.slas.value);
  const users = useSelector((s: RootState) => s.users.value);
  const forms = useSelector((s: RootState) => s.forms.value);

  const counts = useMemo(() => {
    // Prefer authoritative count from workspaces.spots when present. The API may
    // return spots either as an array or as a JSON-encoded string – handle both.
    const spotsFromWorkspaces = workspaces.reduce((sum: number, w: any) => {
      let length = 0;
      const spotsVal = w?.spots;
      if (Array.isArray(spotsVal)) {
        length = spotsVal.length;
      } else if (typeof spotsVal === 'string') {
        try {
          const parsed = JSON.parse(spotsVal);
          if (Array.isArray(parsed)) length = parsed.length;
        } catch { /* ignore parse errors */ }
      }
      return sum + length;
    }, 0);

    let spotsFromTasks = 0;
    if (spotsFromWorkspaces === 0) {
      const spotIds = new Set<number>();
      for (const t of tasks) {
        if (t.spot_id && t.spot_id > 0) spotIds.add(t.spot_id);
      }
      spotsFromTasks = spotIds.size;
    }

    return {
      categories: categories.length,
      templates: templates.length,
      teams: teams.length,
      spots: spotCount ?? (spotsFromWorkspaces > 0 ? spotsFromWorkspaces : spotsFromTasks),
      statuses: statuses.length,
      priorities: priorities.length,
      slas: slas.length,
      users: users.length,
      forms: forms.length,
    };
  }, [categories.length, templates.length, teams.length, tasks, workspaces, spotCount, statuses.length, priorities.length, slas.length, users.length, forms.length]);

  // Settings configuration data
  const settingsOptions = [
    {
      id: 'categories',
      title: 'Categories',
      icon: faTags,
      count: counts.categories,
      description: 'Manage task categories and labels',
      color: 'text-red-500'
    },
    {
      id: 'slas',
      title: 'SLAs',
      icon: faStopwatch,
      count: counts.slas,
      description: 'Manage service level agreements',
      color: 'text-teal-500'
    },
    {
      id: 'priorities',
      title: 'Priorities',
      icon: faArrowUpWideShort,
      count: counts.priorities,
      description: 'Manage priority levels',
      color: 'text-rose-500'
    },
    {
      id: 'statuses',
      title: 'Statuses',
      icon: faSitemap,
      count: counts.statuses,
      description: 'Manage statuses and transitions',
      color: 'text-amber-500'
    },
    {
      id: 'forms',
      title: 'Forms',
      icon: faClipboardList,
      count: counts.forms,
      description: 'Manage forms and submissions',
      color: 'text-pink-500'
    },
    {
      id: 'templates',
      title: 'Templates',
      icon: faClipboardList,
      count: counts.templates,
      description: 'Manage task templates',
      color: 'text-blue-500'
    },
    {
      id: 'spots',
      title: 'Spots',
      icon: faLocationDot,
      count: counts.spots,
      description: 'Set up locations and spot management',
      color: 'text-green-500'
    },
    {
      id: 'teams',
      title: 'Teams',
      icon: faUsers,
      count: counts.teams,
      description: 'Organize and manage work teams',
      color: 'text-purple-500'
    },
    {
      id: 'users',
      title: 'Users',
      icon: faUser,
      count: counts.users,
      description: 'User accounts and permissions',
      color: 'text-indigo-500'
    }
  ];
  const settingsById = useMemo(() => new Map(settingsOptions.map(s => [s.id, s] as const)), [settingsOptions]);

  // Keep slot IDs stable across reorders
  const slotIdsRef = useRef<string[]>([]);

  // Initialize and persist card order (run before paint to avoid default flash)
  useLayoutEffect(() => {
    const storageKey = 'wh-settings-card-order-v1';
    const reorderKey = 'wh-settings-reorder-mode-v1';
    try {
      const saved = localStorage.getItem(storageKey);
      const defaultOrder = settingsOptions.map(s => s.id);
      if (!slotIdsRef.current.length) {
        slotIdsRef.current = [...defaultOrder];
      }
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        const idSet = new Set(defaultOrder);
        const cleaned = parsed.filter(id => idSet.has(id));
        const missing = defaultOrder.filter(id => !cleaned.includes(id));
        const merged = [...cleaned, ...missing];
        setCardOrder(merged);
        // Prime slotItemMap synchronously
        setSlotItemMap(slotIdsRef.current.map((slotId, i) => [slotId, merged[i] ?? slotId] as [string, string]));
      } else {
        setCardOrder(defaultOrder);
        setSlotItemMap(slotIdsRef.current.map((slotId, i) => [slotId, defaultOrder[i] ?? slotId] as [string, string]));
      }
      const savedReorder = localStorage.getItem(reorderKey);
      if (savedReorder != null) {
        // setReorderMode(savedReorder === 'true'); // This line is removed
      }
      hydratedRef.current = true;
    } catch {
      setCardOrder(settingsOptions.map(s => s.id));
    }
  }, []);

  const defaultOrder = useMemo(() => settingsOptions.map(s => s.id), [settingsOptions]);
  const slotIds = slotIdsRef.current.length ? slotIdsRef.current : defaultOrder;
  const currentItemOrder = cardOrder.length ? cardOrder : defaultOrder;

  // Compute a stable slotId -> itemId map for rendering
  const slotToItem = useMemo(() => {
    const map = new Map<string, string>();
    if (slotItemMap.length) {
      for (const [slotId, itemId] of slotItemMap) map.set(slotId, itemId);
    } else {
      for (let i = 0; i < slotIds.length; i++) {
        map.set(slotIds[i], currentItemOrder[i] ?? slotIds[i]);
      }
    }
    return map;
  }, [slotItemMap, slotIds.join(','), currentItemOrder.join(',')]);

  // Do not auto-override slotItemMap after hydration; it is the source of truth

  const saveOrder = (next: string[]) => {
    setCardOrder(next);
    try { localStorage.setItem('wh-settings-card-order-v1', JSON.stringify(next)); } catch {}
  };

  // Initialize Swapy for drag-and-drop reordering
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Destroy any previous instance (defensive on fast refresh)
    swapyRef.current?.destroy?.();

    const instance = createSwapy(container, {
      // Default Swapy behavior with animations and DOM swapping
    });
    swapyRef.current = instance;

    // helper removed; we read DOM in onSwapEnd

    // Track swapping lifecycle and only persist order on end
    const offBefore = (instance as any).onBeforeSwap?.(() => true);
    const offStart = (instance as any).onSwapStart?.(() => { draggingRef.current = true; setIsSwapping(true); });
    const offEnd = (instance as any).onSwapEnd?.(() => {
      // Read the definitive DOM state after Swapy completes
      requestAnimationFrame(() => {
        try {
          const slotEls = Array.from(container.querySelectorAll('[data-swapy-slot]')) as HTMLElement[];
          const map = new Map<string, string>();
          for (const el of slotEls) {
            const sid = el.getAttribute('data-swapy-slot') || '';
            const itemEl = el.querySelector('[data-swapy-item]') as HTMLElement | null;
            const iid = itemEl?.getAttribute('data-swapy-item');
            if (sid && iid) map.set(sid, iid);
          }
          const nextOrder: string[] = slotIdsRef.current.map((sid) => map.get(sid) || sid);
          saveOrder(nextOrder);
        } finally {
          draggingRef.current = false;
          setIsSwapping(false);
        }
      });
    });

    return () => {
      try { offBefore?.(); } catch {}
      try { offStart?.(); } catch {}
      try { offEnd?.(); } catch {}
      try { instance.destroy(); } catch {}
      swapyRef.current = null;
    };
  }, []);

  const handleSettingClick = (settingId: string) => {
    console.log(`Clicked on ${settingId}`);
    
    // Navigate to specific setting pages
    switch (settingId) {
      case 'categories':
        navigate('/settings/categories');
        break;
      case 'templates':
        navigate('/settings/templates');
        break;
      case 'forms':
        navigate('/settings/forms');
        break;
      case 'priorities':
        navigate('/settings/priorities');
        break;
      case 'statuses':
        navigate('/settings/statuses');
        break;
      case 'slas':
        navigate('/settings/slas');
        break;
      case 'spots':
        navigate('/settings/spots');
        break;
      case 'teams':
        navigate('/settings/teams');
        break;
      case 'users':
        navigate('/settings/users');
        break;
      default:
        console.log(`Unknown setting: ${settingId}`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your application settings and configurations
          </p>
        </div>
      </div>

      <Separator />

      {/* Settings Grid */}
      <div className="text-sm text-muted-foreground">Drag cards to reorder.</div>
      <div ref={containerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {slotIds.map((slotId) => {
          const itemId = slotToItem.get(slotId) ?? slotId;
          const setting = settingsById.get(itemId);
          if (!setting) return null;
          return (
          <div key={slotId} data-swapy-slot={slotId} className="h-full">
            <div data-swapy-item={itemId} className="h-full">
              <Card
                className={`cursor-pointer transition-all duration-200 group select-none hover:shadow-lg hover:scale-[1.02] h-[180px] overflow-hidden`}
                onMouseDown={(e) => { if (!isSwapping) e.preventDefault(); }}
                onClick={(e) => { if (draggingRef.current || isSwapping) { e.preventDefault(); e.stopPropagation(); return; } handleSettingClick(setting.id); }}
              >
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`text-4xl ${setting.color} group-hover:scale-110 transition-transform duration-200`}>
                      <FontAwesomeIcon icon={setting.icon} />
                    </div>
                    <div className="flex items-center gap-2">
                      {typeof setting.count !== 'undefined' && (
                        <Badge variant="outline" className="font-semibold text-xs px-2 py-0.5 opacity-80">
                          {setting.count}
                        </Badge>
                      )}
                      <div className={`transition flex items-center text-muted-foreground opacity-60 hover:opacity-100`} title="Drag to reorder">
                        <FontAwesomeIcon icon={faGripVertical} className={`text-sm`} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="text-xl">{setting.title}</CardTitle>
                    <CardDescription>{setting.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </div>
          </div>
          );
        })}
      </div>

      

      
      
    </div>
  );
}

export default Settings;