import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { TaskGroup } from './hooks/useKanbanGrouping';
import type { Status } from '@/store/types';
import KanbanColumn from './KanbanColumn';

interface KanbanSwimLaneProps {
  group: TaskGroup;
  statuses: Status[];
  onTaskClick: (task: any) => void;
  isExpanded?: boolean;
}

export default function KanbanSwimLane({
  group,
  statuses,
  onTaskClick,
  isExpanded: initialExpanded = true,
}: KanbanSwimLaneProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  // Group tasks by status within this swim lane
  const tasksByStatus: Record<number, any[]> = {};
  statuses.forEach((status) => {
    tasksByStatus[status.id] = group.tasks.filter(task => task.status_id === status.id);
  });

  return (
    <div className="bg-card/40 backdrop-blur-sm rounded-xl border border-border/40 shadow-md overflow-hidden">
      {/* Swim Lane Header - Modern design */}
      <div
        className="sticky left-0 z-10 bg-gradient-to-r from-card to-card/80 backdrop-blur-md border-b border-border/40 px-5 py-4 flex items-center gap-4"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-8 w-8 p-0 hover:bg-muted/80 transition-colors"
        >
          <motion.div
            animate={{ rotate: isExpanded ? 0 : -90 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </Button>
        
        <div className="flex items-center gap-3 flex-1">
          {group.color && (
            <div
              className="w-3 h-3 rounded-full shadow-sm"
              style={{ 
                backgroundColor: group.color,
                boxShadow: `0 0 8px ${group.color}40`
              }}
            />
          )}
          <h3 className="font-bold text-base tracking-tight text-foreground">
            {group.name}
          </h3>
          
          <Badge 
            variant="secondary" 
            className="text-xs font-bold px-3 py-1 bg-muted/80"
            style={{
              color: group.color || '#888',
            }}
          >
            {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
          </Badge>
        </div>

        {/* Mini progress indicator */}
        {group.tasks.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((group.tasks.length / 20) * 100, 100)}%` }}
                className="h-full rounded-full"
                style={{ backgroundColor: group.color || '#888' }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Swim Lane Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="flex gap-5 p-5 overflow-x-auto min-h-[350px] bg-muted/20">
              {statuses.map((status: any) => (
                <KanbanColumn
                  key={status.id}
                  status={status}
                  tasks={tasksByStatus[status.id] || []}
                  onTaskClick={onTaskClick}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
