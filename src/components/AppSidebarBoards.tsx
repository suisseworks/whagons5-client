import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  ChevronDown,
  Users2,
  Plus,
  Globe,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/animate-ui/primitives/radix/collapsible';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from '@/components/ui/sidebar';
import { useLanguage } from '@/providers/LanguageProvider';
import { genericActions } from '@/store/genericSlices';

export interface AppSidebarBoardsProps {
  boards: any[];
  pathname: string;
}

const IconBadge = ({
  children,
  color,
  size = 20,
}: {
  children: React.ReactNode;
  color: string;
  size?: number;
}) => (
  <div
    className="grid place-items-center rounded-[6px] flex-shrink-0"
    style={{
      backgroundColor: color,
      width: `${size}px`,
      height: `${size}px`,
      lineHeight: 0,
      position: 'relative'
    }}
  >
    {children}
  </div>
);

export function AppSidebarBoards({ boards, pathname }: AppSidebarBoardsProps) {
  const { isMobile, state } = useSidebar();
  const isCollapsedState = state === 'collapsed';
  const collapsed = isCollapsedState && !isMobile;
  const { t } = useLanguage();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Create board dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    visibility: 'private' as 'public' | 'private',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateBoard = async () => {
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await dispatch(genericActions.boards.addAsync(formData) as any);
      setIsCreateDialogOpen(false);
      setFormData({ name: '', description: '', visibility: 'private' });
      // Navigate to the newly created board
      if (result?.payload?.id) {
        navigate(`/boards/${result.payload.id}`);
      }
    } catch (error) {
      console.error('Failed to create board:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <div
            className={`flex items-center w-full ${collapsed ? 'justify-center px-0' : 'justify-between'}`}
            style={{ 
              borderTop: collapsed ? 'none' : `1px solid var(--sidebar-border)`,
              paddingTop: collapsed ? '0' : '8px',
              marginBottom: '8px'
            }}
          >
            {collapsed ? (
              <Users2 className="w-5 h-5" style={{ color: 'var(--sidebar-text-primary)' }} />
            ) : (
              <>
                <CollapsibleTrigger className="flex items-center cursor-pointer hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] rounded-sm flex-1 p-1 transition-all">
                  <ChevronDown className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180 w-4 h-4 text-[var(--sidebar-text-primary)]" />
                  <span className="pl-2 text-sm font-semibold text-[var(--sidebar-text-primary)]">
                    {t('sidebar.boards', 'Boards')}
                  </span>
                </CollapsibleTrigger>
                
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-5 w-5 p-0" 
                    title={t('sidebar.addBoard', 'Add Board')}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCreateDialogOpen(true);
                    }}
                  >
                    <Plus size={16} className="text-[var(--sidebar-text-primary)]" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </SidebarGroupLabel>

        <CollapsibleContent 
          keepRendered={true}
          forceVisible={collapsed}
        >
          <SidebarGroupContent className={collapsed ? 'pt-1' : 'pt-1'}>
            <div className={collapsed ? 'flex flex-col items-center space-y-1 py-0.5' : 'space-y-0.5'}>
              {boards.length === 0 ? (
                <div className={`text-[var(--sidebar-text-secondary)] text-xs ${collapsed ? 'text-center' : 'px-2 py-1'}`}>
                  {collapsed ? '' : t('sidebar.noBoards', 'No boards yet')}
                </div>
              ) : (
                boards.map((board: any) => {
                  const isActive = pathname === `/boards/${board.id}` || pathname.startsWith(`/boards/${board.id}/`);
                  return (
                    <SidebarMenuItem key={board.id}>
                      <SidebarMenuButton
                        asChild
                        tooltip={collapsed ? board.name : undefined}
                        className={`rounded-[8px] relative transition-colors ${
                          isActive
                            ? 'bg-[var(--sidebar-selected-bg)] text-[var(--sidebar-primary)]'
                            : 'text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
                        } ${collapsed ? '!p-[6px]' : ''}`}
                        style={{
                          height: '32px',
                          padding: collapsed ? '6px' : '6px 10px',
                          gap: '8px',
                          fontWeight: isActive ? 600 : 500,
                          fontSize: '13px',
                          width: '100%',
                        }}
                      >
                        <Link
                          to={`/boards/${board.id}`}
                          className={`${collapsed
                            ? 'grid place-items-center w-8 h-8 p-0'
                            : 'flex items-center'
                          } group relative`}
                        >
                          {isActive && (
                            <span
                              className="absolute left-0 top-1/2 -translate-y-1/2 bg-[var(--sidebar-primary)] rounded-full"
                              style={{ width: '2px', height: collapsed ? '80%' : '85%' }}
                            />
                          )}
                          <div className="flex items-center min-w-0 flex-1">
                            <IconBadge color="#3b82f6" size={18}>
                              <Users2 size={12} className="w-3 h-3 block" style={{ color: '#ffffff', strokeWidth: 2, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                            </IconBadge>
                            {collapsed ? (
                              <span className="sr-only">{board.name}</span>
                            ) : (
                              <span className="truncate ml-1.5">{board.name}</span>
                            )}
                          </div>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
              )}
            </div>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>

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
              <Label htmlFor="board-name">{t('boards.board.name', 'Board Name')}</Label>
              <Input
                id="board-name"
                placeholder={t('boards.board.namePlaceholder', 'e.g., Company Updates, Team News')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="board-description">{t('boards.board.description', 'Description')}</Label>
              <Textarea
                id="board-description"
                placeholder={t('boards.board.descriptionPlaceholder', 'What is this board for?')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="board-visibility">{t('boards.board.visibility', 'Visibility')}</Label>
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
    </Collapsible>
  );
}

export default AppSidebarBoards;
