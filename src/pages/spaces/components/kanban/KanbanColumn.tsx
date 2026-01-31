import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import type { KanbanColumnProps } from './types/kanban.types';
import KanbanCard from './KanbanCard';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function KanbanColumn({ status, tasks, onTaskClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col w-80 min-w-80 bg-muted/30 backdrop-blur-sm rounded-xl border transition-all duration-300 ${
        isOver 
          ? 'border-primary/50 shadow-xl scale-[1.02] bg-primary/5' 
          : 'border-border/40 shadow-md'
      }`}
    >
      {/* Column Header - Modern design */}
      <div
        className="p-4 border-b border-border/40 bg-card/80 backdrop-blur-sm rounded-t-xl"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full shadow-sm"
              style={{ 
                backgroundColor: status.color || '#888',
                boxShadow: `0 0 8px ${status.color}40`
              }}
            />
            <h3 className="font-bold text-sm tracking-tight text-foreground">
              {status.name}
            </h3>
          </div>
          <Badge 
            variant="secondary" 
            className="text-xs font-bold px-2.5 py-0.5 bg-muted/80"
            style={{
              color: status.color || '#888',
            }}
          >
            {tasks.length}
          </Badge>
        </div>
        
        {/* Progress bar */}
        {tasks.length > 0 && (
          <div className="h-1 bg-muted rounded-full overflow-hidden mt-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((tasks.length / 10) * 100, 100)}%` }}
              className="h-full rounded-full"
              style={{ backgroundColor: status.color || '#888' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        )}
      </div>

      {/* Column Content - Droppable area */}
      <ScrollArea className="flex-1 p-3">
        <div
          ref={setNodeRef}
          className={`space-y-3 min-h-[300px] rounded-lg transition-all duration-200 ${
            isOver ? 'bg-primary/5' : ''
          }`}
        >
          <SortableContext
            items={tasks.map(task => task.id)}
            strategy={verticalListSortingStrategy}
          >
            <AnimatePresence mode="popLayout">
              {tasks.map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  onClick={() => onTaskClick(task)}
                />
              ))}
            </AnimatePresence>
          </SortableContext>

          {/* Empty state - Modern design */}
          {tasks.length === 0 && !isOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-40 text-center px-4"
            >
              <div 
                className="w-12 h-12 rounded-full mb-3 flex items-center justify-center opacity-20"
                style={{ backgroundColor: status.color || '#888' }}
              >
                <svg 
                  className="w-6 h-6" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                  />
                </svg>
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                No tasks yet
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Drag tasks here
              </p>
            </motion.div>
          )}

          {/* Drop zone indicator */}
          {isOver && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center justify-center h-20 border-2 border-dashed rounded-lg"
              style={{ borderColor: status.color || '#888' }}
            >
              <p className="text-sm font-medium" style={{ color: status.color || '#888' }}>
                Drop here
              </p>
            </motion.div>
          )}
        </div>
      </ScrollArea>
    </motion.div>
  );
}
