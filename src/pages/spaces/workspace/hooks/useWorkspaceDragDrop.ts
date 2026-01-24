import { useState, useRef, useEffect } from 'react';
import { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { reorderKpiCardsAsync } from '@/store/actions/kpiCards';
import { useDispatch } from 'react-redux';
import { useLanguage } from '@/providers/LanguageProvider';
import toast from 'react-hot-toast';
import type { AppDispatch } from '@/store/store';
import { FIXED_TABS, type WorkspaceTabKey } from '../constants';

type KpiCardEntity = {
  id: number;
  user_id?: number | null;
  workspace_id?: number | null;
  name: string;
  type: string;
  query_config: any;
  display_config: any;
  position: number;
  is_enabled: boolean;
};

export function useWorkspaceDragDrop(params: {
  customTabOrder: WorkspaceTabKey[];
  setCustomTabOrder: (order: WorkspaceTabKey[]) => void;
  headerKpiCards: KpiCardEntity[];
  setHeaderKpiCards: (cards: KpiCardEntity[]) => void;
}) {
  const { customTabOrder, setCustomTabOrder, headerKpiCards, setHeaderKpiCards } = params;
  const dispatch = useDispatch<AppDispatch>();
  const { t } = useLanguage();
  
  const [_isDraggingTab, setIsDraggingTab] = useState(false);
  const [activeKpiId, setActiveKpiId] = useState<number | null>(null);
  const headerKpiCardsRef = useRef<KpiCardEntity[]>([]);
  
  useEffect(() => {
    headerKpiCardsRef.current = headerKpiCards;
  }, [headerKpiCards]);

  const handleDragStart = () => {
    setIsDraggingTab(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setIsDraggingTab(false);
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    if (active.id === 'grid') {
      return;
    }

    const draggableTabs = customTabOrder.filter(tab => !FIXED_TABS.includes(tab) && tab !== 'grid');
    const oldIndex = draggableTabs.findIndex(tab => tab === active.id);
    const newIndex = draggableTabs.findIndex(tab => tab === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedDraggable = arrayMove(draggableTabs, oldIndex, newIndex);
    const newOrder = ['grid', ...reorderedDraggable, ...FIXED_TABS] as WorkspaceTabKey[];
    setCustomTabOrder(newOrder);
  };

  const handleKpiDragStart = (event: DragStartEvent) => {
    setActiveKpiId(Number(event.active.id));
  };

  const handleKpiDragEnd = async (event: DragEndEvent) => {
    setActiveKpiId(null);
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const previous = headerKpiCardsRef.current;
    const activeId = Number(active.id);
    const overId = Number(over.id);
    const oldIndex = previous.findIndex((c) => Number(c.id) === activeId);
    const newIndex = previous.findIndex((c) => Number(c.id) === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(previous, oldIndex, newIndex).map((card, index) => ({
      ...card,
      position: index,
    }));

    setHeaderKpiCards(newOrder);

    try {
      await dispatch(reorderKpiCardsAsync({ cards: newOrder.map((c, index) => ({ id: c.id, position: index })) })).unwrap();
    } catch (error) {
      console.error('[Workspace KPI] Failed to reorder KPI cards:', error);
      setHeaderKpiCards(previous);
      toast.error(t('errors.reorderFailed', 'Failed to reorder cards'));
    }
  };

  return {
    activeKpiId,
    handleDragStart,
    handleDragEnd,
    handleKpiDragStart,
    handleKpiDragEnd,
  };
}
