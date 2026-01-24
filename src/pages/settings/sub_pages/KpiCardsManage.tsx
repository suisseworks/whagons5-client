import { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '@/store/store';
import { genericActions, genericInternalActions } from '@/store/genericSlices';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faEdit,
  faTrash,
  faGripVertical,
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
import { api } from '@/api/whagonsApi';
import KpiCardBuilder from './kpi/KpiCardBuilder';

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

function SortableKpiCard({ card, onEdit, onDelete, onToggle, deleting, toggling }: {
  card: KpiCard;
  onEdit: (card: KpiCard) => void;
  onDelete: (card: KpiCard) => void;
  onToggle: (id: number, enabled: boolean) => void;
  deleting: number | null;
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? 'opacity-50' : ''}`}
    >
      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {/* Drag handle */}
            <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
              <FontAwesomeIcon icon={faGripVertical} />
            </div>

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
            <div className="flex items-center gap-2">
              <div className={`${toggling === card.id ? 'opacity-50' : ''}`}>
                <Switch
                  checked={card.is_enabled}
                  onCheckedChange={(checked) => onToggle(card.id, checked)}
                  disabled={toggling === card.id}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!isDefault) {
                    onEdit(card);
                  }
                }}
                title={t('common.edit', 'Edit')}
                disabled={isDefault}
              >
                <FontAwesomeIcon icon={faEdit} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!isDefault) {
                    onDelete(card);
                  }
                }}
                className="text-destructive hover:text-destructive"
                title={t('common.delete', 'Delete')}
                disabled={isDefault || deleting === card.id}
              >
                <FontAwesomeIcon icon={faTrash} />
              </Button>
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
  const dispatch = useDispatch();
  const kpiCards = useSelector((state: RootState) => (state as any).kpiCards?.value ?? []);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<KpiCard | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<KpiCard | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

  // Load KPI cards on mount
  useEffect(() => {
    dispatch(genericInternalActions.kpiCards.getFromIndexedDB());
    dispatch(genericInternalActions.kpiCards.fetchFromAPI());
  }, [dispatch]);

  // Sort cards by position
  const sortedCards = useMemo(() => {
    return [...kpiCards].sort((a, b) => a.position - b.position);
  }, [kpiCards]);

  const cardIds = useMemo(() => sortedCards.map(card => card.id), [sortedCards]);

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

    const oldIndex = sortedCards.findIndex(card => card.id === active.id);
    const newIndex = sortedCards.findIndex(card => card.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(sortedCards, oldIndex, newIndex);
      
      // Update positions
      const reorderData = newOrder.map((card, index) => ({
        id: card.id,
        position: index,
      }));

      try {
        await api.post('/kpi-cards/reorder', { cards: reorderData });
        // Refresh from API
        dispatch(genericInternalActions.kpiCards.fetchFromAPI());
        toast.success(t('kpiCards.reordered', 'Cards reordered successfully'));
      } catch (error) {
        console.error('Error reordering cards:', error);
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

  const handleDeleteClick = (card: KpiCard) => {
    if (card.query_config?.is_default) {
      return;
    }
    setCardToDelete(card);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!cardToDelete) return;

    setDeleting(cardToDelete.id);
    setDeleteDialogOpen(false);
    
    try {
      await dispatch(genericActions.kpiCards.removeAsync(cardToDelete.id)).unwrap();
      toast.success(t('kpiCards.deleted', 'KPI card deleted successfully'));
    } catch (error: any) {
      console.error('Error deleting card:', error);
      toast.error(error?.message || t('errors.deleteFailed', 'Failed to delete card'));
    } finally {
      setDeleting(null);
      setCardToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setCardToDelete(null);
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
      // Call toggle API endpoint
      await api.post(`/kpi-cards/${id}/toggle`, { is_enabled: enabled });
      
      // Refresh from API to get updated state
      await dispatch(genericInternalActions.kpiCards.fetchFromAPI());
      
      // Dismiss loading and show success
      toast.dismiss(loadingToast);
      toast.success(
        enabled 
          ? t('kpiCards.enabled', 'KPI card enabled')
          : t('kpiCards.disabled', 'KPI card disabled')
      );
    } catch (error) {
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
      {sortedCards.length === 0 ? (
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
              {sortedCards.map((card) => (
                <SortableKpiCard
                  key={card.id}
                  card={card}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                  onToggle={handleToggle}
                  deleting={deleting}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('kpiCards.deleteTitle', 'Delete KPI Card')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cardToDelete && (
                <>
                  {t('kpiCards.deleteDescription', 'Are you sure you want to delete the KPI card')}{' '}
                  <strong className="font-semibold text-foreground">"{cardToDelete.name}"</strong>?
                  <br />
                  <span className="text-xs text-muted-foreground mt-1 block">
                    {t('kpiCards.deleteWarning', 'This action cannot be undone.')}
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>
              {t('common.cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
