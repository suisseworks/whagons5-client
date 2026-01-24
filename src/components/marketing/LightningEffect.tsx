import { useEffect, useRef, useState } from "react";

interface LightningEffectProps {
  onClose?: () => void;
}

export default function LightningEffect({ onClose }: LightningEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const [flash, setFlash] = useState(false);

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

    // Draw lightning bolt
    const drawLightning = (startX: number, startY: number) => {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'white';
      
      let x = startX;
      let y = startY;
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      
      while (y < canvas.height) {
        const segmentLength = Math.random() * 50 + 30;
        const angle = (Math.random() - 0.5) * 0.5;
        
        x += Math.sin(angle) * segmentLength;
        y += segmentLength;
        
        ctx.lineTo(x, y);
        
        // Add branches occasionally
        if (Math.random() > 0.7) {
          const branchX = x;
          const branchY = y;
          const branchAngle = (Math.random() - 0.5) * 1.5;
          const branchLength = Math.random() * 100 + 50;
          
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

    // Create lightning strikes periodically
    const lightningInterval = setInterval(() => {
      if (Math.random() > 0.3) { // 70% chance of lightning
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw 1-2 lightning bolts
        const bolts = Math.random() > 0.7 ? 2 : 1;
        for (let i = 0; i < bolts; i++) {
          const startX = Math.random() * canvas.width;
          drawLightning(startX, 0);
        }
        
        // Flash effect
        setFlash(true);
        setTimeout(() => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          setFlash(false);
        }, 100);
      }
    }, 2000 + Math.random() * 3000); // Random interval between 2-5 seconds

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      clearInterval(lightningInterval);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      <div 
        className={`absolute inset-0 bg-white transition-opacity duration-100 ${
          flash ? 'opacity-20' : 'opacity-0'
        }`}
      />
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
    </div>
  );
}
