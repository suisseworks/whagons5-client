
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion } from 'motion/react';
import { Search, Clock } from "lucide-react";
import { SETTINGS_TAB_ANIMATION, getSettingsTabInitialX } from '@/config/tabAnimation';
import type { SettingsTabKey } from '@/config/tabAnimation';

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
  faLayerGroup,
  faStar as faStarSolid
} from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarRegular } from "@fortawesome/free-regular-svg-icons";
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
import { useLanguage } from "@/providers/LanguageProvider";
import { genericActions } from "@/store/genericSlices";


const STORAGE_KEYS = {
  basic: 'wh-settings-basics-order-v1',
  advanced: 'wh-settings-advanced-order-v1',
  favorites: 'wh-settings-favorites-v1'
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
  dragHandleLabel: string;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  favoriteLabel: string;
  unfavoriteLabel: string;
  favoriteBadgeLabel: string;
  showFavoriteButton?: boolean;
  showFavoriteBadge?: boolean;
  favoriteButtonAlwaysVisible?: boolean;
}

interface SettingCardDisplayProps {
  setting: SettingCard;
  onSettingClick: (id: string) => void;
  showDragHandle?: boolean;
  dragHandleLabel?: string;
  isDragging?: boolean;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  favoriteLabel: string;
  unfavoriteLabel: string;
  favoriteBadgeLabel: string;
  showFavoriteButton?: boolean;
  showFavoriteBadge?: boolean;
  favoriteButtonAlwaysVisible?: boolean;
}

