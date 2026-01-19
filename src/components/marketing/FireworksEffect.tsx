import { useEffect, useRef } from "react";

interface FireworksEffectProps {
  onClose?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  trail: { x: number; y: number }[];
}

interface Firework {
  particles: Particle[];
  active: boolean;
}

export default function FireworksEffect({ onClose }: FireworksEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fireworksRef = useRef<Firework[]>([]);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to window size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff8800'];

    // Convert hex to rgba
    const hexToRgba = (hex: string, alpha: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Create a firework explosion
    const createFirework = (x: number, y: number) => {
      const particles: Particle[] = [];
      const particleCount = 50;
      const color = colors[Math.floor(Math.random() * colors.length)];

      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount;
        const velocity = Math.random() * 3 + 2;
        const maxLife = Math.random() * 60 + 60;
        
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          life: maxLife,
          maxLife: maxLife,
          color,
          size: Math.random() * 4 + 3,
          trail: [],
        });
      }

      fireworksRef.current.push({ particles, active: true });
    };

    // Launch fireworks periodically
    const launchInterval = setInterval(() => {
      const x = Math.random() * canvas.width * 0.6 + canvas.width * 0.2;
      const y = Math.random() * canvas.height * 0.4 + canvas.height * 0.1;
      createFirework(x, y);
    }, 1000);

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      fireworksRef.current = fireworksRef.current.filter(firework => {
        if (!firework.active) return false;

        let activeParticles = 0;

        firework.particles.forEach(particle => {
          if (particle.life <= 0) return;

          // Add current position to trail
          particle.trail.push({ x: particle.x, y: particle.y });
          if (particle.trail.length > 8) {
            particle.trail.shift();
          }

          // Update particle
          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.vy += 0.1; // Gravity
          particle.life--;

          const opacity = particle.life / particle.maxLife;
          
          // Draw trail
          particle.trail.forEach((pos, i) => {
            const trailOpacity = (i / particle.trail.length) * opacity * 0.5;
            const trailSize = particle.size * (i / particle.trail.length);
            
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, trailSize, 0, Math.PI * 2);
            ctx.fillStyle = hexToRgba(particle.color, trailOpacity);
            ctx.fill();
          });
          
          // Draw particle with glow
          ctx.shadowBlur = 15;
          ctx.shadowColor = particle.color;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(particle.color, opacity);
          ctx.fill();
          ctx.shadowBlur = 0;

          if (particle.life > 0) activeParticles++;
        });

        firework.active = activeParticles > 0;
        return firework.active;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      clearInterval(launchInterval);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
    </div>
  );
}
