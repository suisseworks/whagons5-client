import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityEvent } from '../ActivityMonitor';
import { ChevronLeft, ChevronRight, User, Clock } from 'lucide-react';

interface CardCarousel3DProps {
  activities: ActivityEvent[];
}

export default function CardCarousel3D({ activities }: CardCarousel3DProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  useEffect(() => {
    if (!autoplay || activities.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % activities.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [autoplay, activities.length]);

  const handlePrevious = () => {
    setAutoplay(false);
    setCurrentIndex(prev => (prev - 1 + activities.length) % activities.length);
  };

  const handleNext = () => {
    setAutoplay(false);
    setCurrentIndex(prev => (prev + 1) % activities.length);
  };

  const getVisibleCards = () => {
    if (activities.length === 0) return [];
    
    const visible = [];
    for (let i = -2; i <= 2; i++) {
      const index = (currentIndex + i + activities.length) % activities.length;
      visible.push({ activity: activities[index], offset: i });
    }
    return visible;
  };

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

  const priorityGradients = {
    low: 'from-blue-500/20 to-blue-600/20',
    normal: 'from-gray-500/20 to-gray-600/20',
    high: 'from-orange-500/20 to-orange-600/20',
    urgent: 'from-red-500/20 to-red-600/20',
  };

  return (
    <div className="relative h-full w-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 overflow-hidden flex items-center justify-center">
      {/* 3D Carousel */}
      <div className="relative w-full h-full flex items-center justify-center perspective-1000">
        <AnimatePresence mode="popLayout">
          {getVisibleCards().map(({ activity, offset }) => {
            const isCenter = offset === 0;
            const scale = isCenter ? 1 : 0.7 - Math.abs(offset) * 0.1;
            const rotateY = offset * 25;
            const translateX = offset * 350;
            const translateZ = isCenter ? 0 : -200 - Math.abs(offset) * 100;
            const opacity = 1 - Math.abs(offset) * 0.3;

            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0 }}
                animate={{
                  scale,
                  rotateY,
                  x: translateX,
                  z: translateZ,
                  opacity,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 200,
                  damping: 30,
                }}
                className="absolute"
                style={{
                  transformStyle: 'preserve-3d',
                  zIndex: isCenter ? 10 : 5 - Math.abs(offset),
                }}
              >
                <div
                  className={`
                    w-96 h-64 rounded-2xl shadow-2xl
                    bg-gradient-to-br ${priorityGradients[activity.priority || 'normal']}
                    backdrop-blur-xl border border-white/20
                    p-6 flex flex-col
                    ${isCenter ? 'cursor-pointer hover:shadow-3xl' : ''}
                  `}
                  onClick={() => isCenter && setAutoplay(!autoplay)}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-6xl">{typeEmojis[activity.type]}</div>
                    {activity.priority === 'urgent' && (
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full"
                      >
                        URGENT
                      </motion.div>
                    )}
                  </div>

                  {/* Card content */}
                  <div className="flex-1 space-y-3 text-white">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      <span className="font-bold text-lg">{activity.userName}</span>
                    </div>
                    
                    <div className="text-xl font-semibold">{activity.title}</div>
                    
                    {activity.description && (
                      <p className="text-sm opacity-80 line-clamp-2">{activity.description}</p>
                    )}
                  </div>

                  {/* Card footer */}
                  <div className="flex items-center justify-between text-xs text-white/70 pt-4 border-t border-white/20">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(activity.timestamp)}</span>
                    </div>
                    <span className="font-mono">#{activity.metadata?.taskId || '---'}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-20">
        <button
          onClick={handlePrevious}
          className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-all"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        
        <div className="flex items-center gap-2">
          {activities.slice(0, 10).map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentIndex(index);
                setAutoplay(false);
              }}
              className={`
                w-2 h-2 rounded-full transition-all
                ${index === currentIndex % activities.length ? 'bg-white w-8' : 'bg-white/40'}
              `}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-all"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Autoplay indicator */}
      <div className="absolute top-8 right-8 z-20">
        <button
          onClick={() => setAutoplay(!autoplay)}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white text-sm transition-all"
        >
          {autoplay ? '⏸ Pause' : '▶ Play'}
        </button>
      </div>

      {activities.length === 0 && (
        <div className="text-white text-center">
          <p className="text-lg">No activities to display</p>
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
