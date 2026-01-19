import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityEvent } from '../ActivityMonitor';
import { Clock } from 'lucide-react';

interface TimelineSwimLanesProps {
  activities: ActivityEvent[];
}

export default function TimelineSwimLanes({ activities }: TimelineSwimLanesProps) {
  // Group activities by user
  const userLanes = useMemo(() => {
    const lanes = new Map<number, { name: string; activities: ActivityEvent[] }>();
    
    activities.forEach(activity => {
      if (!lanes.has(activity.userId)) {
        lanes.set(activity.userId, {
          name: activity.userName,
          activities: [],
        });
      }
      lanes.get(activity.userId)!.activities.push(activity);
    });

    // Sort each lane by timestamp
    lanes.forEach(lane => {
      lane.activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      lane.activities = lane.activities.slice(0, 10); // Keep only last 10
    });

    return Array.from(lanes.values());
  }, [activities]);

  const typeColors: Record<ActivityEvent['type'], string> = {
    task_created: 'bg-blue-500',
    task_updated: 'bg-purple-500',
    status_changed: 'bg-green-500',
    message_sent: 'bg-yellow-500',
    approval_requested: 'bg-orange-500',
    approval_decided: 'bg-teal-500',
    broadcast_sent: 'bg-pink-500',
    user_assigned: 'bg-indigo-500',
  };

  return (
    <div className="h-full overflow-auto bg-gradient-to-r from-background via-muted/10 to-background p-6">
      {/* Timeline header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/40 pb-4 mb-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">Timeline View - Last 5 Minutes</span>
        </div>
      </div>

      {/* Swim lanes */}
      <div className="space-y-6">
        {userLanes.map((lane, laneIndex) => (
          <motion.div
            key={lane.name}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: laneIndex * 0.1 }}
            className="relative"
          >
            {/* Lane header */}
            <div className="flex items-center gap-4 mb-3">
              <div className="w-32 flex-shrink-0">
                <div className="font-semibold text-sm truncate">{lane.name}</div>
                <div className="text-xs text-muted-foreground">
                  {lane.activities.length} {lane.activities.length === 1 ? 'activity' : 'activities'}
                </div>
              </div>
              
              {/* Timeline track */}
              <div className="flex-1 h-px bg-border/40" />
            </div>

            {/* Activity cards on timeline */}
            <div className="relative pl-32">
              <div className="relative h-20">
                <AnimatePresence>
                  {lane.activities.map((activity, index) => {
                    // Position based on time (newer = further right)
                    const ageSeconds = (Date.now() - activity.timestamp.getTime()) / 1000;
                    const leftPercent = Math.max(0, 100 - (ageSeconds / 3)); // Spread over 5 min
                    
                    return (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0 }}
                        transition={{
                          type: 'spring',
                          stiffness: 300,
                          damping: 25,
                        }}
                        style={{
                          position: 'absolute',
                          left: `${leftPercent}%`,
                          top: `${(index % 3) * 30}px`,
                        }}
                        className="group"
                      >
                        <div
                          className={`
                            ${typeColors[activity.type]}
                            text-white px-3 py-2 rounded-md shadow-lg
                            text-xs font-medium whitespace-nowrap
                            hover:scale-110 transition-transform cursor-pointer
                            relative
                          `}
                        >
                          {activity.title}
                          
                          {/* Tooltip on hover */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                            <div className="bg-popover text-popover-foreground px-3 py-2 rounded-md shadow-lg text-xs whitespace-normal w-48 border border-border">
                              <div className="font-semibold mb-1">{activity.title}</div>
                              {activity.description && (
                                <div className="text-muted-foreground mb-1">{activity.description}</div>
                              )}
                              <div className="text-muted-foreground">{formatTimeAgo(activity.timestamp)}</div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        ))}

        {userLanes.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p>No activity to display</p>
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
