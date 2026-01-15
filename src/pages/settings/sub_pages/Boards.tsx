import { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users2, Lock, Globe, Pin, PinOff } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/providers/LanguageProvider';
import { RootState } from '@/store/store';
import { genericActions } from '@/store/genericSlices';
import { Board } from '@/store/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsLayout } from '@/pages/settings/components';
import { faUsers } from '@fortawesome/free-solid-svg-icons';

const PINNED_BOARDS_STORAGE_KEY = 'pinnedBoards';
const PINNED_BOARDS_ORDER_STORAGE_KEY = 'pinnedBoardsOrder';

const getPinnedBoards = (): number[] => {
  try {
    const stored = localStorage.getItem(PINNED_BOARDS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const setPinnedBoards = (boardIds: number[]) => {
  try {
    localStorage.setItem(PINNED_BOARDS_STORAGE_KEY, JSON.stringify(boardIds));
    // Dispatch custom event to notify sidebar
    window.dispatchEvent(new Event('pinnedBoardsChanged'));
  } catch (error) {
    console.error('Error saving pinned boards:', error);
  }
};

const getPinnedBoardsOrder = (): number[] => {
  try {
    const stored = localStorage.getItem(PINNED_BOARDS_ORDER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const setPinnedBoardsOrder = (boardIds: number[]) => {
  try {
    localStorage.setItem(PINNED_BOARDS_ORDER_STORAGE_KEY, JSON.stringify(boardIds));
    // Dispatch custom event to notify sidebar
    window.dispatchEvent(new Event('pinnedBoardsChanged'));
  } catch (error) {
    console.error('Error saving pinned boards order:', error);
  }
};

function Boards() {
  const { t } = useLanguage();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Redux state
  const { value: boards, loading, error } = useSelector((state: RootState) => (state as any).boards || { value: [], loading: false, error: null });

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [pinnedBoards, setPinnedBoardsState] = useState<number[]>(getPinnedBoards());
  const [pinnedBoardsOrder, setPinnedBoardsOrderState] = useState<number[]>(getPinnedBoardsOrder());
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    visibility: 'private' as 'public' | 'private',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load boards on mount
  useEffect(() => {
    dispatch(genericActions.boards.getFromIndexedDB());
  }, [dispatch]);

  // Load pinned boards on mount
  useEffect(() => {
    setPinnedBoardsState(getPinnedBoards());
    setPinnedBoardsOrderState(getPinnedBoardsOrder());
  }, []);

  // Filter boards based on search (excluding soft-deleted boards)
  const filteredBoards = useMemo(() => {
    return boards.filter((board: Board) => {
      // Exclude soft-deleted boards
      if (board.deleted_at !== null && board.deleted_at !== undefined) {
        return false;
      }
      
      // Apply search filter
      return board.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (board.description && board.description.toLowerCase().includes(searchQuery.toLowerCase()));
    });
  }, [boards, searchQuery]);

  // Separate pinned and unpinned boards
  const pinnedBoardsList = useMemo(() => {
    const pinned = filteredBoards.filter((board: Board) => pinnedBoards.includes(board.id));
    const order = pinnedBoardsOrder;
    
    if (order.length === 0) return pinned;
    
    // Sort by saved order, putting unordered items at the end
    return [...pinned].sort((a, b) => {
      const aIndex = order.indexOf(a.id);
      const bIndex = order.indexOf(b.id);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [filteredBoards, pinnedBoards, pinnedBoardsOrder]);

  const unpinnedBoardsList = filteredBoards.filter((board: Board) => !pinnedBoards.includes(board.id));

  const handleCreateBoard = async () => {
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      console.log('[Boards] Creating board with data:', formData);
      const result = await dispatch(genericActions.boards.addAsync(formData) as any);
      console.log('[Boards] Board created, result:', result);
      setIsCreateDialogOpen(false);
      setFormData({ name: '', description: '', visibility: 'private' });
    } catch (error) {
      console.error('Failed to create board:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBoardClick = (boardId: number) => {
    navigate(`/boards/${boardId}`);
  };

  const handleCreateButtonClick = () => {
    setIsCreateDialogOpen(true);
  };

  const togglePinBoard = (boardId: number) => {
    const isPinned = pinnedBoards.includes(boardId);
    let newPinnedBoards: number[];
    
    if (isPinned) {
      // Unpin
      newPinnedBoards = pinnedBoards.filter(id => id !== boardId);
      const newOrder = pinnedBoardsOrder.filter(id => id !== boardId);
      setPinnedBoardsOrder(newOrder);
      setPinnedBoardsOrderState(newOrder);
    } else {
      // Pin
      newPinnedBoards = [...pinnedBoards, boardId];
      const newOrder = [...pinnedBoardsOrder, boardId];
      setPinnedBoardsOrder(newOrder);
      setPinnedBoardsOrderState(newOrder);
    }
    
    setPinnedBoards(newPinnedBoards);
    setPinnedBoardsState(newPinnedBoards);
  };

  const stats = {
    total: filteredBoards.length,
    pinned: pinnedBoardsList.length,
    unpinned: unpinnedBoardsList.length,
  };

  return (
    <SettingsLayout
      title={t('settings.boards.title', 'Boards')}
      description={t('settings.boards.description', 'Create and manage communication boards')}
      icon={faUsers}
      iconColor="#3b82f6"
      headerActions={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('settings.boards.searchPlaceholder', 'Search boards...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button onClick={handleCreateButtonClick}>
            <Plus className="w-4 h-4 mr-2" />
            {t('settings.boards.create', 'Create Board')}
          </Button>
        </div>
      }
      statistics={{
        title: t('settings.boards.statistics', 'Board Statistics'),
        items: [
          { label: t('settings.boards.stats.total', 'Total'), value: stats.total },
          { label: t('settings.boards.stats.pinned', 'Pinned'), value: stats.pinned },
          { label: t('settings.boards.stats.unpinned', 'Unpinned'), value: stats.unpinned },
        ],
      }}
      wrapChildrenFullHeight={false}
    >
      {loading && boards.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {t('common.loading', 'Loading...')}
        </div>
      ) : filteredBoards.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="pt-6 text-center py-12">
            <Users2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">
              {t('settings.boards.empty', 'No boards found')}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {t('settings.boards.emptyDescription', 'Create your first communication board to share updates with your team')}
            </p>
            <Button onClick={handleCreateButtonClick} className="mx-auto">
              <Plus className="w-5 h-5 mr-2" />
              {t('settings.boards.create', 'Create Board')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Pinned Boards Section */}
          {pinnedBoardsList.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Pin className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">
                  {t('settings.boards.pinned', 'Pinned Boards')}
                </h2>
                <Badge variant="secondary">{pinnedBoardsList.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pinnedBoardsList.map((board: Board) => (
                  <Card
                    key={board.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow relative"
                    onClick={() => handleBoardClick(board.id)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2">
                            {board.name}
                            {board.visibility === 'public' ? (
                              <Badge variant="secondary" className="gap-1">
                                <Globe className="w-3 h-3" />
                                {t('settings.boards.visibility.public', 'Public')}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1">
                                <Lock className="w-3 h-3" />
                                {t('settings.boards.visibility.private', 'Private')}
                              </Badge>
                            )}
                          </CardTitle>
                          {board.description && (
                            <CardDescription className="mt-2">
                              {board.description}
                            </CardDescription>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePinBoard(board.id);
                          }}
                          title={t('settings.boards.unpin', 'Unpin board')}
                        >
                          <Pin className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Unpinned Boards Section */}
          {unpinnedBoardsList.length > 0 && (
            <div className="space-y-4">
              {pinnedBoardsList.length > 0 && (
                <div className="flex items-center gap-2">
                  <PinOff className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">
                    {t('settings.boards.allBoards', 'All Boards')}
                  </h2>
                  <Badge variant="secondary">{unpinnedBoardsList.length}</Badge>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unpinnedBoardsList.map((board: Board) => (
                  <Card
                    key={board.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow relative"
                    onClick={() => handleBoardClick(board.id)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2">
                            {board.name}
                            {board.visibility === 'public' ? (
                              <Badge variant="secondary" className="gap-1">
                                <Globe className="w-3 h-3" />
                                {t('settings.boards.visibility.public', 'Public')}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1">
                                <Lock className="w-3 h-3" />
                                {t('settings.boards.visibility.private', 'Private')}
                              </Badge>
                            )}
                          </CardTitle>
                          {board.description && (
                            <CardDescription className="mt-2">
                              {board.description}
                            </CardDescription>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePinBoard(board.id);
                          }}
                          title={t('settings.boards.pin', 'Pin board to sidebar')}
                        >
                          <PinOff className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Board Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.boards.createDialog.title', 'Create Board')}</DialogTitle>
            <DialogDescription>
              {t('settings.boards.createDialog.description', 'Create a new communication board for your team')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('settings.boards.createDialog.name', 'Board Name')}</Label>
              <Input
                id="name"
                placeholder={t('settings.boards.createDialog.namePlaceholder', 'e.g., Company Updates, Team News')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t('settings.boards.createDialog.description', 'Description')}</Label>
              <Textarea
                id="description"
                placeholder={t('settings.boards.createDialog.descriptionPlaceholder', 'What is this board for?')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visibility">{t('settings.boards.createDialog.visibility', 'Visibility')}</Label>
              <Select
                value={formData.visibility}
                onValueChange={(value: 'public' | 'private') => setFormData({ ...formData, visibility: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      {t('settings.boards.createDialog.visibility.public', 'Public - All users can view')}
                    </div>
                  </SelectItem>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      {t('settings.boards.createDialog.visibility.private', 'Private - Members only')}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isSubmitting}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleCreateBoard}
                disabled={!formData.name.trim() || isSubmitting}
              >
                {isSubmitting ? t('common.creating', 'Creating...') : t('common.create', 'Create')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </SettingsLayout>
  );
}

export default Boards;
