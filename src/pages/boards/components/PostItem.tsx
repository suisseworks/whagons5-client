import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Repeat2, Send, MoreHorizontal, Pin, Pencil } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BoardMessage } from '@/store/types';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store/store';
import { genericActions } from '@/store/genericSlices';
import { getFileUrl } from '@/api/assetApi';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface PostItemProps {
  message: BoardMessage;
  user: {
    id: number;
    name: string;
    email?: string;
    avatar_url?: string;
  } | null;
  onLike?: (messageId: number) => void;
  onComment?: (messageId: number) => void;
  onRepost?: (messageId: number) => void;
  onShare?: (messageId: number) => void;
  onDelete?: (messageId: number) => void;
  onEdit?: (message: BoardMessage) => void;
  onPin?: (messageId: number, isPinned: boolean) => void;
}

export function PostItem({
  message,
  user,
  onLike,
  onComment,
  onRepost,
  onShare,
  onDelete,
  onEdit,
  onPin,
}: PostItemProps) {
  const dispatch = useDispatch();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  
  // Get board attachments from Redux
  const { value: attachments } = useSelector((state: RootState) => (state as any).boardAttachments || { value: [] });
  
  // Filter attachments for this message (only images)
  const messageImages = attachments.filter((att: any) => {
    const matches = Number(att.board_message_id) === Number(message.id) && att.type === 'IMAGE';
    return matches;
  });



  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
    onLike?.(message.id);
  };

  const formatRelativeTime = (date: string) => {
    const now = dayjs();
    const postDate = dayjs(date);
    const diffInHours = now.diff(postDate, 'hour');
    const diffInDays = now.diff(postDate, 'day');
    const diffInWeeks = now.diff(postDate, 'week');

    if (diffInHours < 1) {
      const diffInMinutes = now.diff(postDate, 'minute');
      return diffInMinutes < 1 ? 'now' : `${diffInMinutes}m`;
    }
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInDays < 7) return `${diffInDays}d`;
    if (diffInWeeks < 4) return `${diffInWeeks}w`;
    return postDate.format('MMM D');
  };

  return (
    <article className="flex gap-3 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors">
      {/* Avatar Column */}
      <div className="flex flex-col items-center">
        <Avatar className="size-10 ring-2 ring-background">
          {user?.avatar_url ? (
            <AvatarImage src={user.avatar_url} alt={user.name} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
            {user ? getInitials(user.name) : '??'}
          </AvatarFallback>
        </Avatar>
        {/* Thread line - can be used for replies later */}
        {/* <div className="w-0.5 bg-border flex-1 mt-2 min-h-0" /> */}
      </div>

      {/* Content Column */}
      <div className="flex-1 min-w-0">
        {/* Header: Username, timestamp, more options */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-foreground truncate">
              {user?.name || 'Unknown User'}
            </span>
            {message.is_pinned && (
              <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-xs h-5">
                <Pin className="size-3" />
              </Badge>
            )}
            <span className="text-muted-foreground text-sm flex-shrink-0">
              {formatRelativeTime(message.created_at)}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(message)}>
                  <Pencil className="size-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {onPin && (
                <DropdownMenuItem onClick={() => onPin(message.id, !message.is_pinned)}>
                  <Pin className="size-4 mr-2" />
                  {message.is_pinned ? 'Unpin' : 'Pin'}
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(message.id)}
                  className="text-destructive focus:text-destructive"
                >
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Title if present */}
        {message.title && (
          <h3 className="font-semibold text-foreground mt-1 text-base">
            {message.title}
          </h3>
        )}

        {/* Post Content */}
        <div className="mt-1 text-foreground whitespace-pre-wrap break-words">
          {message.content}
        </div>

        {/* Images - from attachments */}
        {messageImages.length > 0 && (
          <div className="mt-3 rounded-xl overflow-hidden border border-border">
            <div className={`grid gap-0.5 ${
              messageImages.length === 1 
                ? 'grid-cols-1' 
                : messageImages.length === 2 
                  ? 'grid-cols-2' 
                  : 'grid-cols-2'
            }`}>
              {messageImages.slice(0, 4).map((attachment: any) => {
                const imageUrl = attachment.file_path?.startsWith('http') 
                  ? attachment.file_path 
                  : getFileUrl(attachment.file_path || attachment.id);
                return (
                  <img
                    key={attachment.id}
                    src={imageUrl}
                    alt={attachment.file_name || ''}
                    className="w-full h-auto object-cover aspect-square"
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-1 mt-3 -ml-2">
          <Button
            variant="ghost"
            size="sm"
            className={`h-9 px-3 gap-1.5 rounded-full hover:bg-rose-500/10 hover:text-rose-500 ${
              isLiked ? 'text-rose-500' : 'text-muted-foreground'
            }`}
            onClick={handleLike}
          >
            <Heart className={`size-[18px] ${isLiked ? 'fill-current' : ''}`} />
            {likeCount > 0 && <span className="text-sm">{likeCount}</span>}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 gap-1.5 rounded-full text-muted-foreground hover:bg-sky-500/10 hover:text-sky-500"
            onClick={() => onComment?.(message.id)}
          >
            <MessageCircle className="size-[18px]" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 gap-1.5 rounded-full text-muted-foreground hover:bg-green-500/10 hover:text-green-500"
            onClick={() => onRepost?.(message.id)}
          >
            <Repeat2 className="size-[18px]" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 gap-1.5 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
            onClick={() => onShare?.(message.id)}
          >
            <Send className="size-[18px]" />
          </Button>
        </div>
      </div>
    </article>
  );
}

export default PostItem;
