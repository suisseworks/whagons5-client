
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from 'motion/react';
import { SETTINGS_TAB_ANIMATION, getSettingsTabInitialX } from '@/config/tabAnimation';

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
  faCog,
  faDiagramProject,
  faCalendar,
  faRocket,
  faTrophy,
  faSquareCheck,
  faLayerGroup
} from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UrlTabs } from "@/components/ui/url-tabs";


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

interface SettingCard {
  id: string;
  title: string;
  icon: any;
  count: number;
  description: string;
  color: string;
}

interface SortableSettingCardProps {
  setting: SettingCard;
  onSettingClick: (id: string) => void;
}

function SortableSettingCard({ setting, onSettingClick }: SortableSettingCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: setting.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, touchAction: 'none' }}
      {...listeners}
      {...attributes}
      className="h-full cursor-grab active:cursor-grabbing"
    >
      <Card
        className={`transition-all duration-200 group select-none hover:shadow-lg hover:scale-[1.02] h-[180px] overflow-hidden ${isDragging ? 'shadow-lg scale-[1.02]' : ''}`}
        onClick={(e) => {
          // Prevent navigation if dragging
          if (isDragging) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          onSettingClick(setting.id);
        }}
      >
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <div className={`text-4xl ${setting.color} group-hover:scale-110 transition-transform duration-200`}>
              <FontAwesomeIcon icon={setting.icon || faCog} />
            </div>
            <div className="flex items-center gap-2">
              {typeof setting.count !== 'undefined' && (
                <Badge variant="outline" className="font-semibold text-xs px-2 py-0.5 opacity-80">
                  {setting.count}
                </Badge>
              )}
              <div
                className={`transition flex items-center text-muted-foreground opacity-60`}
                title="Drag to reorder"
              >
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
  );
}


