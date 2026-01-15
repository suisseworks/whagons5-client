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
import { TeamConnectBoard } from '@/store/types';
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

function TeamConnect() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Redux state
  const { value: boards, loading, error } = useSelector((state: RootState) => (state as any).teamconnectBoards || { value: [], loading: false, error: null });

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    visibility: 'private' as 'public' | 'private',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isButtonAnimating, setIsButtonAnimating] = useState(false);

  // Load boards on mount
  useEffect(() => {
    dispatch(genericActions.teamconnectBoards.getFromIndexedDB());
    dispatch(genericActions.teamconnectBoards.fetchFromAPI());
  }, [dispatch]);

  // Filter boards based on search
  const filteredBoards = boards.filter((board: TeamConnectBoard) =>
    board.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (board.description && board.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreateBoard = async () => {
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      await dispatch(genericActions.teamconnectBoards.addAsync(formData) as any);
      setIsCreateDialogOpen(false);
      setFormData({ name: '', description: '', visibility: 'private' });
    } catch (error) {
      console.error('Failed to create board:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBoardClick = (boardId: number) => {
    navigate(`/teamconnect/${boardId}`);
  };

  const handleCreateButtonClick = () => {
    setIsButtonAnimating(true);
    setTimeout(() => {
      setIsButtonAnimating(false);
      setIsCreateDialogOpen(true);
    }, 200);
  };

  return (
    <div className="p-6 space-y-6 bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--brand-primary)' }}>
            {t('teamconnect.boards.title', 'Communication Boards')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('teamconnect.boards.subtitle', 'Team-wide announcements and updates')}
          </p>
        </div>
        <button
          onClick={handleCreateButtonClick}
          style={{ 
            backgroundColor: '#ef4444',
            color: 'white',
            padding: '0.75rem 1.5rem',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transform: isButtonAnimating ? 'scale(0.95)' : 'scale(1)',
            transition: 'transform 0.2s ease-in-out',
          }}
        >
          <Plus className="w-5 h-5" />
          {t('teamconnect.boards.create', 'Create Board')}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('teamconnect.boards.search', 'Search boards...')}
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
              {t('teamconnect.boards.empty', 'No boards found')}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {t('teamconnect.boards.emptyDescription', 'Create your first communication board to share updates with your team')}
            </p>
            <button
              onClick={handleCreateButtonClick}
              style={{ 
                backgroundColor: '#ef4444',
                color: 'white',
                padding: '0.75rem 2rem',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                margin: '0 auto',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                transform: isButtonAnimating ? 'scale(0.95)' : 'scale(1)',
                transition: 'transform 0.2s ease-in-out',
              }}
            >
              <Plus className="w-5 h-5" />
              {t('teamconnect.boards.create', 'Create Board')}
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBoards.map((board: TeamConnectBoard) => (
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
                          {t('teamconnect.boards.visibility.public', 'Public')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <Lock className="w-3 h-3" />
                          {t('teamconnect.boards.visibility.private', 'Private')}
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
            <DialogTitle>{t('teamconnect.board.create.title', 'Create Board')}</DialogTitle>
            <DialogDescription>
              {t('teamconnect.board.create.description', 'Create a new communication board for your team')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('teamconnect.board.name', 'Board Name')}</Label>
              <Input
                id="name"
                placeholder={t('teamconnect.board.namePlaceholder', 'e.g., Company Updates, Team News')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t('teamconnect.board.description', 'Description')}</Label>
              <Textarea
                id="description"
                placeholder={t('teamconnect.board.descriptionPlaceholder', 'What is this board for?')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visibility">{t('teamconnect.board.visibility', 'Visibility')}</Label>
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
                      {t('teamconnect.board.visibility.publicLabel', 'Public - All users can view')}
                    </div>
                  </SelectItem>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      {t('teamconnect.board.visibility.privateLabel', 'Private - Members only')}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* BUTTONS - MOVED HERE SO THEY'RE VISIBLE */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              gap: '1rem',
              paddingTop: '2rem',
              marginTop: '2rem',
              borderTop: '2px solid #e5e7eb',
              width: '100%'
            }}>
              <button
                type="button"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isSubmitting}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600'
                }}
              >
                ❌ Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateBoard}
                disabled={!formData.name.trim() || isSubmitting}
                style={{ 
                  backgroundColor: !formData.name.trim() || isSubmitting ? '#fca5a5' : '#ef4444',
                  color: 'white',
                  padding: '0.75rem 2rem',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: !formData.name.trim() || isSubmitting ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  minWidth: '200px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}
              >
                {isSubmitting ? '⏳ GUARDANDO...' : '✅ CREAR TABLERO'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TeamConnect;
