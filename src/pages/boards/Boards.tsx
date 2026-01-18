import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users2, Lock, Globe } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/providers/LanguageProvider';
import { useTheme } from '@/providers/ThemeProvider';
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

function Boards() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Redux state
  const { value: boards, loading, error } = useSelector((state: RootState) => (state as any).boards || { value: [], loading: false, error: null });

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
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

  // Filter boards based on search (excluding soft-deleted boards)
  const filteredBoards = boards.filter((board: Board) => {
    // Exclude soft-deleted boards
    if (board.deleted_at !== null && board.deleted_at !== undefined) {
      return false;
    }
    
    // Apply search filter
    return board.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (board.description && board.description.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const handleCreateBoard = async () => {
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      console.log('[Boards] Creating board with data:', formData);
      const result = await dispatch(genericActions.boards.addAsync(formData) as any);
      console.log('[Boards] Board created, result:', result);
      console.log('[Boards] Current boards in state:', boards);
      setIsCreateDialogOpen(false);
      setFormData({ name: '', description: '', visibility: 'private' });
      // Note: We rely on the optimistic update from addAsync
      // No need to call fetchFromAPI as it might prune the board if there's a timing issue
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

  return (
    <div className="p-6 space-y-6 bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--brand-primary)' }}>
            {t('boards.boards.title', 'Communication Boards')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('boards.boards.subtitle', 'Team-wide announcements and updates')}
          </p>
        </div>
        <Button onClick={handleCreateButtonClick}>
          <Plus className="w-5 h-5" />
          {t('boards.boards.create', 'Create Board')}
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('boards.boards.search', 'Search boards...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Boards Grid */}
      {loading && boards.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {t('common.loading', 'Loading...')}
        </div>
      ) : filteredBoards.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="pt-6 text-center py-12">
            <Users2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">
              {t('boards.boards.empty', 'No boards found')}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {t('boards.boards.emptyDescription', 'Create your first communication board to share updates with your team')}
            </p>
            <Button onClick={handleCreateButtonClick} className="mx-auto">
              <Plus className="w-5 h-5" />
              {t('boards.boards.create', 'Create Board')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBoards.map((board: Board) => (
            <Card
              key={board.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
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
                          {t('boards.boards.visibility.public', 'Public')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <Lock className="w-3 h-3" />
                          {t('boards.boards.visibility.private', 'Private')}
                        </Badge>
                      )}
                    </CardTitle>
                    {board.description && (
                      <CardDescription className="mt-2">
                        {board.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Create Board Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('boards.board.create.title', 'Create Board')}</DialogTitle>
            <DialogDescription>
              {t('boards.board.create.description', 'Create a new communication board for your team')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('boards.board.name', 'Board Name')}</Label>
              <Input
                id="name"
                placeholder={t('boards.board.namePlaceholder', 'e.g., Company Updates, Team News')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t('boards.board.description', 'Description')}</Label>
              <Textarea
                id="description"
                placeholder={t('boards.board.descriptionPlaceholder', 'What is this board for?')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visibility">{t('boards.board.visibility', 'Visibility')}</Label>
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
                      {t('boards.board.visibility.publicLabel', 'Public - All users can view')}
                    </div>
                  </SelectItem>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      {t('boards.board.visibility.privateLabel', 'Private - Members only')}
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
    </div>
  );
}

export default Boards;