function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'basics' | 'advanced'>('basics');
  const [prevActiveTab, setPrevActiveTab] = useState<'basics' | 'advanced'>('basics');

  // Sync activeTab with URL on initial load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabFromUrl = urlParams.get('tab');
    if (tabFromUrl === 'advanced' || tabFromUrl === 'basics') {
      setActiveTab(tabFromUrl);
      setPrevActiveTab(tabFromUrl);
    }
  }, []);





  // Spot count now derived from Redux slice hydrated in AuthProvider

  // Select from store
  const categories = useSelector((s: RootState) => s.categories?.value ?? []);
  const templates = useSelector((s: RootState) => s.templates?.value ?? []);
  const teams = useSelector((s: RootState) => s.teams?.value ?? []);
  const workspaces = useSelector((s: RootState) => (s as any).workspaces?.value ?? []);
  const statuses = useSelector((s: RootState) => s.statuses?.value ?? []);
  const priorities = useSelector((s: RootState) => s.priorities?.value ?? []);
  const slas = useSelector((s: RootState) => s.slas?.value ?? []);
  const users = useSelector((s: RootState) => s.users?.value ?? []);
  const forms = useSelector((s: RootState) => s.forms?.value ?? []);
  const spots = useSelector((s: RootState) => s.spots?.value ?? []);
  const tags = useSelector((s: RootState) => s.tags?.value ?? []);
  // const workflows = useSelector((s: RootState) => s.workflows.value);

  const counts = useMemo(() => {
    return {
      categories: categories.length,
      templates: templates.length,
      teams: teams.length,
      workspaces: workspaces.length,
      spots: spots.length,
      statuses: statuses.length,
      tags: tags.length,
      priorities: priorities.length,
      slas: slas.length,
      users: users.length,
      forms: forms.length,
      workflows: 0,
    };
  }, [categories.length, templates.length, teams.length, workspaces.length, spots.length, statuses.length, tags.length, priorities.length, slas.length, users.length, forms.length]);

  const basicSettings = useMemo(() => [
    {
      id: 'categories',
      title: 'Categories',
      icon: faLayerGroup,
      count: counts.categories,
      description: 'Manage task categories and labels',
      color: 'text-red-500'
    },
    {
      id: 'tags',
      title: 'Tags',
      icon: faTags,
      count: counts.tags,
      description: 'Manage task tags',
      color: 'text-fuchsia-500'
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
      id: 'workspaces',
      title: 'Workspaces',
      icon: faDiagramProject,
      count: counts.workspaces,
      description: 'Manage workspaces and projects',
      color: 'text-cyan-500'
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

  ], [counts.categories, counts.tags, counts.templates, counts.workspaces, counts.spots, counts.teams, counts.users, counts.statuses, counts.priorities]);

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
    {
      id: 'approvals',
      title: 'Approvals',
      icon: faSquareCheck,
      count: 0,
      description: 'Configure task approvals',
      color: 'text-emerald-500'
    },
    
    {
      id: 'workflows',
      title: 'Workflows',
      icon: faDiagramProject,
      count: counts.workflows,
      description: 'Design and automate workflows',
      color: 'text-cyan-500'
    },
    {
      id: 'schedules',
      title: 'Schedules',
      icon: faCalendar,
      count: 0,
      description: 'Manage schedules and time-based workflows',
      color: 'text-orange-500'
    },
    {
      id: 'motivation',
      title: 'Motivation',
      icon: faRocket,
      count: 0,
      description: 'Configure motivation and engagement settings',
      color: 'text-yellow-500'
    },
    {
      id: 'gamification',
      title: 'Gamification',
      icon: faTrophy,
      count: 0,
      description: 'Set up gamification elements and rewards',
      color: 'text-purple-500'
    },
  ], [counts.slas, counts.forms]);

  // Order state management
  const [basicOrder, setBasicOrder] = useState<string[]>(() => {
    const currentIds = basicSettings.map(s => s.id);
    const saved = loadOrder(STORAGE_KEYS.basic);
    return [...saved.filter(id => currentIds.includes(id)), ...currentIds.filter(id => !saved.includes(id))];
  });

  const [advancedOrder, setAdvancedOrder] = useState<string[]>(() => {
    const currentIds = advancedSettings.map(s => s.id);
    const saved = loadOrder(STORAGE_KEYS.advanced);
    return [...saved.filter(id => currentIds.includes(id)), ...currentIds.filter(id => !saved.includes(id))];
  });

  // Update order when settings change
  useEffect(() => {
    const currentIds = basicSettings.map(s => s.id);
    const saved = loadOrder(STORAGE_KEYS.basic);
    const merged = [...saved.filter(id => currentIds.includes(id)), ...currentIds.filter(id => !saved.includes(id))];
    setBasicOrder(merged);
  }, [basicSettings.map(s => s.id).join(',')]);

  useEffect(() => {
    const currentIds = advancedSettings.map(s => s.id);
    const saved = loadOrder(STORAGE_KEYS.advanced);
    const merged = [...saved.filter(id => currentIds.includes(id)), ...currentIds.filter(id => !saved.includes(id))];
    setAdvancedOrder(merged);
  }, [advancedSettings.map(s => s.id).join(',')]);

  // Ordered settings based on saved order
  const orderedBasicSettings = useMemo(() => {
    const settingMap = new Map(basicSettings.map(s => [s.id, s]));
    return basicOrder.map(id => settingMap.get(id)).filter(Boolean) as SettingCard[];
  }, [basicSettings, basicOrder]);

  const orderedAdvancedSettings = useMemo(() => {
    const settingMap = new Map(advancedSettings.map(s => [s.id, s]));
    return advancedOrder.map(id => settingMap.get(id)).filter(Boolean) as SettingCard[];
  }, [advancedSettings, advancedOrder]);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  // Refs to track drag state and prevent scroll
  const isDraggingRef = useRef(false);
  const originalOverflowRef = useRef<string>('');
  const originalTouchActionRef = useRef<string>('');
  const originalPositionRef = useRef<string>('');
  const scrollPositionRef = useRef({ x: 0, y: 0 });
  const scrollLockAnimationFrameRef = useRef<number | null>(null);

  // Prevent scrolling during drag
  const handleDragStart = (_event: DragStartEvent) => {
    isDraggingRef.current = true;
    
    // Store original values
    originalOverflowRef.current = document.body.style.overflow || '';
    originalTouchActionRef.current = document.body.style.touchAction || '';
    originalPositionRef.current = document.body.style.position || '';
    
    // Store current scroll position
    scrollPositionRef.current = {
      x: window.scrollX || document.documentElement.scrollLeft,
      y: window.scrollY || document.documentElement.scrollTop
    };
    
    // Prevent scrolling using position: fixed trick (most reliable)
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPositionRef.current.y}px`;
    document.body.style.left = `-${scrollPositionRef.current.x}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.touchAction = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
    
    // Prevent scroll events with separate handlers for each type
    const preventTouchMove = (e: TouchEvent) => {
      if (isDraggingRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    
    const preventWheel = (e: WheelEvent) => {
      if (isDraggingRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    
    const preventScroll = (e: Event) => {
      if (isDraggingRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    
    // Lock scroll position using requestAnimationFrame (smoother and faster)
    const lockScrollPosition = () => {
      if (isDraggingRef.current) {
        // Lock window scroll
        window.scrollTo(scrollPositionRef.current.x, scrollPositionRef.current.y);
        // Lock document scroll
        document.documentElement.scrollTop = scrollPositionRef.current.y;
        document.documentElement.scrollLeft = scrollPositionRef.current.x;
        document.body.scrollTop = scrollPositionRef.current.y;
        document.body.scrollLeft = scrollPositionRef.current.x;
        
        // Continue locking
        scrollLockAnimationFrameRef.current = requestAnimationFrame(lockScrollPosition);
      }
    };
    
    // Start the scroll lock loop
    scrollLockAnimationFrameRef.current = requestAnimationFrame(lockScrollPosition);
    
    window.addEventListener('touchmove', preventTouchMove, { passive: false, capture: true });
    window.addEventListener('wheel', preventWheel, { passive: false, capture: true });
    window.addEventListener('scroll', preventScroll, { passive: false, capture: true });
    document.addEventListener('touchmove', preventTouchMove, { passive: false, capture: true });
    document.addEventListener('wheel', preventWheel, { passive: false, capture: true });
    document.addEventListener('scroll', preventScroll, { passive: false, capture: true });
    
    // Store cleanup function
    (window as any).__dragScrollPreventCleanup = () => {
      if (scrollLockAnimationFrameRef.current !== null) {
        cancelAnimationFrame(scrollLockAnimationFrameRef.current);
        scrollLockAnimationFrameRef.current = null;
      }
      window.removeEventListener('touchmove', preventTouchMove, { capture: true } as any);
      window.removeEventListener('wheel', preventWheel, { capture: true } as any);
      window.removeEventListener('scroll', preventScroll, { capture: true } as any);
      document.removeEventListener('touchmove', preventTouchMove, { capture: true } as any);
      document.removeEventListener('wheel', preventWheel, { capture: true } as any);
      document.removeEventListener('scroll', preventScroll, { capture: true } as any);
    };
  };

  const handleDragEnd = (_event: DragEndEvent, callback: () => void) => {
    isDraggingRef.current = false;
    
    // Clean up event listeners
    if ((window as any).__dragScrollPreventCleanup) {
      (window as any).__dragScrollPreventCleanup();
      delete (window as any).__dragScrollPreventCleanup;
    }
    
    // Restore scroll behavior
    const scrollY = scrollPositionRef.current.y;
    const scrollX = scrollPositionRef.current.x;
    
    document.body.style.position = originalPositionRef.current;
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.width = '';
    document.body.style.overflow = originalOverflowRef.current;
    document.body.style.touchAction = originalTouchActionRef.current;
    document.body.style.overscrollBehavior = '';
    document.documentElement.style.overflow = '';
    document.documentElement.style.touchAction = '';
    document.documentElement.style.overscrollBehavior = '';
    
    // Restore scroll position
    window.scrollTo(scrollX, scrollY);
    
    callback();
  };

  // Drag handlers
  const handleBasicDragEnd = (event: DragEndEvent) => {
    handleDragEnd(event, () => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = basicOrder.indexOf(String(active.id));
      const newIndex = basicOrder.indexOf(String(over.id));

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(basicOrder, oldIndex, newIndex);
        setBasicOrder(newOrder);
        saveOrder(STORAGE_KEYS.basic, newOrder);
      }
    });
  };

  const handleAdvancedDragEnd = (event: DragEndEvent) => {
    handleDragEnd(event, () => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = advancedOrder.indexOf(String(active.id));
      const newIndex = advancedOrder.indexOf(String(over.id));

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(advancedOrder, oldIndex, newIndex);
        setAdvancedOrder(newOrder);
        saveOrder(STORAGE_KEYS.advanced, newOrder);
      }
    });
  };

  // IDs for SortableContext
  const basicIds = useMemo(() => orderedBasicSettings.map(s => s.id), [orderedBasicSettings]);
  const advancedIds = useMemo(() => orderedAdvancedSettings.map(s => s.id), [orderedAdvancedSettings]);








  const handleSettingClick = (settingId: string) => {
    // console.log(`Clicked on ${settingId}`);

    // Navigate to specific setting pages
    switch (settingId) {
      case 'categories':
        navigate('/settings/categories');
        break;
      case 'tags':
        navigate('/settings/tags');
        break;
      case 'templates':
        navigate('/settings/templates');
        break;
      case 'workspaces':
        navigate('/settings/workspaces');
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
      case 'approvals':
        navigate('/settings/approvals');
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
      case 'schedules':
        navigate('/settings/schedules');
        break;
      case 'motivation':
        navigate('/settings/motivation');
        break;
      case 'gamification':
        navigate('/settings/gamification');
        break;
      default:
        console.log(`Unknown setting: ${settingId}`);
    }
  };

  // Define tabs for URL persistence
  const mainSettingsTabs = [
    {
      value: 'basics',
      label: 'Basics',
      content: (
        <motion.div
          className="space-y-4 flex-1 h-full"
          key="basics"
          initial={{ x: getSettingsTabInitialX(prevActiveTab, 'basics') }}
          animate={{ x: 0 }}
          transition={SETTINGS_TAB_ANIMATION.transition}
        >
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Drag cards to reorder.</div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleBasicDragEnd}
            >
              <SortableContext items={basicIds} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {orderedBasicSettings.map((setting) => (
                    <SortableSettingCard
                      key={setting.id}
                      setting={setting}
                      onSettingClick={handleSettingClick}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </motion.div>
      )
    },
    {
      value: 'advanced',
      label: 'Advanced',
      content: (
        <motion.div
          className="space-y-4 flex-1 h-full"
          key="advanced"
          initial={{ x: getSettingsTabInitialX(prevActiveTab, 'advanced') }}
          animate={{ x: 0 }}
          transition={SETTINGS_TAB_ANIMATION.transition}
        >
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Drag cards to reorder.</div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleAdvancedDragEnd}
            >
              <SortableContext items={advancedIds} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {orderedAdvancedSettings.map((setting) => (
                    <SortableSettingCard
                      key={setting.id}
                      setting={setting}
                      onSettingClick={handleSettingClick}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </motion.div>
      )
    }
  ];

  return (
    <div className="p-4 pt-0 space-y-4">
      {/* Header (collapsed) */}
      <div className="space-y-2">
      </div>

      <UrlTabs
        tabs={mainSettingsTabs}
        defaultValue="basics"
        basePath="/settings"
        onValueChange={(value) => {
          setPrevActiveTab(activeTab);
          setActiveTab(value as 'basics' | 'advanced');
        }}
      />





    </div>
  );
}

export default Settings;