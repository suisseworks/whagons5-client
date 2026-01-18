import { useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ActivityEvent } from '../ActivityMonitor';

interface NetworkGraphProps {
  activities: ActivityEvent[];
}

interface Node {
  id: number;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  activityCount: number;
}

interface Link {
  source: number;
  target: number;
  type: ActivityEvent['type'];
  timestamp: Date;
}

export default function NetworkGraph({ activities }: NetworkGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  // Extract nodes and links from activities
  const { nodes, links } = useMemo(() => {
    const nodeMap = new Map<number, Node>();
    const linkList: Link[] = [];

    activities.forEach(activity => {
      // Add source user node
      if (!nodeMap.has(activity.userId)) {
        nodeMap.set(activity.userId, {
          id: activity.userId,
          name: activity.userName,
          x: Math.random() * 800 + 100,
          y: Math.random() * 400 + 100,
          vx: 0,
          vy: 0,
          activityCount: 0,
        });
      }
      const node = nodeMap.get(activity.userId)!;
      node.activityCount++;

      // Add target user node and link for interactions
      if (activity.relatedUserId) {
        if (!nodeMap.has(activity.relatedUserId)) {
          nodeMap.set(activity.relatedUserId, {
            id: activity.relatedUserId,
            name: `User ${activity.relatedUserId}`,
            x: Math.random() * 800 + 100,
            y: Math.random() * 400 + 100,
            vx: 0,
            vy: 0,
            activityCount: 0,
          });
        }

        linkList.push({
          source: activity.userId,
          target: activity.relatedUserId,
          type: activity.type,
          timestamp: activity.timestamp,
        });
      }
    });

    return {
      nodes: Array.from(nodeMap.values()),
      links: linkList.slice(0, 30), // Limit links for performance
    };
  }, [activities]);

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

    // Simple force simulation
    const animate = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;

      ctx.clearRect(0, 0, width, height);

      // Apply forces
      nodes.forEach(node => {
        // Center attraction
        const centerX = width / 2;
        const centerY = height / 2;
        const dx = centerX - node.x;
        const dy = centerY - node.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        node.vx += dx / distance * 0.1;
        node.vy += dy / distance * 0.1;

        // Node repulsion
        nodes.forEach(other => {
          if (node.id === other.id) return;
          const dx = other.x - node.x;
          const dy = other.y - node.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 100) {
            const force = (100 - distance) / 100;
            node.vx -= dx / distance * force * 2;
            node.vy -= dy / distance * force * 2;
          }
        });

        // Apply velocity with damping
        node.vx *= 0.9;
        node.vy *= 0.9;
        node.x += node.vx;
        node.y += node.vy;

        // Boundary constraints
        node.x = Math.max(60, Math.min(width - 60, node.x));
        node.y = Math.max(60, Math.min(height - 60, node.y));
      });

      // Draw links
      links.forEach(link => {
        const source = nodes.find(n => n.id === link.source);
        const target = nodes.find(n => n.id === link.target);
        if (!source || !target) return;

        const age = Date.now() - link.timestamp.getTime();
        const opacity = Math.max(0, 1 - age / 10000); // Fade over 10 seconds

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = `rgba(99, 102, 241, ${opacity * 0.5})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw animated particles along links
        if (opacity > 0.5) {
          const t = (Date.now() % 2000) / 2000;
          const x = source.x + (target.x - source.x) * t;
          const y = source.y + (target.y - source.y) * t;
          
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(99, 102, 241, ${opacity})`;
          ctx.fill();
        }
      });

      // Draw nodes
      nodes.forEach(node => {
        const radius = 20 + Math.min(node.activityCount * 2, 20);

        // Node glow
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius + 10);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 10, 0, Math.PI * 2);
        ctx.fill();

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#6366f1';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Node label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.name.split(' ')[0], node.x, node.y);

        // Activity count badge
        if (node.activityCount > 0) {
          const badgeX = node.x + radius - 8;
          const badgeY = node.y - radius + 8;
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, 12, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText(String(node.activityCount), badgeX, badgeY);
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [nodes, links]);

  return (
    <div className="relative h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
      
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-4 text-white"
      >
        <div className="text-sm space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span>Active Users: {nodes.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-primary/50" />
            <span>Interactions: {links.length}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
