import { useEffect, useRef } from 'react';
import { ActivityEvent } from '../ActivityMonitor';

interface ParticleGalaxyProps {
  activities: ActivityEvent[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  activity: ActivityEvent;
  alpha: number;
}

export default function ParticleGalaxy({ activities }: ParticleGalaxyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();

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

    // Initialize particles from activities
    particlesRef.current = activities.slice(0, 100).map(activity => {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 200 + 100;
      const centerX = canvas.offsetWidth / 2;
      const centerY = canvas.offsetHeight / 2;

      return {
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: activity.priority === 'urgent' ? 8 : activity.priority === 'high' ? 6 : 4,
        color: typeColors[activity.type],
        activity,
        alpha: 1,
      };
    });

    // Animation loop
    const animate = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      const centerX = width / 2;
      const centerY = height / 2;

      // Fade background for trail effect
      ctx.fillStyle = 'rgba(15, 23, 42, 0.1)';
      ctx.fillRect(0, 0, width, height);

      // Update and draw particles
      particlesRef.current.forEach(particle => {
        // Orbital motion around center
        const dx = centerX - particle.x;
        const dy = centerY - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const force = 0.1;
        
        particle.vx += (dx / distance) * force;
        particle.vy += (dy / distance) * force;

        // Orbital velocity
        const orbitalForce = 0.3;
        particle.vx += (-dy / distance) * orbitalForce;
        particle.vy += (dx / distance) * orbitalForce;

        // Apply friction
        particle.vx *= 0.99;
        particle.vy *= 0.99;

        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Draw particle glow
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.radius * 3
        );
        gradient.addColorStop(0, particle.color);
        gradient.addColorStop(0.5, particle.color + '80');
        gradient.addColorStop(1, particle.color + '00');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * 3, 0, Math.PI * 2);
        ctx.fill();

        // Draw particle core
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw connections between nearby particles
        particlesRef.current.forEach(other => {
          if (other === particle) return;
          const dx = other.x - particle.x;
          const dy = other.y - particle.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `${particle.color}${Math.floor((1 - dist / 100) * 50).toString(16).padStart(2, '0')}`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      });

      // Draw center attraction point
      ctx.fillStyle = 'rgba(99, 102, 241, 0.3)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(99, 102, 241, 0.8)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
      ctx.fill();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [activities, typeColors]);

  return (
    <div className="relative h-full w-full bg-slate-950 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
      
      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-4 text-white">
        <div className="text-sm space-y-1">
          <div className="font-semibold mb-2">Activity Galaxy</div>
          <div className="text-xs opacity-75">
            {activities.length} activities orbiting
          </div>
          <div className="text-xs opacity-75">
            Connected by collaboration
          </div>
        </div>
      </div>
    </div>
  );
}
