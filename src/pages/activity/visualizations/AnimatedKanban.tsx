import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityEvent } from '../ActivityMonitor';
import { Clock, User } from 'lucide-react';

interface AnimatedKanbanProps {
  activities: ActivityEvent[];
}

const lanes = [
  { id: 'task_created', title: 'Tasks Created', color: 'bg-blue-500' },
  { id: 'task_updated', title: 'Updates', color: 'bg-purple-500' },
  { id: 'status_changed', title: 'Status Changes', color: 'bg-green-500' },
  { id: 'message_sent', title: 'Messages', color: 'bg-yellow-500' },
  { id: 'approval_requested', title: 'Approvals', color: 'bg-orange-500' },
  { id: 'user_assigned', title: 'Assignments', color: 'bg-pink-500' },
];

export default function AnimatedKanban({ activities }: AnimatedKanbanProps) {
  // Group activities by type
  const groupedActivities = useMemo(() => {
    const groups: Record<string, ActivityEvent[]> = {};
    lanes.forEach(lane => {
      groups[lane.id] = activities
        .filter(a => a.type === lane.id)
        .slice(0, 5); // Show only last 5 per lane
    });
    return groups;
  }, [activities]);

  // Count total activities per lane
  const laneCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    lanes.forEach(lane => {
      counts[lane.id] = activities.filter(a => a.type === lane.id).length;
    });
    return counts;
  }, [activities]);

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden bg-gradient-to-br from-background via-muted/10 to-background p-6">
      <div className="flex gap-4 h-full min-w-max">
        {lanes.map(lane => (
          <motion.div
            key={lane.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col w-80 bg-card/50 backdrop-blur-sm rounded-lg border border-border/40 overflow-hidden"
          >
            {/* Lane header */}
            <div className={`${lane.color} bg-opacity-20 dark:bg-opacity-30 p-4 border-b border-border/40`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{lane.title}</h3>
                <motion.div
                  key={laneCounts[lane.id]}
                  initial={{ scale: 1.5 }}
                  animate={{ scale: 1 }}
                  className={`${lane.color} text-white px-2 py-1 rounded-full text-xs font-bold min-w-[24px] text-center`}
                >
                  {laneCounts[lane.id]}
                </motion.div>
              </div>
            </div>

            {/* Lane content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <AnimatePresence mode="popLayout">
                {groupedActivities[lane.id]?.map((activity, index) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, scale: 0.8, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: -50 }}
                    transition={{
                      type: 'spring',
                      stiffness: 300,
                      damping: 30,
                      delay: index * 0.05,
                    }}
                    layout
                    className="p-3 bg-background/80 backdrop-blur-sm rounded-md border border-border/40 hover:shadow-md hover:border-primary/40 transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <User className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{activity.userName}</p>
                        <p className="text-xs text-muted-foreground truncate">{activity.title}</p>
                      </div>
                    </div>
                    
                    {activity.description && (
                      <p className="text-xs text-muted-foreground mb-2 truncate">
                        {activity.description}
                      </p>
                    )}

                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(activity.timestamp)}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {groupedActivities[lane.id]?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No activity
                </div>
              )}
            </div>
          </motion.div>
        ))}
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
