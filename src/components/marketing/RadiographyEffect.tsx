import { useEffect, useRef, useState } from "react";

interface RadiographyEffectProps {
  onClose?: () => void;
}

export default function RadiographyEffect({ onClose }: RadiographyEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    
    // Ensure canvas is transparent
    ctx.globalCompositeOperation = 'source-over';

    // Professional geometric depth effect
    interface GeometricShape {
      x: number;
      y: number;
      size: number;
      depth: number; // 0-1, where 0 is closest
      rotation: number;
      rotationSpeed: number;
      type: 'hexagon' | 'circle';
      opacity: number;
    }

    const shapes: GeometricShape[] = [];
    const gridLines: Array<{ x1: number; y1: number; x2: number; y2: number; depth: number }> = [];

    // Initialize shapes and grid
    const initializeShapes = () => {
      if (canvas.width === 0 || canvas.height === 0) return;
      
      shapes.length = 0;
      gridLines.length = 0;

      // Create floating geometric shapes at different depths
      const baseShapeOpacity = isDarkMode ? 0.06 : 0.1; // Higher opacity in light mode
      for (let i = 0; i < 12; i++) {
        shapes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: 40 + Math.random() * 80,
          depth: Math.random(),
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.02,
          type: Math.random() > 0.5 ? 'hexagon' : 'circle',
          opacity: baseShapeOpacity + Math.random() * 0.2,
        });
      }

      // Create perspective grid lines
      const vanishingPointX = canvas.width / 2;
      const vanishingPointY = canvas.height * 0.4;
      const gridSpacing = 80;

      // Horizontal lines (converging to vanishing point)
      for (let i = 0; i < 15; i++) {
        const y = canvas.height * 0.2 + i * gridSpacing;
        const depth = i / 15;
        const width = canvas.width * (1 - depth * 0.6);
        const x1 = vanishingPointX - width / 2;
        const x2 = vanishingPointX + width / 2;
        gridLines.push({ x1, y1: y, x2, y2: y, depth });
      }

      // Vertical lines (radiating from vanishing point)
      for (let i = -8; i <= 8; i++) {
        const angle = (i / 8) * Math.PI * 0.3;
        const length = canvas.height * 0.8;
        const x1 = vanishingPointX;
        const y1 = vanishingPointY;
        const x2 = vanishingPointX + Math.sin(angle) * length;
        const y2 = vanishingPointY + Math.cos(angle) * length;
        const depth = 0.3;
        gridLines.push({ x1, y1, x2, y2, depth });
      }
    };

    // Set canvas size to window size
    const resizeCanvas = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (width > 0 && height > 0) {
        canvas.width = width;
        canvas.height = height;
        initializeShapes(); // Reinitialize shapes on resize
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Professional color scheme
    const getColor = (depth: number, baseOpacity: number) => {
      const opacity = baseOpacity * (0.3 + depth * 0.7); // Fade with depth
      if (isDarkMode) {
        return `rgba(200, 210, 230, ${opacity})`;
      } else {
        // Use darker colors with higher opacity for better visibility in light mode
        return `rgba(60, 70, 90, ${Math.max(opacity, 0.08)})`;
      }
    };

    // Draw hexagon
    const drawHexagon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, color: string) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.strokeStyle = color;
      ctx.lineWidth = isDarkMode ? 1.5 : 2; // Thicker in light mode
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const px = Math.cos(angle) * size;
        const py = Math.sin(angle) * size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    };

    // Draw circle
    const drawCircle = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = isDarkMode ? 1.5 : 2; // Thicker in light mode
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.stroke();
    };

    // Animation loop
    let time = 0;
    const animate = () => {
      try {
        if (canvas.width === 0 || canvas.height === 0) {
          animationFrameRef.current = requestAnimationFrame(animate);
          return;
        }
        
        time += 0.01;
        
        // Clear canvas - ensure it's transparent
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Only draw if we have shapes and grid lines initialized
        if (shapes.length === 0 && gridLines.length === 0) {
          animationFrameRef.current = requestAnimationFrame(animate);
          return;
        }

        // Update shapes
        shapes.forEach(shape => {
          shape.rotation += shape.rotationSpeed;
          // Subtle floating motion
          shape.y += Math.sin(time * 0.3 + shape.x * 0.01) * 0.2;
          shape.x += Math.cos(time * 0.2 + shape.y * 0.01) * 0.15;
          
          // Wrap around edges
          if (shape.x < -shape.size) shape.x = canvas.width + shape.size;
          if (shape.x > canvas.width + shape.size) shape.x = -shape.size;
          if (shape.y < -shape.size) shape.y = canvas.height + shape.size;
          if (shape.y > canvas.height + shape.size) shape.y = -shape.size;
        });

        // Draw grid lines (back to front for proper depth)
        if (gridLines.length > 0) {
          const sortedGridLines = [...gridLines].sort((a, b) => b.depth - a.depth);
          sortedGridLines.forEach(line => {
            const baseOpacity = isDarkMode ? 0.05 : 0.09; // Higher opacity in light mode
            const color = getColor(line.depth, baseOpacity);
            ctx.strokeStyle = color;
            ctx.lineWidth = isDarkMode ? 0.8 : 1.2; // Slightly thicker in light mode
            ctx.beginPath();
            ctx.moveTo(line.x1, line.y1);
            ctx.lineTo(line.x2, line.y2);
            ctx.stroke();
          });
        }

        // Draw shapes (back to front)
        if (shapes.length > 0) {
          const sortedShapes = [...shapes].sort((a, b) => b.depth - a.depth);
          sortedShapes.forEach(shape => {
            const color = getColor(shape.depth, shape.opacity);
            if (shape.type === 'hexagon') {
              drawHexagon(ctx, shape.x, shape.y, shape.size, shape.rotation, color);
            } else {
              drawCircle(ctx, shape.x, shape.y, shape.size, color);
            }
          });
        }

        animationFrameRef.current = requestAnimationFrame(animate);
      } catch (error) {
        console.error('Error in depth perspective animation:', error);
        // Continue animation even if there's an error
        animationFrameRef.current = requestAnimationFrame(animate);
      }
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
    <div className="fixed inset-0 pointer-events-none z-[1]" style={{ pointerEvents: 'none' }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full pointer-events-none"
        style={{ pointerEvents: 'none', backgroundColor: 'transparent' }}
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
            <div className="font-medium">Depth Perspective</div>
            <div className="text-xs opacity-75">(Ctrl+M)</div>
          </button>
        </div>
      )}
    </div>
  );
}
