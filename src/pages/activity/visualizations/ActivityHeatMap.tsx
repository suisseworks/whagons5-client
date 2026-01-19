import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ActivityEvent } from '../ActivityMonitor';

interface ActivityHeatMapProps {
  activities: ActivityEvent[];
}

export default function ActivityHeatMap({ activities }: ActivityHeatMapProps) {
  // Create 5-minute time slots for the last hour
  const timeSlots = useMemo(() => {
    const slots: Array<{ time: Date; activities: ActivityEvent[]; count: number }> = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const slotTime = new Date(now.getTime() - i * 5 * 60 * 1000);
      const slotActivities = activities.filter(a => {
        const diff = slotTime.getTime() - a.timestamp.getTime();
        return diff >= 0 && diff < 5 * 60 * 1000;
      });
      
      slots.push({
        time: slotTime,
        activities: slotActivities,
        count: slotActivities.length,
      });
    }
    
    return slots;
  }, [activities]);

  const maxCount = Math.max(...timeSlots.map(s => s.count), 1);

  const typeColors: Record<ActivityEvent['type'], string> = {
    task_created: '#3b82f6',
    task_updated: '#8b5cf6',
    status_changed: '#10b981',
    message_sent: '#f59e0b',
    approval_requested: '#f97316',
    approval_decided: '#14b8a6',
    broadcast_sent: '#ec4899',
    user_assigned: '#6366f1',
  };

  return (
    <div className="h-full w-full bg-gradient-to-br from-background via-muted/20 to-background p-8 overflow-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Time grid */}
        <div className="grid grid-cols-12 gap-4">
          {timeSlots.map((slot, index) => {
            const intensity = slot.count / maxCount;
            const bgOpacity = Math.max(0.1, intensity);
            
            return (
              <motion.div
                key={slot.time.toISOString()}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="group relative"
              >
                <motion.div
                  animate={{
                    scale: slot.count > 0 ? [1, 1.05, 1] : 1,
                  }}
                  transition={{
                    repeat: slot.count > 0 ? Infinity : 0,
                    duration: 2,
                    delay: index * 0.2,
                  }}
                  className={`
                    aspect-square rounded-lg border-2 border-border/40
                    hover:border-primary hover:shadow-lg
                    transition-all duration-200 cursor-pointer
                    relative overflow-hidden
                  `}
                  style={{
                    backgroundColor: `rgba(99, 102, 241, ${bgOpacity})`,
                  }}
                >
                  {/* Pulse effect for active slots */}
                  {slot.count > 0 && (
                    <motion.div
                      className="absolute inset-0 bg-primary/30"
                      animate={{
                        opacity: [0, 0.5, 0],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 2,
                        delay: index * 0.2,
                      }}
                    />
                  )}

                  {/* Count badge */}
                  {slot.count > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white drop-shadow-lg">
                        {slot.count}
                      </span>
                    </div>
                  )}

                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 w-64">
                    <div className="bg-popover text-popover-foreground px-3 py-3 rounded-lg shadow-xl border border-border">
                      <div className="font-semibold mb-2 flex items-center justify-between">
                        <span>{slot.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="text-primary">{slot.count} activities</span>
                      </div>
                      {slot.activities.slice(0, 3).map((activity, i) => (
                        <div key={i} className="text-xs text-muted-foreground truncate">
                          • {activity.userName}: {activity.title}
                        </div>
                      ))}
                      {slot.activities.length > 3 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          +{slot.activities.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Time label */}
                <div className="text-xs text-center mt-2 text-muted-foreground">
                  {slot.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Activity type breakdown */}
        <div className="mt-12 pt-6 border-t border-border/40">
          <h3 className="text-lg font-semibold mb-4">Activity Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(typeColors).map(([type, color]) => {
              const count = activities.filter(a => a.type === type).length;
              return (
                <motion.div
                  key={type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border/40"
                >
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium capitalize">
                      {type.replace(/_/g, ' ')}
                    </div>
                    <div className="text-2xl font-bold">{count}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-primary/10 border border-border" />
            <span>Low activity</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-primary/50 border border-border" />
            <span>Medium activity</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-primary border border-border" />
            <span>High activity</span>
          </div>
        </div>
      </div>
    </div>
  );
}
