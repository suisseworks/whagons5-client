import { useEffect, useRef } from "react";

interface AuroraEffectProps {
  onClose?: () => void;
}

export default function AuroraEffect({ onClose }: AuroraEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const timeRef = useRef(0);

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

    // Aurora color layers - realistic northern lights colors
    const auroraLayers = [
      { hue: 140, saturation: 80, lightness: 65, name: 'green' },    // Primary green
      { hue: 280, saturation: 70, lightness: 60, name: 'purple' },   // Purple
      { hue: 200, saturation: 75, lightness: 55, name: 'blue' },     // Blue-green
      { hue: 330, saturation: 65, lightness: 70, name: 'pink' },     // Pink/magenta
    ];

    // Draw vertical curtain/ray effect
    const drawVerticalRay = (x: number, baseY: number, height: number, color: { hue: number; saturation: number; lightness: number }, intensity: number) => {
      const gradient = ctx.createLinearGradient(x, baseY, x, baseY + height);
      gradient.addColorStop(0, `hsla(${color.hue}, ${color.saturation}%, ${color.lightness}%, ${intensity * 0.6})`);
      gradient.addColorStop(0.3, `hsla(${color.hue}, ${color.saturation}%, ${color.lightness}%, ${intensity * 0.4})`);
      gradient.addColorStop(0.7, `hsla(${color.hue}, ${color.saturation}%, ${color.lightness}%, ${intensity * 0.2})`);
      gradient.addColorStop(1, `hsla(${color.hue}, ${color.saturation}%, ${color.lightness}%, 0)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(x - 3, baseY, 6, height);
    };

    // Animation loop
    const animate = () => {
      timeRef.current += 0.008;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Dark atmospheric background
      ctx.fillStyle = 'rgba(5, 10, 20, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw each aurora layer
      auroraLayers.forEach((layer, layerIndex) => {
        const offset = layerIndex * Math.PI / 2;
        
        // Draw horizontal flowing waves
        ctx.beginPath();
        for (let x = 0; x < canvas.width; x += 3) {
          const y = canvas.height * 0.25 + 
                   Math.sin(x * 0.008 + timeRef.current * 1.5 + offset) * 40 +
                   Math.sin(x * 0.003 + timeRef.current * 0.8 + offset) * 25 +
                   Math.sin(x * 0.015 + timeRef.current * 2 + offset) * 15;
          
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        // Gradient for horizontal waves
        const waveGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        const pulsate = Math.sin(timeRef.current * 3 + offset) * 0.1 + 0.2;
        waveGradient.addColorStop(0, `hsla(${layer.hue}, ${layer.saturation}%, ${layer.lightness}%, ${pulsate})`);
        waveGradient.addColorStop(0.4, `hsla(${layer.hue}, ${layer.saturation}%, ${layer.lightness}%, ${pulsate * 0.6})`);
        waveGradient.addColorStop(1, `hsla(${layer.hue}, ${layer.saturation}%, ${layer.lightness}%, 0)`);
        
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        ctx.fillStyle = waveGradient;
        ctx.fill();

        // Draw vertical curtains/rays
        const rayCount = 15 + layerIndex * 5;
        for (let i = 0; i < rayCount; i++) {
          const xPos = (i / rayCount) * canvas.width + Math.sin(timeRef.current + i) * 20;
          const baseY = canvas.height * 0.15 + Math.sin(timeRef.current * 2 + i * 0.5 + offset) * 30;
          const height = canvas.height * 0.4 + Math.sin(timeRef.current * 1.5 + i * 0.3) * 100;
          const intensity = Math.sin(timeRef.current * 4 + i * 0.8 + offset) * 0.15 + 0.25;

          drawVerticalRay(xPos, baseY, height, layer, intensity);
        }
      });

      // Add shimmer particles
      const particleCount = 30;
      for (let i = 0; i < particleCount; i++) {
        const x = (i / particleCount) * canvas.width + Math.sin(timeRef.current * 3 + i) * 50;
        const y = canvas.height * 0.2 + Math.sin(timeRef.current * 2 + i * 0.5) * 80;
        const size = Math.sin(timeRef.current * 5 + i) * 2 + 2;
        const opacity = Math.sin(timeRef.current * 4 + i * 0.3) * 0.4 + 0.3;

        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 255, 220, ${opacity})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(200, 255, 220, 0.8)';
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      <canvas
        ref={canvasRef}
        className="w-full h-full bg-black/30"
      />
      {onClose && (
        <div className="fixed bottom-4 right-4 pointer-events-auto bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg transition-colors">
          <button
            onClick={onClose}
            className="text-center"
          >
            <div className="font-medium">Aurora</div>
            <div className="text-xs opacity-75">(Ctrl+M)</div>
          </button>
        </div>
      )}
    </div>
  );
}
