import { useEffect, useRef, useState } from "react";

interface MeteorEffectProps {
  onClose?: () => void;
}

interface Meteor {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  opacity: number;
  active: boolean;
}

export default function MeteorEffect({ onClose }: MeteorEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const meteorsRef = useRef<Meteor[]>([]);
  const animationFrameRef = useRef<number>();
  const [isDarkMode, setIsDarkMode] = useState(() => 
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    // Detect theme changes
    const updateThemeState = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };

    const observer = new MutationObserver(updateThemeState);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    mql.addEventListener('change', updateThemeState);

    return () => {
      observer.disconnect();
      mql.removeEventListener('change', updateThemeState);
    };
  }, []);

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

    // Initialize meteors
    const initMeteors = () => {
      const count = 15;
      meteorsRef.current = [];
      for (let i = 0; i < count; i++) {
        meteorsRef.current.push({
          x: Math.random() * canvas.width,
          y: -100,
          length: Math.random() * 80 + 40,
          speed: Math.random() * 8 + 12,
          angle: Math.PI / 4 + (Math.random() - 0.5) * 0.5,
          opacity: Math.random() * 0.5 + 0.5,
          active: false,
        });
      }
    };
    initMeteors();

    // Spawn meteors randomly
    const spawnInterval = setInterval(() => {
      const inactiveMeteor = meteorsRef.current.find(m => !m.active);
      if (inactiveMeteor && Math.random() > 0.5) {
        inactiveMeteor.x = Math.random() * canvas.width;
        inactiveMeteor.y = -100;
        inactiveMeteor.active = true;
      }
    }, 500);

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      meteorsRef.current.forEach((meteor) => {
        if (!meteor.active) return;

        // Update position
        meteor.x += Math.cos(meteor.angle) * meteor.speed;
        meteor.y += Math.sin(meteor.angle) * meteor.speed;

        // Deactivate if off screen
        if (meteor.y > canvas.height + 100 || meteor.x > canvas.width + 100) {
          meteor.active = false;
          return;
        }

        // Draw meteor trail with theme-aware colors
        const gradient = ctx.createLinearGradient(
          meteor.x,
          meteor.y,
          meteor.x - Math.cos(meteor.angle) * meteor.length,
          meteor.y - Math.sin(meteor.angle) * meteor.length
        );
        
        if (isDarkMode) {
          // Light colors for dark mode
          gradient.addColorStop(0, `rgba(255, 255, 255, ${meteor.opacity})`);
          gradient.addColorStop(0.5, `rgba(200, 200, 255, ${meteor.opacity * 0.5})`);
          gradient.addColorStop(1, 'rgba(200, 200, 255, 0)');
        } else {
          // Dark colors for light mode
          gradient.addColorStop(0, `rgba(60, 80, 120, ${meteor.opacity})`);
          gradient.addColorStop(0.5, `rgba(80, 100, 150, ${meteor.opacity * 0.6})`);
          gradient.addColorStop(1, 'rgba(100, 120, 180, 0)');
        }

        ctx.strokeStyle = gradient;
        ctx.lineWidth = isDarkMode ? 3 : 2.5;
        ctx.shadowBlur = isDarkMode ? 10 : 8;
        ctx.shadowColor = isDarkMode 
          ? 'rgba(255, 255, 255, 0.5)' 
          : 'rgba(60, 80, 120, 0.4)';

        ctx.beginPath();
        ctx.moveTo(meteor.x, meteor.y);
        ctx.lineTo(
          meteor.x - Math.cos(meteor.angle) * meteor.length,
          meteor.y - Math.sin(meteor.angle) * meteor.length
        );
        ctx.stroke();

        ctx.shadowBlur = 0;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      clearInterval(spawnInterval);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isDarkMode]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
      {onClose && (
        <div className={`fixed bottom-4 right-4 pointer-events-auto backdrop-blur-sm px-4 py-2 rounded-lg transition-colors ${
          isDarkMode 
            ? 'bg-white/10 hover:bg-white/20 text-white' 
            : 'bg-black/10 hover:bg-black/20 text-black'
        }`}>
          <button
            onClick={onClose}
            className="text-center"
          >
            <div className="font-medium">Meteors</div>
            <div className="text-xs opacity-75">(Ctrl+M)</div>
          </button>
        </div>
      )}
    </div>
  );
}
