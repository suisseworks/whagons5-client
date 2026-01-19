import { useEffect, useRef, useState } from "react";

interface LightningRainEffectProps {
  onClose?: () => void;
}

interface Raindrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
}

export default function LightningRainEffect({ onClose }: LightningRainEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raindropsRef = useRef<Raindrop[]>([]);
  const animationFrameRef = useRef<number>();
  const [flash, setFlash] = useState(false);
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
      const count = 250; // More rain for stormy effect
      raindropsRef.current = [];
      for (let i = 0; i < count; i++) {
        raindropsRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          length: Math.random() * 25 + 15, // Longer rain
          speed: Math.random() * 7 + 12, // Faster rain
          opacity: Math.random() * 0.4 + 0.3,
        });
      }
    };
    createRaindrops();

    // Draw lightning bolt
    const drawLightning = (startX: number, startY: number) => {
      // Lightning color adapts to theme
      const lightningColor = isDarkMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(100, 150, 255, 0.95)';
      ctx.strokeStyle = lightningColor;
      ctx.lineWidth = 4;
      ctx.shadowBlur = 20;
      ctx.shadowColor = isDarkMode ? 'white' : 'rgba(100, 150, 255, 0.8)';
      
      let x = startX;
      let y = startY;
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      
      while (y < canvas.height) {
        const segmentLength = Math.random() * 60 + 40;
        const angle = (Math.random() - 0.5) * 0.6;
        
        x += Math.sin(angle) * segmentLength;
        y += segmentLength;
        
        ctx.lineTo(x, y);
        
        // Add branches occasionally
        if (Math.random() > 0.65) {
          const branchX = x;
          const branchY = y;
          const branchAngle = (Math.random() - 0.5) * 1.8;
          const branchLength = Math.random() * 120 + 60;
          
          ctx.lineTo(
            branchX + Math.sin(branchAngle) * branchLength,
            branchY + branchLength * 0.5
          );
          ctx.moveTo(x, y);
        }
      }
      
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    // Animation loop for rain
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
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    // Lightning strikes at random intervals
    const createLightningStrike = () => {
      if (Math.random() > 0.4) { // 60% chance of lightning
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw 1-3 lightning bolts
        const bolts = Math.random() > 0.6 ? (Math.random() > 0.8 ? 3 : 2) : 1;
        for (let i = 0; i < bolts; i++) {
          const startX = Math.random() * canvas.width;
          drawLightning(startX, 0);
        }
        
        // Flash effect
        setFlash(true);
        setTimeout(() => {
          setFlash(false);
        }, 80);
      }
    };

    // Schedule random lightning strikes
    const scheduleLightning = () => {
      createLightningStrike();
      const nextStrike = 1500 + Math.random() * 3500; // Between 1.5-5 seconds
      setTimeout(scheduleLightning, nextStrike);
    };
    
    // Start lightning after a short delay
    setTimeout(scheduleLightning, 1000);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isDarkMode]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {/* Flash overlay */}
      <div 
        className={`absolute inset-0 transition-opacity duration-75 ${
          isDarkMode ? 'bg-white' : 'bg-blue-200'
        } ${
          flash ? (isDarkMode ? 'opacity-25' : 'opacity-15') : 'opacity-0'
        }`}
      />
      {/* Rain canvas */}
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
            <div className="font-medium">Storm</div>
            <div className="text-xs opacity-75">(Ctrl+M)</div>
          </button>
        </div>
      )}
    </div>
  );
}
