import { useEffect, useRef, useState } from "react";

interface RainEffectProps {
  onClose?: () => void;
}

interface Raindrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
}

export default function RainEffect({ onClose }: RainEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raindropsRef = useRef<Raindrop[]>([]);
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

    // Create raindrops
    const createRaindrops = () => {
      const count = 200;
      raindropsRef.current = [];
      for (let i = 0; i < count; i++) {
        raindropsRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          length: Math.random() * 20 + 10,
          speed: Math.random() * 5 + 10,
          opacity: Math.random() * 0.3 + 0.3,
        });
      }
    };
    createRaindrops();

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      raindropsRef.current.forEach((drop) => {
        // Update position
        drop.y += drop.speed;

        // Reset if raindrop goes off screen
        if (drop.y > canvas.height) {
          drop.y = -drop.length;
          drop.x = Math.random() * canvas.width;
        }

        // Draw raindrop as a line
        // Dark mode: light blue, Light mode: darker blue/gray
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x, drop.y + drop.length);
        ctx.strokeStyle = isDarkMode 
          ? `rgba(174, 194, 224, ${drop.opacity})`
          : `rgba(60, 90, 130, ${drop.opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
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
    </div>
  );
}
