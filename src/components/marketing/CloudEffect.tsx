import { useEffect, useRef, useState } from "react";

interface CloudEffectProps {
  onClose?: () => void;
}

interface Cloud {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  baseY: number;
}

export default function CloudEffect({ onClose }: CloudEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cloudsRef = useRef<Cloud[]>([]);
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

    // Create clouds
    const createClouds = () => {
      const count = 15;
      cloudsRef.current = [];
      for (let i = 0; i < count; i++) {
        cloudsRef.current.push({
          x: Math.random() * (canvas.width + 400) - 200,
          y: Math.random() * (canvas.height * 0.6) + canvas.height * 0.1, // Keep clouds in upper portion
          size: Math.random() * 120 + 80,
          speed: Math.random() * 0.3 + 0.1,
          opacity: Math.random() * 0.3 + 0.2,
          baseY: Math.random() * (canvas.height * 0.6) + canvas.height * 0.1,
        });
      }
    };
    createClouds();

    // Draw a single cloud using multiple circles
    const drawCloud = (x: number, y: number, size: number, opacity: number) => {
      ctx.save();
      ctx.globalAlpha = opacity;
      
      // Create cloud shape using multiple overlapping circles
      const circles = [
        { x: x - size * 0.3, y: y, r: size * 0.4 },
        { x: x, y: y, r: size * 0.5 },
        { x: x + size * 0.3, y: y, r: size * 0.4 },
        { x: x - size * 0.15, y: y - size * 0.2, r: size * 0.35 },
        { x: x + size * 0.15, y: y - size * 0.2, r: size * 0.35 },
      ];

      // Draw cloud with appropriate color for theme
      // Use softer, more transparent colors that work well on transparent background
      const cloudColor = isDarkMode 
        ? 'rgba(180, 190, 210, 0.6)'
        : 'rgba(200, 210, 230, 0.5)';

      ctx.fillStyle = cloudColor;
      circles.forEach(circle => {
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circle.r, 0, Math.PI * 2);
        ctx.fill();
      });
      
      ctx.restore();
    };

    // Animation loop
    const animate = () => {
      // Clear canvas (transparent background, like fog effect)
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw and update clouds
      cloudsRef.current.forEach((cloud) => {
        // Update position
        cloud.x += cloud.speed;
        
        // Add subtle vertical drift
        cloud.y = cloud.baseY + Math.sin(cloud.x * 0.001) * 10;

        // Reset if cloud goes off screen
        if (cloud.x > canvas.width + cloud.size * 2) {
          cloud.x = -cloud.size * 2;
          cloud.baseY = Math.random() * (canvas.height * 0.6) + canvas.height * 0.1;
          cloud.y = cloud.baseY;
        }

        // Draw cloud
        drawCloud(cloud.x, cloud.y, cloud.size, cloud.opacity);
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
            <div className="font-medium">Clouds</div>
            <div className="text-xs opacity-75">(Ctrl+M)</div>
          </button>
        </div>
      )}
    </div>
  );
}
