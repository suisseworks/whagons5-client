
import { useEffect, useMemo, useRef } from "react";
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
import { createSwapy, SlotItemMapArray, Swapy, utils } from 'swapy';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/animated/Tabs";


const STORAGE_KEYS = {
  basic: 'wh-settings-basics-order-v1',
  advanced: 'wh-settings-advanced-order-v1'
} as const;

const loadOrder = (key: string): string[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((id: any) => String(id)) : [];
  } catch {
    return [];
  }
};

const saveOrder = (key: string, ids: string[]) => {
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch { }
};


function Settings() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<string>('basics');





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
  const didMoveRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  // const workflows = useSelector((s: RootState) => s.workflows.value);

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
      // workflows: workflows.length,
    };
  }, [categories.length, templates.length, teams.length, spots.length, statuses.length, priorities.length, slas.length, users.length, forms.length]);

  const basicSettings = useMemo(() => [
    {
      id: 'categories',
      title: 'Categories',
      icon: faTags,
      count: counts.categories,
      description: 'Manage task categories and labels',
      color: 'text-red-500'
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
      id: 'priorities',
      title: 'Priorities',
      icon: faArrowUpWideShort,
      count: counts.priorities,
      description: 'Manage priority levels',
      color: 'text-rose-500'
    },

  ], [counts.categories, counts.templates, counts.spots, counts.teams, counts.users, counts.statuses, counts.priorities]);
  // Settings configuration data
  const advancedSettings = useMemo(() => [

    {
      id: 'slas',
      title: 'SLAs',
      icon: faStopwatch,
      count: counts.slas,
      description: 'Manage service level agreements',
      color: 'text-teal-500'
    },


    {
      id: 'forms',
      title: 'Forms',
      icon: faClipboardList,
      count: counts.forms,
      description: 'Manage forms and submissions',
      color: 'text-pink-500'
    },
    // {
    //   id: 'workflows',
    //   title: 'Workflows',
    //   icon: faDiagramProject,
    //   count: counts.workflows,
    //   description: 'Design and automate workflows',
    //   color: 'text-cyan-500'
    // },
  ], [counts.slas, counts.forms]);

  //set up maps for swapy
  const [advancedSettingsMap, setAdvancedSettingsMap] = useState<SlotItemMapArray>(() => {
    const currentIds = advancedSettings.map(s => s.id);
    const saved = loadOrder(STORAGE_KEYS.advanced);
    const merged = [...saved.filter(id => currentIds.includes(id)), ...currentIds.filter(id => !saved.includes(id))];
    return merged.map(id => ({ slot: id, item: id })) as SlotItemMapArray;
  });
  const [basicSlotItemMap, setBasicSlotItemMap] = useState<SlotItemMapArray>(() => {
    const currentIds = basicSettings.map(s => s.id);
    const saved = loadOrder(STORAGE_KEYS.basic);
    const merged = [...saved.filter(id => currentIds.includes(id)), ...currentIds.filter(id => !saved.includes(id))];
    return merged.map(id => ({ slot: id, item: id })) as SlotItemMapArray;
  });

  //set up items for swapy
  const advancedSettingsItems = useMemo(() => utils.toSlottedItems(advancedSettings, 'id', advancedSettingsMap), [advancedSettingsMap, advancedSettings]);
  const basicSettingsItems = useMemo(() => utils.toSlottedItems(basicSettings, 'id', basicSlotItemMap), [basicSlotItemMap, basicSettings  ]);

  //set up refs for swapy
  const advancedRef = useRef<Swapy | null>(null);
  const basicRef = useRef<Swapy | null>(null);
  const advancedContainerRef = useRef<HTMLDivElement | null>(null);
  const basicContainerRef = useRef<HTMLDivElement | null>(null);

  // //use effect to update the maps
  useEffect(() => { utils.dynamicSwapy(advancedRef.current, advancedSettings, 'id', advancedSettingsMap, setAdvancedSettingsMap); }, [advancedSettings]);
  useEffect(() => { utils.dynamicSwapy(basicRef.current,    basicSettings,    'id', basicSlotItemMap,    setBasicSlotItemMap); },    [basicSettings]);


  const initSwapy = (el: HTMLDivElement | null, ref: React.MutableRefObject<Swapy|null>, setMap: (m: SlotItemMapArray) => void, key: string) => {
    if (!el || !el.isConnected) return;
    console.log('el', el);
    ref.current?.destroy?.();
    const inst = createSwapy(el, { manualSwap: true });
    ref.current = inst;
    inst.onSwap?.(e => setMap(e.newSlotItemMap.asArray));
    inst.onSwapEnd?.(({ hasChanged, slotItemMap }) => {
      if (!hasChanged || !slotItemMap) return;
      const ids = slotItemMap.asArray.map(({ item }) => item);
      saveOrder(key, ids);
    });
  };



  useEffect(() => {
    if (tab !== 'advanced') { basicRef.current?.destroy?.(); basicRef.current = null; return; }
    const raf = requestAnimationFrame(() =>{
      //must grab ref manually because basicRef ref gets destroyed by tab change
      const advancedContainer = document.querySelector('[data-swapy-container="advanced"]');
      console.log('advancedContainer', advancedContainer);
      //create react ref
      advancedContainerRef.current = advancedContainer as HTMLDivElement;
      initSwapy(advancedContainerRef.current, advancedRef, setAdvancedSettingsMap, STORAGE_KEYS.advanced)
    });
    return () => { cancelAnimationFrame(raf); basicRef.current?.destroy?.(); basicRef.current = null; };
  }, [tab, advancedSettingsItems.length]);


  useEffect(() => {
    if (tab !== 'basics') { basicRef.current?.destroy?.(); basicRef.current = null; return; }
    const raf = requestAnimationFrame(() =>{
      //must grab ref manually because basicRef ref gets destroyed by tab change
      const basicContainer = document.querySelector('[data-swapy-container="basic"]');
      console.log('basicContainer', basicContainer);
      //create react ref
      basicContainerRef.current = basicContainer as HTMLDivElement;
      initSwapy(basicContainerRef.current, basicRef, setBasicSlotItemMap, STORAGE_KEYS.basic)
    });
    return () => { cancelAnimationFrame(raf); basicRef.current?.destroy?.(); basicRef.current = null; };
  }, [tab, basicSettingsItems.length]);








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
          <div 
          data-swapy-container="basic"
          ref={basicContainerRef} 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {basicSettingsItems.map(({ slotId, itemId, item }) => (
              <div key={slotId} data-swapy-slot={slotId} className="h-full">
                {item && (
                  <div data-swapy-item={itemId} key={itemId} className="h-full">
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
                        handleSettingClick(item.id);
                      }
                    }}
                    >
                      <CardHeader className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className={`text-4xl ${item.color} group-hover:scale-110 transition-transform duration-200`}>
                            <FontAwesomeIcon icon={item.icon} />
                          </div>
                          <div className="flex items-center gap-2">
                            {typeof item.count !== 'undefined' && (
                              <Badge variant="outline" className="font-semibold text-xs px-2 py-0.5 opacity-80">
                                {item.count}
                              </Badge>
                            )}
                            <div className={`transition flex items-center text-muted-foreground opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing`} title="Drag to reorder">
                              <FontAwesomeIcon icon={faGripVertical} className={`text-sm`} />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <CardTitle className="text-xl">{item.title}</CardTitle>
                          <CardDescription>{item.description}</CardDescription>
                        </div>
                      </CardHeader>
                    </Card>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="advanced">
          <div 
          data-swapy-container="advanced"
          ref={advancedContainerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {advancedSettingsItems.map(({ slotId, itemId, item }) => (
              <div key={slotId} data-swapy-slot={slotId} className="h-full">
                {item && (
                  <div data-swapy-item={itemId} key={itemId} className="h-full">
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
                        handleSettingClick(item.id);
                      }
                    }}
                    >
                      <CardHeader className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className={`text-4xl ${item.color} group-hover:scale-110 transition-transform duration-200`}>
                            <FontAwesomeIcon icon={item.icon} />
                          </div>
                          <div className="flex items-center gap-2">
                            {typeof item.count !== 'undefined' && (
                              <Badge variant="outline" className="font-semibold text-xs px-2 py-0.5 opacity-80">
                                {item.count}
                              </Badge>
                            )}
                            <div className={`transition flex items-center text-muted-foreground opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing`} title="Drag to reorder">
                              <FontAwesomeIcon icon={faGripVertical} className={`text-sm`} />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <CardTitle className="text-xl">{item.title}</CardTitle>
                          <CardDescription>{item.description}</CardDescription>
                        </div>
                      </CardHeader>
                    </Card>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>





    </div>
  );
}

export default Settings;