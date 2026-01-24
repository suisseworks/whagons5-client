import { useEffect, useRef, useState } from "react";

interface SnowEffectProps {
  onClose?: () => void;
}

interface Snowflake {
  x: number;
  y: number;
  size: number;
  speed: number;
  drift: number;
  opacity: number;
}

export default function SnowEffect({ onClose }: SnowEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snowflakesRef = useRef<Snowflake[]>([]);
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

    // Create snowflakes
    const createSnowflakes = () => {
      const count = 150;
      snowflakesRef.current = [];
      for (let i = 0; i < count; i++) {
        snowflakesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 3 + 2,
          speed: Math.random() * 1 + 0.5,
          drift: Math.random() * 0.5 - 0.25,
          opacity: Math.random() * 0.5 + 0.3,
        });
      }
    };
    createSnowflakes();

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      snowflakesRef.current.forEach((flake) => {
        // Update position
        flake.y += flake.speed;
        flake.x += flake.drift;

        // Reset if snowflake goes off screen
        if (flake.y > canvas.height) {
          flake.y = -10;
          flake.x = Math.random() * canvas.width;
        }
        if (flake.x > canvas.width) {
          flake.x = 0;
        }
        if (flake.x < 0) {
          flake.x = canvas.width;
        }

        // Draw snowflake
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
        ctx.fillStyle = isDarkMode 
          ? `rgba(255, 255, 255, ${flake.opacity})`
          : `rgba(100, 120, 150, ${flake.opacity})`;
        ctx.fill();
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
