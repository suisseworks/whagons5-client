import { useEffect, useRef } from "react";

interface MistEffectProps {
  /** Intensity of the mist effect (0-1). Defaults to 0.6 */
  intensity?: number;
  /** Height percentage from bottom where mist starts. Defaults to 0.3 (30% from bottom) */
  startHeight?: number;
}

/**
 * MistEffect - A subtle, flowing mist overlay for cloud/mountain images.
 * Creates an animated mist layer that flows horizontally across the lower portion of the image.
 */
export default function MistEffect({ intensity = 0.6, startHeight = 0.3 }: MistEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to container size
    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let time = 0;
    const mistLayers: Array<{ offset: number; speed: number; opacity: number; height: number }> = [
      { offset: 0, speed: 0.0003, opacity: intensity * 0.4, height: 0.4 }, // Bottom layer - slowest, most opaque
      { offset: Math.PI * 0.5, speed: 0.0005, opacity: intensity * 0.3, height: 0.3 }, // Middle layer
      { offset: Math.PI, speed: 0.0007, opacity: intensity * 0.2, height: 0.2 }, // Top layer - fastest, least opaque
    ];

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const startY = canvas.height * (1 - startHeight);
      const endY = canvas.height;

      mistLayers.forEach((layer) => {
        const layerStartY = startY + (canvas.height - startY) * (1 - layer.height);
        
        // Create gradient for smooth mist fade
        const gradient = ctx.createLinearGradient(0, layerStartY, 0, endY);
        gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
        gradient.addColorStop(0.3, `rgba(255, 255, 255, ${layer.opacity * 0.3})`);
        gradient.addColorStop(0.7, `rgba(240, 245, 255, ${layer.opacity * 0.6})`);
        gradient.addColorStop(1, `rgba(230, 240, 255, ${layer.opacity})`);

        ctx.fillStyle = gradient;

        // Create flowing mist pattern using sine waves
        ctx.beginPath();
        ctx.moveTo(0, layerStartY);
        
        const waveAmplitude = canvas.width * 0.05;
        const waveFrequency = 0.002;
        const points = 100;
        
        for (let i = 0; i <= points; i++) {
          const x = (canvas.width / points) * i;
          const wave = Math.sin((x * waveFrequency) + (time * layer.speed) + layer.offset) * waveAmplitude;
          const y = layerStartY + wave;
          ctx.lineTo(x, y);
        }
        
        // Complete the shape
        ctx.lineTo(canvas.width, endY);
        ctx.lineTo(0, endY);
        ctx.closePath();
        ctx.fill();

        // Add a second wave layer for more depth
        const gradient2 = ctx.createLinearGradient(0, layerStartY, 0, endY);
        gradient2.addColorStop(0, `rgba(255, 255, 255, 0)`);
        gradient2.addColorStop(0.5, `rgba(250, 250, 255, ${layer.opacity * 0.2})`);
        gradient2.addColorStop(1, `rgba(240, 245, 255, ${layer.opacity * 0.4})`);

        ctx.fillStyle = gradient2;
        ctx.beginPath();
        ctx.moveTo(0, layerStartY);
        
        for (let i = 0; i <= points; i++) {
          const x = (canvas.width / points) * i;
          const wave = Math.sin((x * waveFrequency * 1.5) + (time * layer.speed * 1.3) + layer.offset + Math.PI * 0.3) * waveAmplitude * 0.7;
          const y = layerStartY + wave + (endY - layerStartY) * 0.2;
          ctx.lineTo(x, y);
        }
        
        ctx.lineTo(canvas.width, endY);
        ctx.lineTo(0, endY);
        ctx.closePath();
        ctx.fill();
      });

      time += 16; // ~60fps
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [intensity, startHeight]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-[1]"
      style={{ mixBlendMode: 'soft-light', opacity: 0.5 }}
    />
  );
}
