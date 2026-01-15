import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pin, Trash2, User, Users, Globe, Lock, Calendar } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/providers/LanguageProvider';
import { useTheme } from '@/providers/ThemeProvider';
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
import { Separator } from '@/components/ui/separator';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

function BoardDetail() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { boardId } = useParams<{ boardId: string }>();

  // Redux state
  const { value: boards } = useSelector((state: RootState) => (state as any).boards || { value: [] });
  const { value: messages, loading: messagesLoading } = useSelector((state: RootState) => (state as any).boardMessages || { value: [], loading: false });
  const { value: members } = useSelector((state: RootState) => (state as any).boardMembers || { value: [] });
  const { value: users } = useSelector((state: RootState) => state.users || { value: [] });
  const { value: teams } = useSelector((state: RootState) => (state as any).teams || { value: [] });

  // Local state
  const [isCreateMessageOpen, setIsCreateMessageOpen] = useState(false);
  const [messageFormData, setMessageFormData] = useState({
    title: '',
    content: '',
    is_pinned: false,
    starts_at: '',
    ends_at: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [memberFormData, setMemberFormData] = useState({
    member_type: 'user' as 'user' | 'team',
    member_id: '',
    role: 'member' as 'admin' | 'member',
  });
  const [showMembers, setShowMembers] = useState(false);

  // Find current board
  const board = boards.find((b: Board) => b.id === parseInt(boardId || '0'));

  // Filter messages for this board
  const boardMessages = messages
    .filter((m: BoardMessage) => m.board_id === parseInt(boardId || '0'))
    .sort((a: BoardMessage, b: BoardMessage) => {
      // Pinned first, then by created_at descending
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Filter members for this board
  const boardMembers = members.filter((m: any) => m.board_id === parseInt(boardId || '0'));

  // Load data on mount
  useEffect(() => {
    dispatch(genericActions.boards.getFromIndexedDB());
    dispatch(genericActions.boardMessages.getFromIndexedDB());
    dispatch(genericActions.boardMembers.getFromIndexedDB());
    dispatch(genericActions.users.getFromIndexedDB());
    
    // Fetch from API
    dispatch(genericActions.boards.fetchFromAPI());
    dispatch(genericActions.boardMessages.fetchFromAPI());
    dispatch(genericActions.boardMembers.fetchFromAPI());
    dispatch(genericActions.users.fetchFromAPI());
  }, [dispatch, boardId]);

  const handleCreateMessage = async () => {
    if (!messageFormData.content.trim()) return;

    setIsSubmitting(true);
    try {
      const messageData: any = {
        ...messageFormData,
        board_id: parseInt(boardId || '0'),
        // Convert empty strings to null for optional date fields
        starts_at: messageFormData.starts_at || null,
        ends_at: messageFormData.ends_at || null,
        title: messageFormData.title || null,
      };
      
      await dispatch(genericActions.boardMessages.addAsync(messageData) as any);
      
      // Refresh messages from API to ensure sync
      await dispatch(genericActions.boardMessages.fetchFromAPI() as any);
      
      setIsCreateMessageOpen(false);
      setMessageFormData({
        title: '',
        content: '',
        is_pinned: false,
        starts_at: '',
        ends_at: '',
      });
    } catch (error) {
      console.error('Failed to create message:', error);
    } finally {
      setIsSubmitting(false);
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
      
      // Refresh members from API to ensure sync
      await dispatch(genericActions.boardMembers.fetchFromAPI() as any);
      
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
    if (!confirm(t('teamconnect.members.confirmRemove', 'Are you sure you want to remove this member?'))) return;
    
    try {
      await dispatch(genericActions.boardMembers.removeAsync(memberId) as any);
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const getUserName = (userId: number) => {
    const user = users.find((u: any) => u.id === userId);
    return user?.name || t('common.unknown', 'Unknown');
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

  if (!board) {
    return (
      <div className="p-6 bg-background text-foreground">
        <Button
          variant="ghost"
          onClick={() => navigate('/teamconnect')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('teamconnect.actions.back', 'Back to Boards')}
        </Button>
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <h3 className="text-lg font-semibold mb-2">
              {t('teamconnect.error.noAccess', "You don't have access to this board")}
            </h3>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-background text-foreground">
      {/* Header */}
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/teamconnect')}
          className="mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('teamconnect.actions.back', 'Back to Boards')}
        </Button>
        
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold" style={{ color: 'var(--brand-primary)' }}>
                {board.name}
              </h1>
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
            </div>
            {board.description && (
              <p className="text-muted-foreground mt-2">{board.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowMembers(!showMembers)}
              style={{
                padding: '0.5rem 1rem',
                border: '2px solid #d1d5db',
                borderRadius: '8px',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Users className="w-4 h-4" />
              {t('teamconnect.members.title', 'Members')} ({boardMembers.length})
            </button>
            <button
              onClick={() => setIsCreateMessageOpen(true)}
              style={{
                backgroundColor: '#ef4444',
                color: 'white',
                padding: '0.5rem 1.5rem',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            >
              <Plus className="w-4 h-4" />
              📝 {t('teamconnect.messages.create', 'Post Message')}
            </button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Members Section */}
      {showMembers && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('teamconnect.members.title', 'Members')}</CardTitle>
              <button
                onClick={() => setIsAddMemberOpen(true)}
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              >
                <Plus className="w-4 h-4" />
                👥 {t('teamconnect.members.add', 'Add Members')}
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {boardMembers.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {t('teamconnect.members.empty', 'No members yet')}
              </p>
            ) : (
              <div className="space-y-2">
                {boardMembers.map((member: any) => (
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {member.member_type === 'user' ? (
                        <User className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <Users className="w-5 h-5 text-muted-foreground" />
                      )}
                      <div>
                        <div className="font-medium">{getMemberName(member)}</div>
                        <div className="text-sm text-muted-foreground">
                          {member.member_type === 'user' 
                            ? t('teamconnect.members.type.user', 'User')
                            : t('teamconnect.members.type.team', 'Team')
                          }
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                        {member.role === 'admin' 
                          ? t('teamconnect.members.admin', 'Admin')
                          : t('teamconnect.members.member', 'Member')
                        }
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Messages Feed */}
      <div className="space-y-4">
        {messagesLoading && boardMessages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {t('common.loading', 'Loading...')}
          </div>
        ) : boardMessages.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <h3 className="text-lg font-semibold mb-2">
                {t('teamconnect.messages.empty', 'No messages yet')}
              </h3>
              <p className="text-muted-foreground mb-4">
                {t('teamconnect.messages.emptyDescription', 'Be the first to post a message')}
              </p>
              <button
                onClick={() => setIsCreateMessageOpen(true)}
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  margin: '0 auto',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              >
                <Plus className="w-4 h-4" />
                📝 {t('teamconnect.messages.create', 'Post Message')}
              </button>
            </CardContent>
          </Card>
        ) : (
          boardMessages.map((message: TeamConnectBoardMessage) => (
            <Card key={message.id} className={message.is_pinned ? 'border-2' : ''} style={message.is_pinned ? { borderColor: 'var(--brand-accent)' } : {}}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {message.is_pinned && (
                        <Badge variant="secondary" className="gap-1">
                          <Pin className="w-3 h-3" />
                          {t('teamconnect.messages.pinned', 'Pinned')}
                        </Badge>
                      )}
                      {message.title && (
                        <CardTitle className="text-xl">{message.title}</CardTitle>
                      )}
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      <span>{t('teamconnect.messages.postedBy', 'Posted by')} {getUserName(message.created_by)}</span>
                      <span>•</span>
                      <span>{dayjs(message.created_at).fromNow()}</span>
                      {message.starts_at && (
                        <>
                          <span>•</span>
                          <Calendar className="w-3 h-3" />
                          <span>{dayjs(message.starts_at).format('MMM D, YYYY')}</span>
                        </>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Message Dialog */}
      <Dialog open={isCreateMessageOpen} onOpenChange={setIsCreateMessageOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('teamconnect.messages.create', 'Post Message')}</DialogTitle>
            <DialogDescription>
              {t('teamconnect.messages.adminOnly', 'Only admins can post messages')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t('teamconnect.messages.title.label', 'Title (optional)')}</Label>
              <Input
                id="title"
                placeholder={t('teamconnect.messages.title.placeholder', 'Message title')}
                value={messageFormData.title}
                onChange={(e) => setMessageFormData({ ...messageFormData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">{t('teamconnect.messages.content', 'Content')}</Label>
              <Textarea
                id="content"
                placeholder={t('teamconnect.messages.contentPlaceholder', 'Write your message here...')}
                value={messageFormData.content}
                onChange={(e) => setMessageFormData({ ...messageFormData, content: e.target.value })}
                rows={6}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="starts_at">{t('teamconnect.messages.startsAt', 'Start Date (optional)')}</Label>
                <Input
                  id="starts_at"
                  type="date"
                  value={messageFormData.starts_at}
                  onChange={(e) => setMessageFormData({ ...messageFormData, starts_at: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ends_at">{t('teamconnect.messages.endsAt', 'End Date (optional)')}</Label>
                <Input
                  id="ends_at"
                  type="date"
                  value={messageFormData.ends_at}
                  onChange={(e) => setMessageFormData({ ...messageFormData, ends_at: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_pinned"
                checked={messageFormData.is_pinned}
                onChange={(e) => setMessageFormData({ ...messageFormData, is_pinned: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="is_pinned" className="cursor-pointer">
                {t('teamconnect.messages.pin', 'Pin Message')}
              </Label>
            </div>
          </div>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            gap: '0.5rem',
            paddingTop: '1.5rem',
            marginTop: '1.5rem',
            borderTop: '1px solid #e5e7eb'
          }}>
            <button
              type="button"
              onClick={() => setIsCreateMessageOpen(false)}
              disabled={isSubmitting}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              {t('teamconnect.actions.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={handleCreateMessage}
              disabled={!messageFormData.content.trim() || isSubmitting}
              style={{ 
                backgroundColor: '#ef4444',
                color: 'white',
                padding: '0.5rem 1.5rem',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px',
                opacity: !messageFormData.content.trim() || isSubmitting ? 0.5 : 1
              }}
            >
              {isSubmitting ? t('teamconnect.messages.posting', 'POSTING...') : t('teamconnect.messages.postMessage', 'POST MESSAGE')}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('teamconnect.members.add', 'Add Members')}</DialogTitle>
            <DialogDescription>
              Add users or teams to this board
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="member_type">{t('teamconnect.members.type', 'Member Type')}</Label>
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
                <option value="user">{t('teamconnect.members.type.user', 'User')}</option>
                <option value="team">{t('teamconnect.members.type.team', 'Team')}</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="member_id">
                {memberFormData.member_type === 'user' 
                  ? t('teamconnect.members.selectUser', 'Select User')
                  : t('teamconnect.members.selectTeam', 'Select Team')
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
              <Label htmlFor="role">{t('teamconnect.members.role', 'Role')}</Label>
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
                <option value="member">{t('teamconnect.members.member', 'Member')}</option>
                <option value="admin">{t('teamconnect.members.admin', 'Admin')}</option>
              </select>
            </div>
          </div>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            gap: '0.5rem',
            paddingTop: '1.5rem',
            marginTop: '1.5rem',
            borderTop: '1px solid #e5e7eb'
          }}>
            <button
              type="button"
              onClick={() => setIsAddMemberOpen(false)}
              disabled={isSubmitting}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              {t('teamconnect.actions.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={handleAddMember}
              disabled={!memberFormData.member_id || isSubmitting}
              style={{ 
                backgroundColor: '#ef4444',
                color: 'white',
                padding: '0.5rem 1.5rem',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px',
                opacity: !memberFormData.member_id || isSubmitting ? 0.5 : 1
              }}
            >
              {isSubmitting ? t('teamconnect.members.adding', 'Adding...') : t('teamconnect.members.addMember', 'ADD MEMBER')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BoardDetail;
