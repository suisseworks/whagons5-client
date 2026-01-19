import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ActivityEvent } from '../ActivityMonitor';

interface MusicVisualizerProps {
  activities: ActivityEvent[];
}

export default function MusicVisualizer({ activities }: MusicVisualizerProps) {
  // Group activities by user
  const userBars = useMemo(() => {
    const users = new Map<number, { name: string; count: number; recentActivity: ActivityEvent | null }>();
    
    activities.forEach(activity => {
      if (!users.has(activity.userId)) {
        users.set(activity.userId, {
          name: activity.userName,
          count: 0,
          recentActivity: null,
        });
      }
      const user = users.get(activity.userId)!;
      user.count++;
      if (!user.recentActivity || activity.timestamp > user.recentActivity.timestamp) {
        user.recentActivity = activity;
      }
    });

    return Array.from(users.entries()).map(([id, data]) => ({
      userId: id,
      userName: data.name,
      count: data.count,
      recentActivity: data.recentActivity,
    }));
  }, [activities]);

  const maxCount = Math.max(...userBars.map(u => u.count), 1);

  const barColors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', 
    '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'
  ];

  return (
    <div className="h-full w-full bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950 flex items-end justify-center p-8 overflow-hidden">
      <div className="flex items-end justify-center gap-2 w-full max-w-6xl">
        {userBars.map((user, index) => {
          const heightPercent = (user.count / maxCount) * 80 + 20;
          const color = barColors[index % barColors.length];
          
          return (
            <motion.div
              key={user.userId}
              className="flex-1 relative group cursor-pointer"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{
                type: 'spring',
                stiffness: 200,
                damping: 20,
                delay: index * 0.05,
              }}
              style={{
                transformOrigin: 'bottom',
              }}
            >
              {/* Bar */}
              <motion.div
                animate={{
                  height: `${heightPercent}%`,
                  scaleY: [1, 1.05, 1, 0.95, 1],
                }}
                transition={{
                  height: {
                    type: 'spring',
                    stiffness: 100,
                    damping: 15,
                  },
                  scaleY: {
                    repeat: Infinity,
                    duration: 1.5 + Math.random() * 0.5,
                    ease: 'easeInOut',
                  },
                }}
                className="w-full rounded-t-lg relative overflow-hidden shadow-lg"
                style={{
                  background: `linear-gradient(to top, ${color}, ${color}dd)`,
                }}
              >
                {/* Animated wave overlay */}
                <motion.div
                  className="absolute inset-0"
                  animate={{
                    backgroundPosition: ['0% 0%', '100% 100%'],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                  style={{
                    background: `linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)`,
                    backgroundSize: '200% 200%',
                  }}
                />

                {/* Activity count badge */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2">
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 2,
                      delay: index * 0.1,
                    }}
                    className="bg-white/90 backdrop-blur-sm text-slate-900 font-bold text-sm px-2 py-1 rounded-full shadow-lg"
                  >
                    {user.count}
                  </motion.div>
                </div>

                {/* Glow effect */}
                <div
                  className="absolute -inset-1 blur-xl opacity-50"
                  style={{ backgroundColor: color }}
                />
              </motion.div>

              {/* User label */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <div className="bg-popover text-popover-foreground px-3 py-2 rounded-lg shadow-xl border border-border whitespace-nowrap">
                  <div className="font-semibold text-sm">{user.userName}</div>
                  <div className="text-xs text-muted-foreground">{user.count} activities</div>
                  {user.recentActivity && (
                    <div className="text-xs text-muted-foreground mt-1 border-t border-border/40 pt-1">
                      Latest: {user.recentActivity.title}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom label */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-center">
                <div className="text-xs text-white/70 truncate max-w-[80px]">
                  {user.userName.split(' ')[0]}
                </div>
              </div>
            </motion.div>
          );
        })}

        {userBars.length === 0 && (
          <div className="text-white text-center py-20">
            <p>No activity data</p>
          </div>
        )}
      </div>

      {/* Audio wave effect background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"
            style={{
              top: `${20 + i * 15}%`,
            }}
            animate={{
              opacity: [0.2, 0.5, 0.2],
              scaleX: [0.8, 1, 0.8],
            }}
            transition={{
              repeat: Infinity,
              duration: 3,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>

      {/* Info overlay */}
      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-4 text-white">
        <div className="text-sm space-y-1">
          <div className="font-semibold">Music Visualizer Mode</div>
          <div className="text-xs opacity-75">Bar height = activity count</div>
          <div className="text-xs opacity-75">Hover to see details</div>
        </div>
      </div>
    </div>
  );
}
