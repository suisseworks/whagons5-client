import { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Users, Globe, Lock, Plus, User, Trash2, Pencil, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/providers/LanguageProvider';
import { RootState } from '@/store/store';
import { genericActions } from '@/store/genericSlices';
import { Board, BoardMessage } from '@/store/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { PostItem } from './components/PostItem';
import { PostComposer } from './components/PostComposer';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

function BoardDetail() {
  const { t } = useLanguage();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { boardId } = useParams<{ boardId: string }>();

  // Redux state
  const { value: boards } = useSelector((state: RootState) => (state as any).boards || { value: [] });
  const { value: messages, loading: messagesLoading } = useSelector((state: RootState) => (state as any).boardMessages || { value: [], loading: false });
  const { value: members } = useSelector((state: RootState) => (state as any).boardMembers || { value: [] });
  const { value: users } = useSelector((state: RootState) => state.users || { value: [] });
  const { value: teams } = useSelector((state: RootState) => (state as any).teams || { value: [] });
  const currentUser = useSelector((state: RootState) => (state as any).user?.value ?? null);

  // Local state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [memberFormData, setMemberFormData] = useState({
    member_type: 'user' as 'user' | 'team',
    member_id: '',
    role: 'member' as 'admin' | 'member',
  });
  const [showMembers, setShowMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteMessageId, setDeleteMessageId] = useState<number | null>(null);
  const [editMessage, setEditMessage] = useState<BoardMessage | null>(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    content: '',
  });
  const canEditMessage = (message: BoardMessage) => {
    if (!currentUser?.id) return false;
    return !!currentUser?.is_admin || Number(message.created_by) === Number(currentUser.id);
  };
  const canDeleteMessage = (message: BoardMessage) => {
    return canEditMessage(message);
  };
  const [settingsFormData, setSettingsFormData] = useState({
    name: '',
    description: '',
    visibility: 'private' as 'public' | 'private',
  });

  // Find current board
  const board = boards.find((b: Board) => b.id === parseInt(boardId || '0'));

  // Create a map of users for quick lookup
  const usersMap = useMemo(() => {
    const map = new Map<number, { id: number; name: string; email?: string; avatar_url?: string }>();
    users.forEach((user: any) => {
      map.set(user.id, {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url || user.photo_url,
      });
    });
    return map;
  }, [users]);

  // Filter messages for this board
  const boardMessages = useMemo(() => {
    return messages
      .filter((m: BoardMessage) => m.board_id === parseInt(boardId || '0') && !m.deleted_at)
      .sort((a: BoardMessage, b: BoardMessage) => {
        // Pinned first, then by created_at descending
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [messages, boardId]);

  // Filter members for this board
  const boardMembers = members.filter((m: any) => m.board_id === parseInt(boardId || '0'));

  // Load data on mount
  useEffect(() => {
    dispatch(genericActions.boards.getFromIndexedDB());
    dispatch(genericActions.boardMessages.getFromIndexedDB());
    dispatch(genericActions.boardMembers.getFromIndexedDB());
    dispatch(genericActions.boardAttachments.getFromIndexedDB());
    dispatch(genericActions.users.getFromIndexedDB());

    const parsedBoardId = boardId ? parseInt(boardId, 10) : 0;
    if (parsedBoardId > 0) {
      dispatch(genericActions.boardMessages.fetchFromAPI({ board_id: parsedBoardId }) as any);
    }
  }, [dispatch, boardId]);

  const handleCreateMessage = async (data: { content: string; title?: string; is_pinned?: boolean }) => {
    // Normalize content - ensure it's a string (can be empty or whitespace for image-only posts)
    if (data.content === null || data.content === undefined) {
      data.content = '';
    }

    // Validate boardId is available
    const currentBoardId = boardId ? parseInt(boardId) : null;
    if (!currentBoardId || currentBoardId <= 0) {
      console.error('Invalid board ID:', boardId);
      alert(t('boards.error.invalidBoard', 'Invalid board ID. Please refresh the page.'));
      throw new Error('Invalid board ID');
    }

    setIsSubmitting(true);
    try {
      const messageData: any = {
        content: data.content || '', // Allow empty content
        title: data.title || null,
        is_pinned: data.is_pinned || false,
        board_id: currentBoardId,
        starts_at: null,
        ends_at: null,
      };
      
      console.log('Creating board message with data:', messageData);
      const result = await dispatch(genericActions.boardMessages.addAsync(messageData) as any).unwrap();
      console.log('Board message created successfully:', result);
      return result;
    } catch (error: any) {
      console.error('Failed to create message:', error);
      console.error('Error details:', {
        message: error?.message,
        payload: error?.payload,
        response: error?.response?.data,
        stack: error?.stack
      });
      const errorMessage = error?.payload || 
                          error?.response?.data?.message || 
                          error?.message || 
                          t('boards.error.postMessage', 'Failed to post message');
      alert(errorMessage);
      throw error; // Re-throw so PostComposer can handle it
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestDeleteMessage = (message: BoardMessage) => {
    if (!canDeleteMessage(message)) return;
    setDeleteMessageId(message.id);
  };

  const handleDeleteMessage = async () => {
    if (!deleteMessageId) return;
    const messageToDelete = boardMessages.find((msg: BoardMessage) => msg.id === deleteMessageId);
    if (!messageToDelete || !canDeleteMessage(messageToDelete)) {
      setDeleteMessageId(null);
      return;
    }
    try {
      await dispatch(genericActions.boardMessages.removeAsync(deleteMessageId) as any);
      setDeleteMessageId(null);
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const handleOpenEditMessage = (message: BoardMessage) => {
    if (!canEditMessage(message)) return;
    setEditMessage(message);
    setEditFormData({
      title: message.title ?? '',
      content: message.content ?? '',
    });
  };

  const handleUpdateMessage = async () => {
    if (!editMessage || !canEditMessage(editMessage)) return;
    try {
      await dispatch(genericActions.boardMessages.updateAsync({
        id: editMessage.id,
        updates: {
          title: editFormData.title.trim() ? editFormData.title.trim() : null,
          content: editFormData.content ?? '',
        },
      }) as any);
      setEditMessage(null);
    } catch (error) {
      console.error('Failed to update message:', error);
    }
  };

  const handlePinMessage = async (messageId: number, isPinned: boolean) => {
    try {
      await dispatch(genericActions.boardMessages.updateAsync({ id: messageId, updates: { is_pinned: isPinned } }) as any);
    } catch (error) {
      console.error('Failed to pin message:', error);
    }
  };

  const handleAddMember = async () => {
    if (!memberFormData.member_id) return;

    setIsSubmitting(true);
    try {
      await dispatch(genericActions.boardMembers.addAsync({
        ...memberFormData,
        board_id: parseInt(boardId || '0'),
        member_id: parseInt(memberFormData.member_id),
      }) as any);
      
      setIsAddMemberOpen(false);
      setMemberFormData({
        member_type: 'user',
        member_id: '',
        role: 'member',
      });
    } catch (error) {
      console.error('Failed to add member:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!confirm(t('boards.members.confirmRemove', 'Are you sure you want to remove this member?'))) return;
    
    try {
      await dispatch(genericActions.boardMembers.removeAsync(memberId) as any);
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const getMemberName = (member: any) => {
    if (member.member_type === 'user') {
      const user = users.find((u: any) => u.id === member.member_id);
      return user?.name || t('common.unknown', 'Unknown User');
    } else {
      const team = teams.find((t: any) => t.id === member.member_id);
      return team?.name || t('common.unknown', 'Unknown Team');
    }
  };

  const handleOpenSettingsDialog = () => {
    if (board) {
      setSettingsFormData({
        name: board.name || '',
        description: board.description || '',
        visibility: board.visibility || 'private',
      });
    }
    setIsSettingsDialogOpen(true);
  };

  const handleUpdateBoard = async () => {
    if (!settingsFormData.name.trim()) return;

    setIsSubmitting(true);
    try {
      await dispatch(genericActions.boards.updateAsync({
        id: parseInt(boardId || '0'),
        updates: {
          name: settingsFormData.name,
          description: settingsFormData.description,
          visibility: settingsFormData.visibility,
        },
      }) as any);
      setIsSettingsDialogOpen(false);
    } catch (error) {
      console.error('Failed to update board:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBoard = async () => {
    setIsSubmitting(true);
    try {
      await dispatch(genericActions.boards.removeAsync(parseInt(boardId || '0')) as any);
      setIsDeleteDialogOpen(false);
      navigate('/welcome');
    } catch (error) {
      console.error('Failed to delete board:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!board) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
            <div className="flex items-center gap-3 px-4 py-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/boards')}
                className="size-9"
              >
                <ArrowLeft className="size-5" />
              </Button>
              <h1 className="text-lg font-semibold">
                {t('boards.error.notFound', 'Board Not Found')}
              </h1>
            </div>
          </header>
          <div className="p-8 text-center">
            <p className="text-muted-foreground">
              {t('boards.error.noAccess', "You don't have access to this board")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto">
        {/* Header - Threads Style */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/boards')}
                className="size-9"
              >
                <ArrowLeft className="size-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold">{board.name}</h1>
                  {board.visibility === 'public' ? (
                    <Globe className="size-4 text-muted-foreground" />
                  ) : (
                    <Lock className="size-4 text-muted-foreground" />
                  )}
                </div>
                {board.description && (
                  <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                    {board.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMembers(!showMembers)}
                className="size-9"
              >
                <Users className="size-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(!showSettings)}
                className="size-9"
              >
                <Settings className="size-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Members Panel - Slide Down */}
        {showMembers && (
          <div className="border-b border-border bg-muted/30 p-4 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">{t('boards.members.title', 'Members')} ({boardMembers.length})</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddMemberOpen(true)}
              >
                <Plus className="size-4 mr-1" />
                {t('boards.members.add', 'Add')}
              </Button>
            </div>
            {boardMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('boards.members.empty', 'No members yet')}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {boardMembers.map((member: any) => (
                  <Badge
                    key={member.id}
                    variant={member.role === 'admin' ? 'default' : 'secondary'}
                    className="gap-1.5 pl-1.5 pr-2 py-1"
                  >
                    {member.member_type === 'user' ? (
                      <User className="size-3" />
                    ) : (
                      <Users className="size-3" />
                    )}
                    {getMemberName(member)}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveMember(member.id);
                      }}
                      className="ml-1 hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings Panel - Slide Down */}
        {showSettings && (
          <div className="border-b border-border bg-muted/30 p-4 animate-in slide-in-from-top-2">
            <h2 className="font-semibold mb-4">{t('boards.settings.title', 'Board Settings')}</h2>
            
            <div className="space-y-3">
              {/* Board Info */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                <div className="flex-1">
                  <p className="font-medium">{t('boards.settings.editBoard', 'Edit Board')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('boards.settings.editBoardDescription', 'Change name, description, and visibility')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenSettingsDialog}
                >
                  <Pencil className="size-4 mr-1" />
                  {t('common.edit', 'Edit')}
                </Button>
              </div>

              {/* Visibility Info */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                <div className="flex items-center gap-3">
                  {board.visibility === 'public' ? (
                    <Globe className="size-5 text-muted-foreground" />
                  ) : (
                    <Lock className="size-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">
                      {board.visibility === 'public' 
                        ? t('boards.settings.publicBoard', 'Public Board')
                        : t('boards.settings.privateBoard', 'Private Board')
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {board.visibility === 'public'
                        ? t('boards.settings.publicDescription', 'Anyone can view this board')
                        : t('boards.settings.privateDescription', 'Only members can view this board')
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="mt-6 pt-4 border-t border-border">
                <h3 className="text-sm font-semibold text-destructive mb-3 flex items-center gap-2">
                  <AlertTriangle className="size-4" />
                  {t('boards.settings.dangerZone', 'Danger Zone')}
                </h3>
                <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <div>
                    <p className="font-medium text-destructive">{t('boards.settings.deleteBoard', 'Delete Board')}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('boards.settings.deleteBoardDescription', 'Permanently delete this board and all its posts')}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="size-4 mr-1" />
                    {t('common.delete', 'Delete')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Post Composer */}
        <PostComposer
          user={currentUser ? {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
            avatar_url: currentUser.avatar_url || currentUser.photo_url,
          } : null}
          boardId={parseInt(boardId || '0')}
          onPost={handleCreateMessage}
          placeholder={t('boards.composer.placeholder', "What's on your mind?")}
          isLoading={isSubmitting}
        />

        {/* Messages Feed - Threads Style */}
        <div className="divide-y divide-border">
          {messagesLoading && boardMessages.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {t('common.loading', 'Loading...')}
            </div>
          ) : boardMessages.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground mb-2">
                {t('boards.messages.empty', 'No messages yet')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('boards.messages.emptyDescription', 'Be the first to post a message')}
              </p>
            </div>
          ) : (
            boardMessages.map((message: BoardMessage) => (
              <PostItem
                key={message.id}
                message={message}
                user={usersMap.get(message.created_by) || null}
                onDelete={canDeleteMessage(message) ? handleRequestDeleteMessage : undefined}
                onEdit={canEditMessage(message) ? handleOpenEditMessage : undefined}
                onPin={handlePinMessage}
              />
            ))
          )}
        </div>
      </div>

      {/* Delete Message Confirmation */}
      <AlertDialog
        open={deleteMessageId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteMessageId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('boards.messages.delete', 'Delete Message')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('boards.messages.deleteConfirm', 'Are you sure you want to delete this message?')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMessage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Message Dialog */}
      <Dialog
        open={!!editMessage}
        onOpenChange={(open) => {
          if (!open) setEditMessage(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('boards.messages.edit', 'Edit Message')}</DialogTitle>
            <DialogDescription>
              {t('boards.messages.editDescription', 'Update your post content')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-title">{t('boards.messages.title.label', 'Title (optional)')}</Label>
              <Input
                id="edit-title"
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                placeholder={t('boards.messages.title.placeholder', 'Message title')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-content">{t('boards.messages.content', 'Content')}</Label>
              <Textarea
                id="edit-content"
                value={editFormData.content}
                onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })}
                placeholder={t('boards.messages.contentPlaceholder', 'Write your message here...')}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMessage(null)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleUpdateMessage}>
              {t('common.save', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('boards.members.add', 'Add Members')}</DialogTitle>
            <DialogDescription>
              Add users or teams to this board
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="member_type">{t('boards.members.type', 'Member Type')}</Label>
              <select
                id="member_type"
                value={memberFormData.member_type}
                onChange={(e) => setMemberFormData({ 
                  ...memberFormData, 
                  member_type: e.target.value as 'user' | 'team',
                  member_id: '' 
                })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                }}
              >
                <option value="user">{t('boards.members.type.user', 'User')}</option>
                <option value="team">{t('boards.members.type.team', 'Team')}</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="member_id">
                {memberFormData.member_type === 'user' 
                  ? t('boards.members.selectUser', 'Select User')
                  : t('boards.members.selectTeam', 'Select Team')
                }
              </Label>
              <select
                id="member_id"
                value={memberFormData.member_id}
                onChange={(e) => setMemberFormData({ ...memberFormData, member_id: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                }}
              >
                <option value="">-- Select --</option>
                {memberFormData.member_type === 'user' 
                  ? users.map((user: any) => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))
                  : teams.map((team: any) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))
                }
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">{t('boards.members.role', 'Role')}</Label>
              <select
                id="role"
                value={memberFormData.role}
                onChange={(e) => setMemberFormData({ ...memberFormData, role: e.target.value as 'admin' | 'member' })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                }}
              >
                <option value="member">{t('boards.members.member', 'Member')}</option>
                <option value="admin">{t('boards.members.admin', 'Admin')}</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddMemberOpen(false)}
              disabled={isSubmitting}
            >
              {t('boards.actions.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleAddMember}
              disabled={!memberFormData.member_id || isSubmitting}
            >
              {isSubmitting ? t('boards.members.adding', 'Adding...') : t('boards.members.addMember', 'Add Member')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Board Settings Dialog */}
      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('boards.settings.editBoard', 'Edit Board')}</DialogTitle>
            <DialogDescription>
              {t('boards.settings.editBoardDialogDescription', 'Update your board settings')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="settings-name">{t('boards.settings.name', 'Board Name')}</Label>
              <Input
                id="settings-name"
                placeholder={t('boards.settings.namePlaceholder', 'e.g., Company Updates')}
                value={settingsFormData.name}
                onChange={(e) => setSettingsFormData({ ...settingsFormData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-description">{t('boards.settings.description', 'Description')}</Label>
              <Textarea
                id="settings-description"
                placeholder={t('boards.settings.descriptionPlaceholder', 'What is this board for?')}
                value={settingsFormData.description}
                onChange={(e) => setSettingsFormData({ ...settingsFormData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-visibility">{t('boards.settings.visibility', 'Visibility')}</Label>
              <Select
                value={settingsFormData.visibility}
                onValueChange={(value: 'public' | 'private') => setSettingsFormData({ ...settingsFormData, visibility: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      {t('boards.settings.visibility.public', 'Public - All users can view')}
                    </div>
                  </SelectItem>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      {t('boards.settings.visibility.private', 'Private - Members only')}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSettingsDialogOpen(false)}
              disabled={isSubmitting}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleUpdateBoard}
              disabled={!settingsFormData.name.trim() || isSubmitting}
            >
              {isSubmitting ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Board Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              {t('boards.settings.deleteConfirmTitle', 'Delete Board')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('boards.settings.deleteConfirmDescription', 'Are you sure you want to delete this board? This action cannot be undone. All posts in this board will be permanently deleted.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              {t('common.cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBoard}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? t('common.deleting', 'Deleting...') : t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default BoardDetail;
