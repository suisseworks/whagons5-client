import { useState, useEffect, useMemo, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '@/store/store';
import { genericActions } from '@/store/genericSlices';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faChartBar,
  faArrowLeft,
  faCog,
} from '@fortawesome/free-solid-svg-icons';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLanguage } from '@/providers/LanguageProvider';
import toast from 'react-hot-toast';
import KpiCardBuilder from './kpi/KpiCardBuilder';
import { reorderKpiCardsAsync } from '@/store/actions/kpiCards';

interface KpiQueryConfig {
  filters?: Record<string, any>;
  is_default?: boolean;
  default_key?: string;
}

interface KpiCard {
  id: number;
  name: string;
  type: string;
  query_config: KpiQueryConfig;
  display_config: any;
  workspace_id?: number | null;
  user_id?: number | null;
  position: number;
  is_enabled: boolean;
}

function SortableKpiCard({ card, onEdit, onToggle, toggling }: {
  card: KpiCard;
  onEdit: (card: KpiCard) => void;
  onToggle: (id: number, enabled: boolean) => void;
  toggling: number | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const { t } = useLanguage();
  const isDefault = Boolean(card.query_config?.is_default);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      task_count: t('kpiCards.types.taskCount', 'Task Count'),
      task_percentage: t('kpiCards.types.taskPercentage', 'Percentage'),
      trend: t('kpiCards.types.trend', 'Trend'),
      custom_query: t('kpiCards.types.customQuery', 'Custom Query'),
      external: t('kpiCards.types.external', 'External'),
    };
    return labels[type] || type;
  };

  const getDefaultLabel = (defaultKey?: string) => {
    switch (defaultKey) {
      case 'total':
        return t('workspace.stats.total', 'Total');
      case 'inProgress':
        return t('workspace.stats.inProgress', 'In progress');
      case 'completedToday':
        return t('workspace.stats.completedToday', 'Completed today');
      case 'trend':
        return t('workspace.stats.sevenDayTrend', '7-day trend');
      default:
        return card.name;
    }
  };

  const handleCardClick = (e: ReactMouseEvent<HTMLElement>) => {
    // Don't trigger edit if clicking on switch or if it's a default card
    const target = e.target as HTMLElement;
    const isSwitch = target.closest('[role="switch"]') || target.closest('button[type="button"]');
    
    if (!isSwitch && !isDefault) {
      onEdit(card);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? 'opacity-50' : ''}`}
    >
      <Card 
        {...listeners}
        {...attributes}
        className={`mb-3 cursor-grab active:cursor-grabbing ${!isDefault ? 'hover:bg-accent/50 transition-colors' : ''}`}
        onClick={handleCardClick}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className={`text-2xl ${card.display_config?.color || 'text-blue-500'}`}>
              <FontAwesomeIcon icon={faChartBar} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">
                {isDefault ? getDefaultLabel(card.query_config?.default_key) : card.name}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  {getTypeLabel(card.type)}
                </Badge>
                {card.workspace_id && (
                  <span className="text-xs">Workspace #{card.workspace_id}</span>
                )}
                {!card.workspace_id && !card.user_id && (
                  <span className="text-xs">{t('kpiCards.global', 'Global')}</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className={`${toggling === card.id ? 'opacity-50' : ''}`}>
                <Switch
                  checked={card.is_enabled}
                  onCheckedChange={(checked) => onToggle(card.id, checked)}
                  disabled={toggling === card.id}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function KpiCardsManage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const kpiCards = useSelector((state: RootState) => (state as any).kpiCards?.value ?? []);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<KpiCard | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

  // Sort cards by position
  const sortedCardsFromStore = useMemo(() => {
    return [...kpiCards].sort((a, b) => a.position - b.position);
  }, [kpiCards]);

  // Local order state to prevent "snap back" while we persist reorder to the API
  const [cards, setCards] = useState<KpiCard[]>([]);
  const cardsRef = useRef<KpiCard[]>([]);

  useEffect(() => {
    setCards(sortedCardsFromStore);
  }, [sortedCardsFromStore]);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  const cardIds = useMemo(() => cards.map(card => card.id), [cards]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const previousCards = cardsRef.current;
    const oldIndex = previousCards.findIndex(card => card.id === active.id);
    const newIndex = previousCards.findIndex(card => card.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(previousCards, oldIndex, newIndex).map((card, index) => ({
        ...card,
        position: index,
      }));

      // Optimistically update UI so it doesn't "snap back" while persisting
      setCards(newOrder);
      
      // Update positions
      const reorderData = newOrder.map((card, index) => ({
        id: card.id,
        position: index,
      }));

      try {
        await dispatch(reorderKpiCardsAsync({ cards: reorderData })).unwrap();
        toast.success(t('kpiCards.reordered', 'Cards reordered successfully'));
      } catch (error: any) {
        console.error('Error reordering cards:', error);
        // Rollback optimistic reorder
        setCards(previousCards);
        toast.error(t('errors.reorderFailed', 'Failed to reorder cards'));
      }
    }
  };

  const handleAdd = () => {
    setEditingCard(null);
    setIsBuilderOpen(true);
  };

  const handleEdit = (card: KpiCard) => {
    if (card.query_config?.is_default) {
      return;
    }
    setEditingCard(card);
    setIsBuilderOpen(true);
  };

  const handleToggle = async (id: number, enabled: boolean) => {
    setToggling(id);
    
    // Show loading toast
    const loadingToast = toast.loading(
      enabled 
        ? t('kpiCards.enabling', 'Enabling KPI card...')
        : t('kpiCards.disabling', 'Disabling KPI card...')
    );
    
    try {
      await dispatch(genericActions.kpiCards.updateAsync({ id, updates: { is_enabled: enabled } as any })).unwrap();
      
      // Dismiss loading and show success
      toast.dismiss(loadingToast);
      toast.success(
        enabled 
          ? t('kpiCards.enabled', 'KPI card enabled')
          : t('kpiCards.disabled', 'KPI card disabled')
      );
    } catch (error: any) {
      console.error('Error toggling card:', error);
      // Dismiss loading and show error
      toast.dismiss(loadingToast);
      toast.error(t('errors.toggleFailed', 'Failed to toggle card'));
    } finally {
      setToggling(null);
    }
  };

  const handleSave = async (cardData: Partial<KpiCard>) => {
    try {
      console.log('[KpiCardsManage] Saving card data:', cardData);
      
      if (editingCard) {
        // Update existing card
        await dispatch(genericActions.kpiCards.updateAsync({
          id: editingCard.id,
          updates: cardData,
        })).unwrap();
        toast.success(t('kpiCards.updated', 'KPI card updated successfully'));
      } else {
        // Create new card
        await dispatch(genericActions.kpiCards.addAsync(cardData)).unwrap();
        toast.success(t('kpiCards.created', 'KPI card created successfully'));
      }
      setIsBuilderOpen(false);
      setEditingCard(null);
    } catch (error: any) {
      console.error('[KpiCardsManage] Error saving card:', error);
      console.error('[KpiCardsManage] Validation errors:', error?.response?.data?.errors);
      
      // Show specific validation errors if available
      if (error?.response?.data?.errors) {
        const errors = error.response.data.errors;
        const firstError = Object.values(errors)[0];
        toast.error(Array.isArray(firstError) ? firstError[0] : String(firstError));
      } else {
        toast.error(error?.message || t('errors.saveFailed', 'Failed to save card'));
      }
    }
  };

  const handleDelete = async () => {
    if (!editingCard?.id) return;
    try {
      await dispatch(genericActions.kpiCards.removeAsync(editingCard.id)).unwrap();
      toast.success(t('kpiCards.deleted', 'KPI card deleted successfully'));
      setIsBuilderOpen(false);
      setEditingCard(null);
    } catch (error: any) {
      console.error('[KpiCardsManage] Error deleting card:', error);
      toast.error(t('errors.deleteFailed', 'Failed to delete card'));
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/settings/kpi-cards')}
          >
            <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
            {t('common.back', 'Back')}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{t('kpiCards.title', 'Custom KPI Cards')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('kpiCards.description', 'Create and manage custom metrics cards for workspace dashboards')}
            </p>
          </div>
        </div>
        <Button onClick={handleAdd}>
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          {t('kpiCards.addCard', 'Add Card')}
        </Button>
      </div>

      {/* Cards List */}
      {cards.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('kpiCards.noCards', 'No KPI Cards')}</CardTitle>
            <CardDescription>
              {t('kpiCards.noCardsDescription', 'Create your first custom KPI card to get started')}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {t('kpiCards.dragToReorder', 'Drag cards to reorder them')}
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
              {cards.map((card) => (
                <SortableKpiCard
                  key={card.id}
                  card={card}
                  onEdit={handleEdit}
                  onToggle={handleToggle}
                  toggling={toggling}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Builder Dialog */}
      <KpiCardBuilder
        isOpen={isBuilderOpen}
        onClose={() => {
          setIsBuilderOpen(false);
          setEditingCard(null);
        }}
        onSave={handleSave}
        onDelete={editingCard ? handleDelete : undefined}
        editingCard={editingCard}
      />

      {/* Settings Link Card */}
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {t('kpiCards.settingsAvailable', 'Plugin settings are available in Settings > Plugins')}
              </p>
            </div>
            <Button 
              variant="outline"
              onClick={() => navigate('/settings/kpi-cards')}
            >
              <FontAwesomeIcon icon={faCog} className="mr-2" />
              {t('kpiCards.goToSettings', 'Go to Settings')}
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
