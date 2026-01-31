import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import type { KanbanCardProps } from './types/kanban.types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export default function KanbanCard({ task, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Get related data from Redux
  const priorities = useSelector((state: RootState) => (state.priorities as any)?.value ?? []);
  const users = useSelector((state: RootState) => (state.users as any)?.value ?? []);

  const priority = priorities.find((p: any) => p.id === task.priority_id);
  
  // Get assigned users
  const assignedUsers = users.filter((u: any) => 
    task.user_ids?.includes(u.id)
  ).slice(0, 3); // Show max 3 avatars

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <motion.div
        layout
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8 }}
        whileHover={{ y: -2, boxShadow: '0 8px 16px rgba(0,0,0,0.12)' }}
        transition={{ duration: 0.2 }}
        onClick={onClick}
        className="group relative bg-card rounded-lg border border-border/40 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-200 overflow-hidden"
      >
        {/* Priority indicator bar - left side */}
        {priority && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1"
            style={{ backgroundColor: priority.color || '#888' }}
          />
        )}

        <div className="p-4 pl-5">
          {/* Task name */}
          <h4 className="text-sm font-semibold mb-3 line-clamp-2 text-foreground group-hover:text-primary transition-colors">
            {task.name}
          </h4>

          {/* Priority badge */}
          {priority && (
            <div className="mb-3">
              <Badge
                variant="outline"
                className="text-xs font-medium px-2 py-0.5"
                style={{
                  color: priority.color,
                  borderColor: priority.color,
                }}
              >
                {priority.name}
              </Badge>
            </div>
          )}

          {/* Owner/Assigned users */}
          <div className="flex items-center justify-end pt-2">
            {assignedUsers.length > 0 ? (
              <div className="flex items-center -space-x-2">
                {assignedUsers.map((user: any) => (
                  <Avatar key={user.id} className="w-7 h-7 border-2 border-card ring-1 ring-background">
                    <AvatarFallback
                      className="text-xs font-semibold"
                      style={{ 
                        backgroundColor: user.color || '#888',
                        color: '#fff'
                      }}
                    >
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {(task.user_ids?.length || 0) > 3 && (
                  <Avatar className="w-7 h-7 border-2 border-card ring-1 ring-background">
                    <AvatarFallback className="text-xs font-semibold bg-muted text-muted-foreground">
                      +{(task.user_ids?.length || 0) - 3}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-muted-foreground/50">
                <User className="w-3.5 h-3.5" />
                <span>Unassigned</span>
              </div>
            )}
          </div>
        </div>

        {/* Subtle gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
      </motion.div>
    </div>
  );
}
