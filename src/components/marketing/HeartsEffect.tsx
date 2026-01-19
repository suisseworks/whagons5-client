import { useEffect, useRef } from "react";

interface HeartsEffectProps {
  onClose?: () => void;
}

interface Heart {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  drift: number;
}

export default function HeartsEffect({ onClose }: HeartsEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heartsRef = useRef<Heart[]>([]);
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

    // Create hearts
    const createHearts = () => {
      const count = 50;
      heartsRef.current = [];
      for (let i = 0; i < count; i++) {
        heartsRef.current.push({
          x: Math.random() * canvas.width,
          y: canvas.height + Math.random() * 100,
          size: Math.random() * 20 + 15,
          speed: Math.random() * 1 + 0.5,
          opacity: Math.random() * 0.5 + 0.3,
          drift: (Math.random() - 0.5) * 0.5,
        });
      }
    };
    createHearts();

    // Draw heart shape
    const drawHeart = (x: number, y: number, size: number, opacity: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      
      const topCurveHeight = size * 0.3;
      ctx.moveTo(0, topCurveHeight);
      
      // Left side
      ctx.bezierCurveTo(
        0, 0,
        -size / 2, 0,
        -size / 2, topCurveHeight
      );
      ctx.bezierCurveTo(
        -size / 2, (topCurveHeight + size) / 2,
        0, (topCurveHeight + size) / 2,
        0, size
      );
      
      // Right side
      ctx.bezierCurveTo(
        0, (topCurveHeight + size) / 2,
        size / 2, (topCurveHeight + size) / 2,
        size / 2, topCurveHeight
      );
      ctx.bezierCurveTo(
        size / 2, 0,
        0, 0,
        0, topCurveHeight
      );
      
      ctx.fillStyle = `rgba(255, 105, 180, ${opacity})`;
      ctx.fill();
      ctx.restore();
    };

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      heartsRef.current.forEach((heart) => {
        // Update position - hearts float up
        heart.y -= heart.speed;
        heart.x += heart.drift;

        // Reset if heart goes off screen
        if (heart.y < -50) {
          heart.y = canvas.height + 20;
          heart.x = Math.random() * canvas.width;
        }

        // Draw heart
        drawHeart(heart.x, heart.y, heart.size, heart.opacity);
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
