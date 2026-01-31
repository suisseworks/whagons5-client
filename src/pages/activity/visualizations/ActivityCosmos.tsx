import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityEvent } from '../ActivityMonitor';
import { Clock, User, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/providers/LanguageProvider';

interface ActivityCosmosProps {
  activities: ActivityEvent[];
}

interface UserNode {
  id: number;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  activityCount: number;
  color: string;
}

interface ActivityParticle {
  id: string;
  activity: ActivityEvent;
  x: number;
  y: number;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  size: number;
  color: string;
  alpha: number;
  isNew: boolean;
  birthTime: number;
}

interface Connection {
  sourceId: number;
  targetId: number;
  type: ActivityEvent['type'];
  timestamp: Date;
  particleProgress: number;
}

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

const userColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'];

// formatTimeAgo is now handled inside the component with translations

export default function ActivityCosmos({ activities }: ActivityCosmosProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const userNodesRef = useRef<Map<number, UserNode>>(new Map());
  const particlesRef = useRef<ActivityParticle[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const animationRef = useRef<number>();
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const starsRef = useRef<{ x: number; y: number; size: number; alpha: number }[]>([]);
  const processedActivitiesRef = useRef<Set<string>>(new Set());
  
  const [hoveredParticle, setHoveredParticle] = useState<ActivityParticle | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const { t } = useLanguage();

  // Format time ago with translations
  const formatTimeAgo = useCallback((date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return t('activity.time.justNow', 'just now');
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return t('activity.time.minutesAgo', '{count}m ago').replace('{count}', String(minutes));
    }
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return t('activity.time.hoursAgo', '{count}h ago').replace('{count}', String(hours));
    }
    const days = Math.floor(seconds / 86400);
    return t('activity.time.daysAgo', '{count}d ago').replace('{count}', String(days));
  }, [t]);

  // Generate star field once
  useEffect(() => {
    starsRef.current = Array.from({ length: 150 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.5 + 0.2,
    }));
  }, []);

  // Process activities into nodes and particles
  const processActivities = useCallback((width: number, height: number) => {
    const userNodes = userNodesRef.current;
    const particles = particlesRef.current;
    const connections = connectionsRef.current;
    const processedIds = processedActivitiesRef.current;
    const centerX = width / 2;
    const centerY = height / 2;

    activities.forEach((activity, index) => {
      // Create or update user node
      if (!userNodes.has(activity.userId)) {
        const angle = (userNodes.size / 8) * Math.PI * 2;
        const distance = 150 + Math.random() * 100;
        userNodes.set(activity.userId, {
          id: activity.userId,
          name: activity.userName,
          x: centerX + Math.cos(angle) * distance,
          y: centerY + Math.sin(angle) * distance,
          vx: 0,
          vy: 0,
          activityCount: 0,
          color: userColors[userNodes.size % userColors.length],
        });
      }

      const userNode = userNodes.get(activity.userId)!;
      userNode.activityCount++;

      // Create activity particle if new
      if (!processedIds.has(activity.id)) {
        processedIds.add(activity.id);
        
        const prioritySizes: Record<string, number> = {
          urgent: 10,
          high: 8,
          normal: 6,
          low: 4,
        };

        // New particles start at edge for burst animation
        const entryAngle = Math.random() * Math.PI * 2;
        const entryDistance = Math.max(width, height);
        
        particles.push({
          id: activity.id,
          activity,
          x: centerX + Math.cos(entryAngle) * entryDistance,
          y: centerY + Math.sin(entryAngle) * entryDistance,
          orbitRadius: 50 + Math.random() * 40,
          orbitAngle: Math.random() * Math.PI * 2,
          orbitSpeed: 0.005 + Math.random() * 0.01,
          size: prioritySizes[activity.priority || 'normal'],
          color: typeColors[activity.type],
          alpha: 1,
          isNew: true,
          birthTime: Date.now(),
        });

        // Create connection if there's a related user
        if (activity.relatedUserId && activity.relatedUserId !== activity.userId) {
          connections.push({
            sourceId: activity.userId,
            targetId: activity.relatedUserId,
            type: activity.type,
            timestamp: activity.timestamp,
            particleProgress: 0,
          });
        }
      }
    });

    // Limit particles to prevent performance issues
    if (particles.length > 100) {
      particles.splice(0, particles.length - 100);
    }

    // Clean old connections
    const now = Date.now();
    connectionsRef.current = connections.filter(c => 
      now - c.timestamp.getTime() < 15000
    );
  }, [activities]);

  // Mouse move handler for hover detection
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setHoverPosition({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      const centerX = width / 2;
      const centerY = height / 2;
      const now = Date.now();

      // Process any new activities
      processActivities(width, height);

      // Clear with space background
      const bgGradient = ctx.createLinearGradient(0, 0, width, height);
      bgGradient.addColorStop(0, '#020617');
      bgGradient.addColorStop(0.5, '#0f172a');
      bgGradient.addColorStop(1, '#020617');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Draw stars
      starsRef.current.forEach(star => {
        const twinkle = Math.sin(now / 1000 + star.x * 10) * 0.2 + 0.8;
        ctx.beginPath();
        ctx.arc(star.x * width, star.y * height, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha * twinkle})`;
        ctx.fill();
      });

      const userNodes = userNodesRef.current;
      const particles = particlesRef.current;
      const connections = connectionsRef.current;

      // Update user node physics
      userNodes.forEach(node => {
        // Attraction to center
        const dx = centerX - node.x;
        const dy = centerY - node.y;
        const distToCenter = Math.sqrt(dx * dx + dy * dy);
        if (distToCenter > 50) {
          node.vx += (dx / distToCenter) * 0.05;
          node.vy += (dy / distToCenter) * 0.05;
        }

        // Repulsion from other nodes
        userNodes.forEach(other => {
          if (node.id === other.id) return;
          const dx = other.x - node.x;
          const dy = other.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200 && dist > 0) {
            const force = (200 - dist) / 200 * 1.5;
            node.vx -= (dx / dist) * force;
            node.vy -= (dy / dist) * force;
          }
        });

        // Apply velocity with damping
        node.vx *= 0.92;
        node.vy *= 0.92;
        node.x += node.vx;
        node.y += node.vy;

        // Boundary constraints
        const margin = 100;
        node.x = Math.max(margin, Math.min(width - margin, node.x));
        node.y = Math.max(margin, Math.min(height - margin, node.y));
      });

      // Draw connections between users
      connections.forEach(conn => {
        const source = userNodes.get(conn.sourceId);
        const target = userNodes.get(conn.targetId);
        if (!source || !target) return;

        const age = now - conn.timestamp.getTime();
        const opacity = Math.max(0, 1 - age / 15000);
        if (opacity <= 0) return;

        // Draw dashed connection line
        ctx.beginPath();
        ctx.setLineDash([5, 10]);
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = `rgba(148, 163, 184, ${opacity * 0.3})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw traveling particle
        conn.particleProgress = (conn.particleProgress + 0.01) % 1;
        const px = source.x + (target.x - source.x) * conn.particleProgress;
        const py = source.y + (target.y - source.y) * conn.particleProgress;
        
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.8})`;
        ctx.fill();
      });

      // Update and draw activity particles
      let hoveredP: ActivityParticle | null = null;

      particles.forEach(particle => {
        const userNode = userNodes.get(particle.activity.userId);
        if (!userNode) return;

        const age = now - particle.birthTime;
        const isEntering = age < 1000;

        if (isEntering) {
          // Animate entry: move toward user node
          const progress = age / 1000;
          const eased = 1 - Math.pow(1 - progress, 3);
          
          const targetX = userNode.x + Math.cos(particle.orbitAngle) * particle.orbitRadius;
          const targetY = userNode.y + Math.sin(particle.orbitAngle) * particle.orbitRadius;
          
          // Start from edge, move to orbit position
          const startAngle = Math.atan2(particle.y - centerY, particle.x - centerX);
          const startDist = Math.max(width, height);
          const startX = centerX + Math.cos(startAngle) * startDist;
          const startY = centerY + Math.sin(startAngle) * startDist;
          
          particle.x = startX + (targetX - startX) * eased;
          particle.y = startY + (targetY - startY) * eased;
          particle.isNew = false;
        } else {
          // Normal orbital motion
          particle.orbitAngle += particle.orbitSpeed;
          particle.x = userNode.x + Math.cos(particle.orbitAngle) * particle.orbitRadius;
          particle.y = userNode.y + Math.sin(particle.orbitAngle) * particle.orbitRadius;
        }

        // Check hover
        const dx = mouseRef.current.x - particle.x;
        const dy = mouseRef.current.y - particle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const isHovered = dist < particle.size + 10;
        if (isHovered) {
          hoveredP = particle;
        }

        // Draw particle glow
        const glowSize = particle.size * (isHovered ? 4 : 3);
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, glowSize
        );
        gradient.addColorStop(0, particle.color + 'cc');
        gradient.addColorStop(0.5, particle.color + '40');
        gradient.addColorStop(1, particle.color + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, glowSize, 0, Math.PI * 2);
        ctx.fill();

        // Draw particle core
        const coreSize = particle.size * (isHovered ? 1.3 : 1);
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, coreSize, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Urgent pulse effect
        if (particle.activity.priority === 'urgent') {
          const pulsePhase = (now % 1500) / 1500;
          const pulseSize = particle.size * (1.5 + pulsePhase);
          const pulseAlpha = 0.5 * (1 - pulsePhase);
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, pulseSize, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(239, 68, 68, ${pulseAlpha})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });

      // Draw user nodes
      userNodes.forEach(node => {
        const radius = 25 + Math.min(node.activityCount * 2, 15);

        // Outer glow
        const glowGradient = ctx.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, radius * 2
        );
        glowGradient.addColorStop(0, node.color + '60');
        glowGradient.addColorStop(0.5, node.color + '20');
        glowGradient.addColorStop(1, node.color + '00');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        const nodeGradient = ctx.createRadialGradient(
          node.x - radius * 0.3, node.y - radius * 0.3, 0,
          node.x, node.y, radius
        );
        nodeGradient.addColorStop(0, node.color);
        nodeGradient.addColorStop(1, node.color + 'cc');
        ctx.fillStyle = nodeGradient;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // User name
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const firstName = node.name.split(' ')[0];
        ctx.fillText(firstName, node.x, node.y);

        // Activity count badge
        if (node.activityCount > 0) {
          const badgeX = node.x + radius - 5;
          const badgeY = node.y - radius + 5;
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, 10, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 9px Inter, system-ui, sans-serif';
          ctx.fillText(String(node.activityCount), badgeX, badgeY);
        }
      });

      // Draw center gravity point
      const centerPulse = Math.sin(now / 500) * 0.2 + 0.8;
      const centerGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, 40
      );
      centerGradient.addColorStop(0, `rgba(99, 102, 241, ${0.3 * centerPulse})`);
      centerGradient.addColorStop(0.5, `rgba(99, 102, 241, ${0.1 * centerPulse})`);
      centerGradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
      ctx.fillStyle = centerGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(99, 102, 241, ${0.6 * centerPulse})`;
      ctx.fill();

      // Update hovered particle state
      setHoveredParticle(hoveredP);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousemove', handleMouseMove);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [processActivities, handleMouseMove]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
      />

      {/* Stats overlay */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-4 left-4 bg-black/60 backdrop-blur-md rounded-xl p-4 text-white border border-white/10"
      >
        <div className="text-lg font-bold mb-2 flex items-center gap-2">
          <span className="text-2xl">🌌</span>
          {t('activity.cosmos.title', 'Activity Cosmos')}
        </div>
        <div className="text-sm space-y-1 text-slate-300">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <span>{t('activity.cosmos.users', 'Users')}: {userNodesRef.current.size}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{t('activity.cosmos.activities', 'Activities')}: {activities.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span>{t('activity.cosmos.connections', 'Connections')}: {connectionsRef.current.length}</span>
          </div>
        </div>
      </motion.div>

      {/* Legend */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md rounded-xl p-3 text-white border border-white/10"
      >
        <div className="text-xs font-semibold mb-2 text-slate-400">{t('activity.types.title', 'Activity Types')}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {Object.entries(typeColors).slice(0, 8).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-slate-300">{t(`activity.types.${type}`, type.split('_').join(' '))}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Hover card */}
      <AnimatePresence>
        {hoveredParticle && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.15 }}
            className="fixed z-50 pointer-events-none"
            style={{
              left: hoverPosition.x + 15,
              top: hoverPosition.y - 10,
            }}
          >
            <div className="bg-slate-900/95 backdrop-blur-md rounded-lg border border-slate-700 p-4 shadow-2xl min-w-[250px]">
              <div className="flex items-start gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                  style={{ backgroundColor: hoveredParticle.color + '30' }}
                >
                  {typeIcons[hoveredParticle.activity.type]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span className="font-semibold text-white text-sm">
                      {hoveredParticle.activity.userName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-300 text-sm mb-2">
                    <ArrowRight className="w-3 h-3" />
                    <span>{hoveredParticle.activity.title}</span>
                  </div>
                  {hoveredParticle.activity.description && (
                    <p className="text-xs text-slate-400 mb-2">
                      {hoveredParticle.activity.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1 text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(hoveredParticle.activity.timestamp)}</span>
                    </div>
                    {hoveredParticle.activity.priority && (
                      <span 
                        className="px-2 py-0.5 rounded-full text-white font-medium"
                        style={{ 
                          backgroundColor: hoveredParticle.activity.priority === 'urgent' ? '#ef4444' :
                            hoveredParticle.activity.priority === 'high' ? '#f97316' :
                            hoveredParticle.activity.priority === 'normal' ? '#6b7280' : '#3b82f6'
                        }}
                      >
                        {hoveredParticle.activity.priority.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
