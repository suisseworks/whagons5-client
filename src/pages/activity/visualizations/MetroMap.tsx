import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ActivityEvent } from '../ActivityMonitor';

interface MetroMapProps {
  activities: ActivityEvent[];
}

export default function MetroMap({ activities }: MetroMapProps) {
  // Create metro lines (user paths)
  const metroLines = useMemo(() => {
    const lines = new Map<number, { name: string; activities: ActivityEvent[]; color: string }>();
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    
    activities.forEach((activity, index) => {
      if (!lines.has(activity.userId)) {
        lines.set(activity.userId, {
          name: activity.userName,
          activities: [],
          color: colors[lines.size % colors.length],
        });
      }
      lines.get(activity.userId)!.activities.push(activity);
    });

    return Array.from(lines.values()).slice(0, 6); // Show max 6 lines
  }, [activities]);

  return (
    <div className="h-full w-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 p-8 overflow-auto">
      <div className="max-w-6xl mx-auto">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold mb-2">Activity Transit Map</h2>
          <p className="text-muted-foreground">Real-time activity flowing through your system</p>
        </motion.div>

        {/* Metro lines */}
        <div className="space-y-12">
          {metroLines.map((line, lineIndex) => (
            <motion.div
              key={line.name}
              initial={{ opacity: 0, x: -100 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: lineIndex * 0.2 }}
              className="relative"
            >
              {/* Line header */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg"
                  style={{ backgroundColor: line.color }}
                >
                  {lineIndex + 1}
                </div>
                <div>
                  <div className="font-bold">{line.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {line.activities.length} stops
                  </div>
                </div>
              </div>

              {/* Stations */}
              <div className="relative pl-12">
                {/* Line track */}
                <div
                  className="absolute left-4 top-0 bottom-0 w-1 rounded-full"
                  style={{ backgroundColor: line.color }}
                />

                {/* Stations (activities) */}
                <div className="space-y-6">
                  {line.activities.slice(0, 8).map((activity, actIndex) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: lineIndex * 0.2 + actIndex * 0.1 }}
                      className="relative flex items-center gap-4"
                    >
                      {/* Station dot */}
                      <motion.div
                        animate={{
                          scale: [1, 1.2, 1],
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 2,
                          delay: actIndex * 0.2,
                        }}
                        className="absolute -left-8 w-4 h-4 rounded-full border-4 border-background shadow-lg z-10"
                        style={{ backgroundColor: line.color }}
                      />

                      {/* Station card */}
                      <div className="flex-1 bg-card rounded-lg border border-border p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-semibold mb-1">{activity.title}</div>
                            {activity.description && (
                              <div className="text-sm text-muted-foreground mb-2">
                                {activity.description}
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{formatTimeAgo(activity.timestamp)}</span>
                              {activity.priority && (
                                <>
                                  <span>•</span>
                                  <span className="font-medium uppercase">{activity.priority}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Activity type badge */}
                          <div
                            className="px-2 py-1 rounded text-xs font-medium text-white"
                            style={{ backgroundColor: line.color }}
                          >
                            {activity.type.split('_')[0]}
                          </div>
                        </div>
                      </div>

                      {/* Animated train */}
                      {actIndex === 0 && (
                        <motion.div
                          animate={{
                            y: [0, -10, 0],
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: 2,
                          }}
                          className="absolute -left-10 text-2xl"
                        >
                          🚇
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {metroLines.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p>No metro lines to display</p>
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
