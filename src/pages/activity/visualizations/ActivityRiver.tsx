import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityEvent } from '../ActivityMonitor';
import { Clock, User, ArrowRight } from 'lucide-react';

interface ActivityRiverProps {
  activities: ActivityEvent[];
}

const priorityColors = {
  low: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
  normal: 'bg-gray-500/10 border-gray-500/30 text-gray-600 dark:text-gray-400',
  high: 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400',
  urgent: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
};

const typeIcons: Record<ActivityEvent['type'], string> = {
  task_created: '✨',
  task_updated: '📝',
  status_changed: '🔄',
  message_sent: '💬',
  approval_requested: '✋',
  approval_decided: '✅',
  broadcast_sent: '📢',
  user_assigned: '👤',
};

export default function ActivityRiver({ activities }: ActivityRiverProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div 
      ref={containerRef}
      className="h-full overflow-y-auto overflow-x-hidden bg-gradient-to-b from-background to-muted/20 p-6"
    >
      <div className="max-w-4xl mx-auto space-y-4">
        <AnimatePresence mode="popLayout">
          {activities.map((activity, index) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: 100, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -100, scale: 0.8 }}
              transition={{
                type: 'spring',
                stiffness: 200,
                damping: 25,
                delay: index * 0.05,
              }}
              layout
              className={`
                relative p-4 rounded-lg border-2 
                ${priorityColors[activity.priority || 'normal']}
                backdrop-blur-sm
                hover:shadow-lg hover:scale-[1.02] transition-all duration-200
                cursor-pointer
              `}
            >
              {/* Activity card content */}
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                  {typeIcons[activity.type]}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4" />
                    <span className="font-semibold">{activity.userName}</span>
                    <ArrowRight className="w-3 h-3 opacity-50" />
                    <span className="text-sm opacity-75">{activity.title}</span>
                  </div>
                  
                  {activity.description && (
                    <p className="text-sm opacity-75 mb-2">{activity.description}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs opacity-60">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(activity.timestamp)}</span>
                    </div>
                    {activity.priority && (
                      <span className="px-2 py-0.5 rounded-full bg-current/10 font-medium">
                        {activity.priority.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Priority indicator */}
                {activity.priority === 'urgent' && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="flex-shrink-0 w-3 h-3 rounded-full bg-red-500"
                  />
                )}
              </div>

              {/* Flowing animation overlay */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear',
                  delay: index * 0.1,
                }}
                style={{ pointerEvents: 'none' }}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {activities.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <p className="text-lg font-medium mb-2">No activity yet</p>
              <p className="text-sm">Activity will appear here as it happens</p>
            </motion.div>
          </div>
        )}
      </div>
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
