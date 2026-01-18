import { useEffect, useRef, useState } from "react";

interface FogEffectProps {
  onClose?: () => void;
}

interface FogLayer {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  drift: number;
  verticalSpeed: number;
  baseY: number;
  waveOffset: number;
}

export default function FogEffect({ onClose }: FogEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fogLayersRef = useRef<FogLayer[]>([]);
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

    // Create fog layers
    const createFogLayers = () => {
      const count = 40; // Moderate number of fog layers
      fogLayersRef.current = [];
      for (let i = 0; i < count; i++) {
        fogLayersRef.current.push({
          x: Math.random() * (canvas.width + 200) - 100,
          y: Math.random() * canvas.height,
          size: Math.random() * 250 + 100, // Moderate fog patch sizes
          speed: Math.random() * 0.3 + 0.15, // Moderate movement speed
          opacity: Math.random() * 0.18 + 0.08, // Less opaque
          drift: (Math.random() - 0.5) * 0.2, // Less horizontal drift
          verticalSpeed: Math.random() * 0.1 - 0.05, // Slower vertical movement
          baseY: Math.random() * canvas.height,
          waveOffset: Math.random() * Math.PI * 2, // Wave phase offset
        });
      }
    };
    createFogLayers();

    // Animation loop
    let time = 0;
    const animate = () => {
      time += 0.005; // Slower time progression
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      fogLayersRef.current.forEach((fog) => {
        // Update position with multiple movement patterns
        fog.x += fog.speed + fog.drift;
        
        // Add subtle vertical movement with wave effect
        const waveY = Math.sin(time * 0.3 + fog.waveOffset) * 15;
        fog.y = fog.baseY + waveY + (fog.verticalSpeed * time * 5);

        // Reset if fog goes off screen horizontally
        if (fog.x > canvas.width + fog.size) {
          fog.x = -fog.size;
          fog.baseY = Math.random() * canvas.height;
          fog.waveOffset = Math.random() * Math.PI * 2;
        }
        if (fog.x < -fog.size) {
          fog.x = canvas.width + fog.size;
          fog.baseY = Math.random() * canvas.height;
          fog.waveOffset = Math.random() * Math.PI * 2;
        }

        // Reset if fog goes off screen vertically
        if (fog.y > canvas.height + fog.size) {
          fog.baseY = -fog.size;
          fog.y = fog.baseY;
        }
        if (fog.y < -fog.size) {
          fog.baseY = canvas.height + fog.size;
          fog.y = fog.baseY;
        }

        // Draw fog as gradient circle with multiple layers for depth
        // Dark mode: light grayish fog, Light mode: darker gray fog
        const fogColor = isDarkMode 
          ? `rgba(200, 200, 220, ${fog.opacity})`
          : `rgba(120, 130, 150, ${fog.opacity})`;
        const fogColorTransparent = isDarkMode 
          ? 'rgba(200, 200, 220, 0)'
          : 'rgba(120, 130, 150, 0)';
        
        // Create radial gradient for fog
        const gradient = ctx.createRadialGradient(
          fog.x, fog.y, fog.size * 0.3,
          fog.x, fog.y, fog.size
        );
        gradient.addColorStop(0, fogColor);
        gradient.addColorStop(0.6, isDarkMode 
          ? `rgba(200, 200, 220, ${fog.opacity * 0.6})`
          : `rgba(120, 130, 150, ${fog.opacity * 0.6})`);
        gradient.addColorStop(1, fogColorTransparent);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(fog.x - fog.size, fog.y - fog.size, fog.size * 2, fog.size * 2);
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
            <div className="font-medium">Fog</div>
            <div className="text-xs opacity-75">(Ctrl+M)</div>
          </button>
        </div>
      )}
    </div>
  );
}
