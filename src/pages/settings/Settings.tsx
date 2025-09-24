 
import { useEffect, useMemo, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
 
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
  faStopwatch,
  faDiagramProject
} from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { useState } from "react";
import { createSwapy } from 'swapy';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/animated/Tabs";

function Settings() {
  const navigate = useNavigate();
  const [cardOrder, setCardOrder] = useState<string[]>([]);
  const [, setIsSwapping] = useState<boolean>(false);
  const [tab, setTab] = useState<string>('basics');
  const basicsContainerRef = useRef<HTMLDivElement | null>(null);
  const advancedContainerRef = useRef<HTMLDivElement | null>(null);
  const swapyRef = useRef<ReturnType<typeof createSwapy> | null>(null);
  const draggingRef = useRef<boolean>(false);
  const [slotItemMap, setSlotItemMap] = useState<Array<[string, string]>>([]);
  const hydratedRef = useRef<boolean>(false);
  const pointerStartRef = useRef<{x:number;y:number;t:number}|null>(null);
  const didMoveRef = useRef<boolean>(false);
  
  // Hydrate data (idempotent if already loaded)


  // Spot count now derived from Redux slice hydrated in AuthProvider

  // Select from store
  const categories = useSelector((s: RootState) => s.categories.value);
  const templates = useSelector((s: RootState) => s.templates.value);
  const teams = useSelector((s: RootState) => s.teams.value);
  const statuses = useSelector((s: RootState) => s.statuses.value);
  const priorities = useSelector((s: RootState) => s.priorities.value);
  const slas = useSelector((s: RootState) => s.slas.value);
  const users = useSelector((s: RootState) => s.users.value);
  const forms = useSelector((s: RootState) => s.forms.value);
  const spots = useSelector((s: RootState) => s.spots.value);

  const counts = useMemo(() => {
    return {
      categories: categories.length,
      templates: templates.length,
      teams: teams.length,
      spots: spots.length,
      statuses: statuses.length,
      priorities: priorities.length,
      slas: slas.length,
      users: users.length,
      forms: forms.length,
    };
  }, [categories.length, templates.length, teams.length, spots.length, statuses.length, priorities.length, slas.length, users.length, forms.length]);

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
      id: 'workflows',
      title: 'Workflows',
      icon: faDiagramProject,
      description: 'Design and automate workflows',
      color: 'text-cyan-500'
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

  // Ensure newly added settings (e.g., Workflows) are included in order/slots
  useEffect(() => {
    if (!hydratedRef.current) return;
    const ids = settingsOptions.map(s => s.id);
    // Ensure slotIdsRef includes all ids
    const missingInSlots = ids.filter(id => !slotIdsRef.current.includes(id));
    if (missingInSlots.length) {
      slotIdsRef.current = Array.from(new Set([...slotIdsRef.current, ...ids]));
    }
    // Ensure cardOrder includes all ids
    const missingInOrder = ids.filter(id => !cardOrder.includes(id));
    if (missingInOrder.length) {
      const next = [...cardOrder, ...missingInOrder];
      setCardOrder(next);
      try { localStorage.setItem('wh-settings-card-order-v1', JSON.stringify(next)); } catch {}
    }
  }, [settingsOptions, cardOrder]);

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

  // Inverse mapping for rendering subsets per tab
  const itemToSlot = useMemo(() => {
    const inverse = new Map<string, string>();
    for (const [slotId, itemId] of slotToItem.entries()) {
      inverse.set(itemId, slotId);
    }
    return inverse;
  }, [slotToItem]);

  // Tab groupings
  const advancedSet = useMemo(() => new Set<string>(['slas', 'forms', 'workflows']), []);
  const basicsSet = useMemo(() => {
    return new Set<string>(settingsOptions.map(s => s.id).filter(id => !advancedSet.has(id)));
  }, [settingsOptions, advancedSet]);

  // Do not auto-override slotItemMap after hydration; it is the source of truth

  const saveOrder = (next: string[]) => {
    setCardOrder(next);
    try { localStorage.setItem('wh-settings-card-order-v1', JSON.stringify(next)); } catch {}
  };

  // Initialize Swapy for drag-and-drop reordering
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    const setup = () => {
      const container = tab === 'basics' ? basicsContainerRef.current : advancedContainerRef.current;
      if (!container) {
        requestAnimationFrame(() => { if (!cancelled) setup(); });
        return;
      }
      const slotEls = container.querySelectorAll('[data-swapy-slot]');
      if (slotEls.length < 2) {
        requestAnimationFrame(() => { if (!cancelled) setup(); });
        return;
      }

      // Destroy any previous instance (defensive on fast refresh)
      swapyRef.current?.destroy?.();

      const instance = createSwapy(container, {
        // Default Swapy behavior with animations and DOM swapping
      });
      swapyRef.current = instance;

      // Track swapping lifecycle and only persist order on end
      const offBefore = (instance as any).onBeforeSwap?.(() => true);
      const offStart = (instance as any).onSwapStart?.(() => { draggingRef.current = true; didMoveRef.current = true; setIsSwapping(true); });
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
            const nextOrder: string[] = slotIdsRef.current.map((sid) => map.get(sid) || (slotToItem.get(sid) ?? sid));
            saveOrder(nextOrder);
          } finally {
            draggingRef.current = false;
            didMoveRef.current = false;
            setIsSwapping(false);
          }
        });
      });

      cleanup = () => {
        try { offBefore?.(); } catch {}
        try { offStart?.(); } catch {}
        try { offEnd?.(); } catch {}
        try { instance.destroy(); } catch {}
        swapyRef.current = null;
      };
    };

    setup();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [tab]);

  const handleSettingClick = (settingId: string) => {
    // console.log(`Clicked on ${settingId}`);
    
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
      case 'workflows':
        navigate('/settings/workflows');
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
    <div className="p-4 pt-0 space-y-4">
      {/* Header (collapsed) */}
      <div className="space-y-2">
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="basics">Basics</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <div className="text-sm text-muted-foreground mt-2">Drag cards to reorder.</div>

        <TabsContent value="basics">
          <div ref={basicsContainerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {currentItemOrder.filter((itemId) => basicsSet.has(itemId)).map((itemId) => {
              const slotId = itemToSlot.get(itemId) ?? itemId;
              const setting = settingsById.get(itemId);
              if (!setting) return null;
              return (
                <div key={slotId} data-swapy-slot={slotId} className="h-full">
                  <div data-swapy-item={itemId} className="h-full">
                    <Card
                      className={`cursor-pointer transition-all duration-200 group select-none hover:shadow-lg hover:scale-[1.02] h-[180px] overflow-hidden`}
                      onPointerDown={(e) => { didMoveRef.current = false; pointerStartRef.current = { x: e.clientX, y: e.clientY, t: Date.now() }; }}
                      onPointerMove={(e) => {
                        const s = pointerStartRef.current;
                        if (!s) return;
                        const dx = Math.abs(e.clientX - s.x);
                        const dy = Math.abs(e.clientY - s.y);
                        if (dx > 3 || dy > 3) {
                          didMoveRef.current = true;
                        }
                      }}
                      onPointerUp={(e) => {
                        const s = pointerStartRef.current; pointerStartRef.current = null;
                        if (!s) return;
                        const dt = Date.now() - s.t; const dx = Math.abs(e.clientX - s.x); const dy = Math.abs(e.clientY - s.y);
                        if (dt < 300 && dx < 5 && dy < 5 && !didMoveRef.current) {
                          handleSettingClick(setting.id);
                        }
                      }}
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
                            <div className={`transition flex items-center text-muted-foreground opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing`} title="Drag to reorder">
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
        </TabsContent>

        <TabsContent value="advanced">
          <div ref={advancedContainerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {currentItemOrder.filter((itemId) => advancedSet.has(itemId)).map((itemId) => {
              const slotId = itemToSlot.get(itemId) ?? itemId;
              const setting = settingsById.get(itemId);
              if (!setting) return null;
              return (
                <div key={slotId} data-swapy-slot={slotId} className="h-full">
                  <div data-swapy-item={itemId} className="h-full">
                    <Card
                      className={`cursor-pointer transition-all duration-200 group select-none hover:shadow-lg hover:scale-[1.02] h-[180px] overflow-hidden`}
                      onPointerDown={(e) => { didMoveRef.current = false; pointerStartRef.current = { x: e.clientX, y: e.clientY, t: Date.now() }; }}
                      onPointerMove={(e) => {
                        const s = pointerStartRef.current;
                        if (!s) return;
                        const dx = Math.abs(e.clientX - s.x);
                        const dy = Math.abs(e.clientY - s.y);
                        if (dx > 3 || dy > 3) {
                          didMoveRef.current = true;
                        }
                      }}
                      onPointerUp={(e) => {
                        const s = pointerStartRef.current; pointerStartRef.current = null;
                        if (!s) return;
                        const dt = Date.now() - s.t; const dx = Math.abs(e.clientX - s.x); const dy = Math.abs(e.clientY - s.y);
                        if (dt < 300 && dx < 5 && dy < 5 && !didMoveRef.current) {
                          handleSettingClick(setting.id);
                        }
                      }}
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
                            <div className={`transition flex items-center text-muted-foreground opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing`} title="Drag to reorder">
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
        </TabsContent>
      </Tabs>

      

      
      
    </div>
  );
}

export default Settings;