function SettingCardDisplay({
  setting,
  onSettingClick,
  showDragHandle = false,
  dragHandleLabel,
  isDragging = false,
  isFavorite,
  onToggleFavorite,
  favoriteLabel,
  unfavoriteLabel,
  favoriteBadgeLabel,
  showFavoriteButton = true,
  showFavoriteBadge = true,
  favoriteButtonAlwaysVisible = false,
}: SettingCardDisplayProps) {
  const favoriteTitle = isFavorite ? unfavoriteLabel : favoriteLabel;

  return (
    <Card
      className={`transition-all duration-300 group select-none hover:shadow-xl hover:scale-[1.03] hover:-translate-y-1 h-[180px] overflow-hidden border-2 hover:border-primary/20 ${isDragging ? 'shadow-lg scale-[1.02]' : ''}`}
      onClick={(e) => {
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
            {showDragHandle && (
              <div
                className="transition flex items-center text-muted-foreground opacity-60"
                title={dragHandleLabel}
              >
                <FontAwesomeIcon icon={faGripVertical} className="text-sm" />
              </div>
            )}
            {showFavoriteButton && (
              <button
                type="button"
                className={`rounded-full p-2 transition text-sm ${
                  favoriteButtonAlwaysVisible || isFavorite
                    ? ''
                    : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto'
                } ${
                  isFavorite ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'
                }`}
                aria-label={favoriteTitle}
                aria-pressed={isFavorite}
                title={favoriteTitle}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(setting.id);
                }}
              >
                <FontAwesomeIcon icon={isFavorite ? faStarSolid : faStarRegular} className="text-base" />
              </button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {showFavoriteBadge && isFavorite && (
            <div
              className="inline-flex items-center text-yellow-600"
              title={favoriteBadgeLabel}
              role="img"
              aria-label={favoriteBadgeLabel}
            >
              <FontAwesomeIcon icon={faStarSolid} className="text-sm" />
            </div>
          )}
          <CardTitle className="text-2xl font-bold">{setting.title}</CardTitle>
          <CardDescription>{setting.description}</CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
}

function SortableSettingCard({
  setting,
  onSettingClick,
  dragHandleLabel,
  isFavorite,
  onToggleFavorite,
  favoriteLabel,
  unfavoriteLabel,
  favoriteBadgeLabel,
  showFavoriteButton = true,
  showFavoriteBadge = true,
  favoriteButtonAlwaysVisible = false,
}: SortableSettingCardProps) {
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
      <SettingCardDisplay
        setting={setting}
        onSettingClick={onSettingClick}
        showDragHandle
        dragHandleLabel={dragHandleLabel}
        isDragging={isDragging}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        favoriteLabel={favoriteLabel}
        unfavoriteLabel={unfavoriteLabel}
        favoriteBadgeLabel={favoriteBadgeLabel}
        showFavoriteButton={showFavoriteButton}
        showFavoriteBadge={showFavoriteBadge}
        favoriteButtonAlwaysVisible={favoriteButtonAlwaysVisible}
      />
    </div>
  );
}


const SETTINGS_TAB_STORAGE_KEY = 'wh_settings_last_tab';
const RECENTLY_ACCESSED_KEY = 'wh_settings_recently_accessed';
const MAX_RECENT_ITEMS = 5;

function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { t } = useLanguage();
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Load last selected tab from localStorage, or default to 'basics'
  const [activeTab, setActiveTab] = useState<SettingsTabKey>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_TAB_STORAGE_KEY);
      if (saved === 'advanced' || saved === 'basics' || saved === 'favorites') {
        return saved as SettingsTabKey;
      }
    } catch {}
    return 'basics';
  });
  
  const [prevActiveTab, setPrevActiveTab] = useState<SettingsTabKey>(activeTab);
  
  // Recently accessed settings
  const [recentlyAccessed, setRecentlyAccessed] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENTLY_ACCESSED_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  // Track setting access
  const trackSettingAccess = (settingId: string) => {
    setRecentlyAccessed((prev) => {
      const filtered = prev.filter(id => id !== settingId);
      const updated = [settingId, ...filtered].slice(0, MAX_RECENT_ITEMS);
      try {
        localStorage.setItem(RECENTLY_ACCESSED_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };
  
  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Press "/" to focus search
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
      // Press Escape to clear search
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  // Sync activeTab with URL on initial load (URL takes precedence)
  // If no tab in URL and we're on the main settings page, restore from localStorage and update URL
  useEffect(() => {
    try {
      // Only restore tab if we're on the exact /settings path (not a subpage)
      if (location.pathname !== '/settings') {
        return;
      }
      
      const urlParams = new URLSearchParams(window.location.search);
      const tabFromUrl = urlParams.get('tab');
      if (tabFromUrl === 'advanced' || tabFromUrl === 'basics' || tabFromUrl === 'favorites') {
        setActiveTab(tabFromUrl as SettingsTabKey);
        setPrevActiveTab(tabFromUrl as SettingsTabKey);
      } else {
        // No tab in URL - restore from localStorage and update URL
        const saved = localStorage.getItem(SETTINGS_TAB_STORAGE_KEY);
        if (saved === 'advanced' || saved === 'basics' || saved === 'favorites') {
          const savedTab = saved as SettingsTabKey;
          setActiveTab(savedTab);
          setPrevActiveTab(savedTab);
          // Update URL to reflect the saved tab
          urlParams.set('tab', savedTab);
          navigate(`/settings?${urlParams.toString()}`, { replace: true });
        }
      }
    } catch {}
  }, [navigate, location.pathname]);





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
  const approvals = useSelector((s: RootState) => s.approvals?.value ?? []);
  const spots = useSelector((s: RootState) => s.spots?.value ?? []);
  const tags = useSelector((s: RootState) => s.tags?.value ?? []);
  const workflows = useSelector((s: RootState) => (s as any).workflows?.value ?? []);

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
      workflows: workflows.length,
      approvals: approvals.length,
    };
  }, [categories.length, templates.length, teams.length, workspaces.length, spots.length, statuses.length, tags.length, priorities.length, slas.length, users.length, forms.length, workflows.length, approvals.length]);

  const basicSettings = useMemo(() => [
    {
      id: 'categories',
      title: t('settings.cards.categories.title', 'Categories'),
      icon: faLayerGroup,
      count: counts.categories,
      description: t('settings.cards.categories.description', 'Manage task categories and labels'),
      color: 'text-red-500'
    },
    {
      id: 'tags',
      title: t('settings.cards.tags.title', 'Tags'),
      icon: faTags,
      count: counts.tags,
      description: t('settings.cards.tags.description', 'Manage task tags'),
      color: 'text-fuchsia-500'
    },
    {
      id: 'templates',
      title: t('settings.cards.templates.title', 'Templates'),
      icon: faClipboardList,
      count: counts.templates,
      description: t('settings.cards.templates.description', 'Manage task templates'),
      color: 'text-blue-500'
    },
    {
      id: 'workspaces',
      title: t('settings.cards.workspaces.title', 'Workspaces'),
      icon: faDiagramProject,
      count: counts.workspaces,
      description: t('settings.cards.workspaces.description', 'Manage workspaces and projects'),
      color: 'text-cyan-500'
    },
    {
      id: 'spots',
      title: t('settings.cards.spots.title', 'Spots'),
      icon: faLocationDot,
      count: counts.spots,
      description: t('settings.cards.spots.description', 'Set up locations and spot management'),
      color: 'text-green-500'
    },
    {
      id: 'teams',
      title: t('settings.cards.teams.title', 'Teams'),
      icon: faUsers,
      count: counts.teams,
      description: t('settings.cards.teams.description', 'Organize and manage work teams'),
      color: 'text-purple-500'
    },
    {
      id: 'users',
      title: t('settings.cards.users.title', 'Users'),
      icon: faUser,
      count: counts.users,
      description: t('settings.cards.users.description', 'User accounts and permissions'),
      color: 'text-indigo-500'
    },
    {
      id: 'statuses',
      title: t('settings.cards.statuses.title', 'Statuses'),
      icon: faSitemap,
      count: counts.statuses,
      description: t('settings.cards.statuses.description', 'Manage statuses and transitions'),
      color: 'text-amber-500'
    },
    {
      id: 'priorities',
      title: t('settings.cards.priorities.title', 'Priorities'),
      icon: faArrowUpWideShort,
      count: counts.priorities,
      description: t('settings.cards.priorities.description', 'Manage priority levels'),
      color: 'text-rose-500'
    },

  ], [counts.categories, counts.tags, counts.templates, counts.workspaces, counts.spots, counts.teams, counts.users, counts.statuses, counts.priorities, t]);

  // Settings configuration data
  const advancedSettings = useMemo(() => [
    {
      id: 'slas',
      title: t('settings.cards.slas.title', 'SLAs'),
      icon: faStopwatch,
      count: counts.slas,
      description: t('settings.cards.slas.description', 'Manage service level agreements'),
      color: 'text-teal-500'
    },


    {
      id: 'forms',
      title: t('settings.cards.forms.title', 'Forms'),
      icon: faClipboardList,
      count: counts.forms,
      description: t('settings.cards.forms.description', 'Manage forms and submissions'),
      color: 'text-pink-500'
    },
    {
      id: 'approvals',
      title: t('settings.cards.approvals.title', 'Approvals'),
      icon: faSquareCheck,
      count: counts.approvals,
      description: t('settings.cards.approvals.description', 'Configure task approvals'),
      color: 'text-emerald-500'
    },
    
    {
      id: 'workflows',
      title: t('settings.cards.workflows.title', 'Workflows'),
      icon: faDiagramProject,
      count: counts.workflows,
      description: t('settings.cards.workflows.description', 'Design and automate workflows'),
      color: 'text-cyan-500'
    },
    {
      id: 'schedules',
      title: t('settings.cards.schedules.title', 'Schedules'),
      icon: faCalendar,
      count: 0,
      description: t('settings.cards.schedules.description', 'Manage schedules and time-based workflows'),
      color: 'text-orange-500'
    },
    {
      id: 'motivation',
      title: t('settings.cards.motivation.title', 'Motivation'),
      icon: faRocket,
      count: 0,
      description: t('settings.cards.motivation.description', 'Configure motivation and engagement settings'),
      color: 'text-yellow-500'
    },
    {
      id: 'gamification',
      title: t('settings.cards.gamification.title', 'Gamification'),
      icon: faTrophy,
      count: 0,
      description: t('settings.cards.gamification.description', 'Set up gamification elements and rewards'),
      color: 'text-purple-500'
    },
  ], [counts.slas, counts.forms, counts.workflows, t]);

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

  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadOrder(STORAGE_KEYS.favorites));

  const allSettingsById = useMemo<Record<string, SettingCard>>(() => {
    const map: Record<string, SettingCard> = {};
    [...basicSettings, ...advancedSettings].forEach((setting) => {
      map[setting.id] = setting;
    });
    return map;
  }, [basicSettings, advancedSettings]);

  useEffect(() => {
    setFavoriteIds((prev) => {
      const filtered = prev.filter((id) => allSettingsById[id]);
      if (filtered.length === prev.length && filtered.every((id, idx) => id === prev[idx])) {
        return prev;
      }
      saveOrder(STORAGE_KEYS.favorites, filtered);
      return filtered;
    });
  }, [allSettingsById]);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const favoriteSettings = useMemo(() => {
    return favoriteIds
      .map((id) => allSettingsById[id])
      .filter((setting): setting is SettingCard => Boolean(setting));
  }, [favoriteIds, allSettingsById]);

  const favoriteSortableIds = useMemo(() => favoriteSettings.map((setting) => setting.id), [favoriteSettings]);

  const handleToggleFavorite = (settingId: string) => {
    setFavoriteIds((prev) => {
      const exists = prev.includes(settingId);
      const updated = exists ? prev.filter((id) => id !== settingId) : [...prev, settingId];
      saveOrder(STORAGE_KEYS.favorites, updated);
      return updated;
    });
  };

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

  const handleFavoritesDragEnd = (event: DragEndEvent) => {
    handleDragEnd(event, () => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = favoriteIds.indexOf(String(active.id));
      const newIndex = favoriteIds.indexOf(String(over.id));

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(favoriteIds, oldIndex, newIndex);
        setFavoriteIds(newOrder);
        saveOrder(STORAGE_KEYS.favorites, newOrder);
      }
    });
  };

  // IDs for SortableContext
  const basicIds = useMemo(() => orderedBasicSettings.map(s => s.id), [orderedBasicSettings]);
  const advancedIds = useMemo(() => orderedAdvancedSettings.map(s => s.id), [orderedAdvancedSettings]);








  // Filter settings based on search query
  const filterSettings = (settings: SettingCard[]) => {
    if (!searchQuery.trim()) return settings;
    const query = searchQuery.toLowerCase().trim();
    return settings.filter(setting => 
      setting.title.toLowerCase().includes(query) ||
      setting.description.toLowerCase().includes(query) ||
      setting.id.toLowerCase().includes(query)
    );
  };

  const filteredBasicSettings = useMemo(() => filterSettings(orderedBasicSettings), [orderedBasicSettings, searchQuery]);
  const filteredAdvancedSettings = useMemo(() => filterSettings(orderedAdvancedSettings), [orderedAdvancedSettings, searchQuery]);
  const filteredFavoriteSettings = useMemo(() => filterSettings(favoriteSettings), [favoriteSettings, searchQuery]);

  // Get recently accessed settings
  const recentSettings = useMemo(() => {
    return recentlyAccessed
      .map(id => allSettingsById[id])
      .filter((setting): setting is SettingCard => Boolean(setting))
      .slice(0, MAX_RECENT_ITEMS);
  }, [recentlyAccessed, allSettingsById]);

  // Calculate total stats
  const totalStats = useMemo(() => {
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return {
      total,
      topCategories: [
        { name: 'Teams', count: counts.teams },
        { name: 'Users', count: counts.users },
        { name: 'Tags', count: counts.tags },
        { name: 'Categories', count: counts.categories },
      ].filter(item => item.count > 0).slice(0, 3)
    };
  }, [counts]);

  const handleSettingClick = (settingId: string) => {
    // Track access
    trackSettingAccess(settingId);

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
      case 'global':
        navigate('/settings/global');
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
  const dragHint = t('settings.cards.dragHint', 'Drag cards to reorder.');
  const dragHandleLabel = t('settings.cards.dragHandle', 'Drag to reorder');
  const favoriteAddLabel = t('settings.cards.favorite.add', 'Add to favorites');
  const favoriteRemoveLabel = t('settings.cards.favorite.remove', 'Remove from favorites');
  const favoriteBadgeLabel = t('settings.cards.favorite.badge', 'Favorite');
  const favoritesEmptyLabel = t('settings.cards.favorites.empty', 'Star a settings card to see it here.');
  const favoritesHelperLabel = t('settings.cards.favorites.helper', 'Use the star icon on any card to pin it to this list.');


  const mainSettingsTabs = [
    {
      value: 'favorites',
      label: t('settings.tabs.favorites', 'Favorites'),
      content: (
        <motion.div
          className="space-y-4 flex-1 h-full"
          key="favorites"
          initial={{ x: getSettingsTabInitialX(prevActiveTab, 'favorites') }}
          animate={{ x: 0 }}
          transition={SETTINGS_TAB_ANIMATION.transition}
        >
          <div className="space-y-4">
            {filteredFavoriteSettings.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-muted/50 bg-muted/20 p-10 text-center text-muted-foreground">
                {searchQuery ? (
                  <>
                    <Search className="mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="font-medium">No favorites match your search</p>
                    <p className="text-sm">Try a different search term</p>
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faStarSolid} className="mb-3 text-2xl text-yellow-500" />
                    <p className="font-medium">{favoritesEmptyLabel}</p>
                    <p className="text-sm">{favoritesHelperLabel}</p>
                  </>
                )}
              </div>
            ) : (
              <>
                {!searchQuery && <div className="text-sm text-muted-foreground">{dragHint}</div>}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleFavoritesDragEnd}
                >
                  <SortableContext items={favoriteSortableIds} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {filteredFavoriteSettings.map((setting) => (
                        <SortableSettingCard
                          key={setting.id}
                          setting={setting}
                          onSettingClick={handleSettingClick}
                          dragHandleLabel={dragHandleLabel}
                          isFavorite
                          onToggleFavorite={handleToggleFavorite}
                          favoriteLabel={favoriteAddLabel}
                          unfavoriteLabel={favoriteRemoveLabel}
                          favoriteBadgeLabel={favoriteBadgeLabel}
                          showFavoriteBadge={false}
                          favoriteButtonAlwaysVisible
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </>
            )}
          </div>
        </motion.div>
      )
    },
    {
      value: 'basics',
      label: t('settings.tabs.basics', 'Basics'),
      content: (
        <motion.div
          className="space-y-4 flex-1 h-full"
          key="basics"
          initial={{ x: getSettingsTabInitialX(prevActiveTab, 'basics') }}
          animate={{ x: 0 }}
          transition={SETTINGS_TAB_ANIMATION.transition}
        >
          <div className="space-y-4">
            {!searchQuery && <div className="text-sm text-muted-foreground">{dragHint}</div>}
            {filteredBasicSettings.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-muted/50 bg-muted/20 p-10 text-center text-muted-foreground">
                <Search className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="font-medium">No basic settings match your search</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleBasicDragEnd}
              >
                <SortableContext items={basicIds} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredBasicSettings.map((setting) => (
                    <SortableSettingCard
                      key={setting.id}
                      setting={setting}
                      onSettingClick={handleSettingClick}
                      dragHandleLabel={dragHandleLabel}
                      isFavorite={favoriteSet.has(setting.id)}
                      onToggleFavorite={handleToggleFavorite}
                      favoriteLabel={favoriteAddLabel}
                      unfavoriteLabel={favoriteRemoveLabel}
                      favoriteBadgeLabel={favoriteBadgeLabel}
                      showFavoriteBadge={false}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            )}
          </div>
        </motion.div>
      )
    },
    {
      value: 'advanced',
      label: t('settings.tabs.advanced', 'Advanced'),
      content: (
        <motion.div
          className="space-y-4 flex-1 h-full"
          key="advanced"
          initial={{ x: getSettingsTabInitialX(prevActiveTab, 'advanced') }}
          animate={{ x: 0 }}
          transition={SETTINGS_TAB_ANIMATION.transition}
        >
          <div className="space-y-4">
            {!searchQuery && <div className="text-sm text-muted-foreground">{dragHint}</div>}
            {filteredAdvancedSettings.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-muted/50 bg-muted/20 p-10 text-center text-muted-foreground">
                <Search className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="font-medium">No advanced settings match your search</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleAdvancedDragEnd}
              >
                <SortableContext items={advancedIds} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredAdvancedSettings.map((setting) => (
                      <SortableSettingCard
                        key={setting.id}
                        setting={setting}
                        onSettingClick={handleSettingClick}
                        dragHandleLabel={dragHandleLabel}
                        isFavorite={favoriteSet.has(setting.id)}
                        onToggleFavorite={handleToggleFavorite}
                        favoriteLabel={favoriteAddLabel}
                        unfavoriteLabel={favoriteRemoveLabel}
                        favoriteBadgeLabel={favoriteBadgeLabel}
                        showFavoriteBadge={false}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </motion.div>
      )
    }
  ];

  return (
    <div className="p-4 pt-0 space-y-4">
      {/* Header with Title, Stats, and Search */}
      <div className="space-y-4 pb-4 border-b border-border/40">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start space-x-4 flex-1">
            <FontAwesomeIcon
              icon={faCog}
              className="text-4xl text-primary flex-shrink-0 mt-1"
            />
            <div className="flex flex-col flex-1 min-w-0">
              <h1 className="text-4xl font-extrabold tracking-tight text-foreground leading-tight">Settings</h1>
              <p className="text-sm text-muted-foreground/80 leading-relaxed mt-2">
                Configure and manage your workspace settings
              </p>
              {/* Quick Stats */}
              {totalStats.total > 0 && (
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <Badge variant="outline" className="text-xs font-semibold">
                    {totalStats.total.toLocaleString()} Total Items
                  </Badge>
                  {totalStats.topCategories.map((item) => (
                    <Badge key={item.name} variant="secondary" className="text-xs">
                      {item.name}: {item.count}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="flex-shrink-0">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search settings... (Press /)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  Esc
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {filteredBasicSettings.length + filteredAdvancedSettings.length + filteredFavoriteSettings.length} results
              </p>
            )}
          </div>
        </div>
        
        {/* Recently Accessed */}
        {recentSettings.length > 0 && !searchQuery && (
          <div className="flex items-center gap-2 pt-2 border-t border-border/20">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Recently accessed:</span>
            <div className="flex items-center gap-2 flex-wrap">
              {recentSettings.map((setting) => (
                <button
                  key={setting.id}
                  onClick={() => handleSettingClick(setting.id)}
                  className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                >
                  <FontAwesomeIcon icon={setting.icon} className={setting.color} />
                  {setting.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <UrlTabs
        tabs={mainSettingsTabs}
        value={activeTab}
        basePath="/settings"
        onValueChange={(value) => {
          try {
            setPrevActiveTab(activeTab);
            setActiveTab(value as SettingsTabKey);
            localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, value);
          } catch {}
        }}
      />





    </div>
  );
}

export default Settings;