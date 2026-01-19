import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityEvent } from '../ActivityMonitor';
import { User, Clock } from 'lucide-react';

interface CardWallPhysicsProps {
  activities: ActivityEvent[];
}

const typeEmojis: Record<ActivityEvent['type'], string> = {
  task_created: '✨',
  task_updated: '📝',
  status_changed: '🔄',
  message_sent: '💬',
  approval_requested: '✋',
  approval_decided: '✅',
  broadcast_sent: '📢',
  user_assigned: '👤',
};

const priorityColors = {
  low: 'from-blue-500 to-blue-600',
  normal: 'from-gray-500 to-gray-600',
  high: 'from-orange-500 to-orange-600',
  urgent: 'from-red-500 to-red-600',
};

export default function CardWallPhysics({ activities }: CardWallPhysicsProps) {
  const [visibleActivities, setVisibleActivities] = useState<ActivityEvent[]>([]);
  const stackHeightRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    // Add new activities gradually
    setVisibleActivities(activities.slice(0, 20));
  }, [activities]);

  const getStackPosition = (type: ActivityEvent['type'], index: number) => {
    // Create columns by type
    const columns: Record<ActivityEvent['type'], number> = {
      task_created: 0,
      task_updated: 1,
      status_changed: 2,
      message_sent: 3,
      approval_requested: 4,
      approval_decided: 5,
      broadcast_sent: 6,
      user_assigned: 7,
    };

    const columnIndex = columns[type] || 0;
    const cardWidth = 200;
    const cardHeight = 140;
    const gap = 10;

    // Calculate how many cards are already in this column
    const cardsInColumn = visibleActivities
      .slice(0, index)
      .filter(a => a.type === type).length;

    return {
      x: columnIndex * (cardWidth + gap) + gap,
      y: window.innerHeight - (cardsInColumn + 1) * (cardHeight + gap),
    };
  };

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
      {/* Column headers */}
      <div className="absolute top-0 left-0 right-0 flex gap-2 p-2 bg-background/80 backdrop-blur-sm border-b border-border z-10">
        {Object.entries(typeEmojis).map(([type, emoji]) => (
          <div
            key={type}
            className="flex-1 text-center p-2 bg-card rounded border border-border"
          >
            <div className="text-2xl mb-1">{emoji}</div>
            <div className="text-xs font-medium capitalize">
              {type.replace(/_/g, ' ')}
            </div>
          </div>
        ))}
      </div>

      {/* Falling cards */}
      <div className="absolute inset-0 pt-24">
        <AnimatePresence>
          {visibleActivities.map((activity, index) => {
            const position = getStackPosition(activity.type, index);

            return (
              <motion.div
                key={activity.id}
                initial={{
                  x: position.x,
                  y: -200,
                  rotate: Math.random() * 20 - 10,
                  opacity: 0,
                }}
                animate={{
                  x: position.x,
                  y: position.y,
                  rotate: (Math.random() - 0.5) * 3,
                  opacity: 1,
                }}
                exit={{
                  opacity: 0,
                  scale: 0,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 80,
                  damping: 15,
                  delay: index * 0.1,
                }}
                className="absolute"
                style={{
                  width: '190px',
                  zIndex: index,
                }}
              >
                <motion.div
                  whileHover={{
                    scale: 1.05,
                    rotate: 0,
                    zIndex: 1000,
                  }}
                  className={`
                    p-4 rounded-lg shadow-lg border border-white/20
                    bg-gradient-to-br ${priorityColors[activity.priority || 'normal']}
                    text-white cursor-pointer
                  `}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-3xl">{typeEmojis[activity.type]}</div>
                    {activity.priority === 'urgent' && (
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        className="bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-bold"
                      >
                        URGENT
                      </motion.div>
                    )}
                  </div>

                  {/* Card content */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-sm">
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span className="font-semibold truncate">{activity.userName}</span>
                    </div>
                    
                    <div className="font-medium text-sm truncate">{activity.title}</div>
                    
                    {activity.description && (
                      <div className="text-xs opacity-90 truncate">{activity.description}</div>
                    )}

                    <div className="flex items-center gap-1 text-xs opacity-75 pt-2 border-t border-white/20">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(activity.timestamp)}</span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Info overlay */}
      <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-4 text-white z-20">
        <div className="text-sm space-y-1">
          <div className="font-semibold">Physics Card Wall</div>
          <div className="text-xs opacity-75">Cards fall and stack by type</div>
          <div className="text-xs opacity-75">Hover to lift cards</div>
          <div className="text-xs opacity-75 mt-2">
            {visibleActivities.length} cards displayed
          </div>
        </div>
      </div>

      {visibleActivities.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p className="text-lg">No cards to display</p>
            <p className="text-sm">Activities will fall from above when they occur</p>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
