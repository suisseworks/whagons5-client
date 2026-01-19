import { useEffect, useRef } from "react";

interface FishEffectProps {
  onClose?: () => void;
}

interface Fish {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  size: number;
  speed: number;
  angle: number;
  tailPhase: number;
  color: string;
  finPhase: number;
}

export default function FishEffect({ onClose }: FishEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fishRef = useRef<Fish[]>([]);
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

    // Fish colors (tropical and ocean fish)
    const fishColors = [
      '#FF6B35', // Orange (clownfish)
      '#4169E1', // Blue (tang)
      '#FFD700', // Gold
      '#00CED1', // Turquoise
      '#FF1493', // Pink
      '#32CD32', // Green
      '#FF4500', // Red-orange
    ];

    // Create fish
    const createFish = () => {
      const count = 12;
      fishRef.current = [];
      for (let i = 0; i < count; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        fishRef.current.push({
          x,
          y,
          targetX: x,
          targetY: y,
          size: Math.random() * 15 + 15,
          speed: Math.random() * 1.5 + 1,
          angle: Math.random() * Math.PI * 2,
          tailPhase: Math.random() * Math.PI * 2,
          finPhase: Math.random() * Math.PI * 2,
          color: fishColors[Math.floor(Math.random() * fishColors.length)],
        });
      }
    };
    createFish();

    // Draw a fish (HEAD at positive X, TAIL at negative X)
    const drawFish = (fish: Fish) => {
      ctx.save();
      ctx.translate(fish.x, fish.y);
      ctx.rotate(fish.angle);

      const size = fish.size;
      
      // Tail movement
      const tailWave = Math.sin(fish.tailPhase) * 0.3;

      // Body (oval)
      ctx.fillStyle = fish.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, size, size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Outline for body
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Tail (triangle with wave) - AT THE BACK (negative X)
      ctx.fillStyle = fish.color;
      ctx.beginPath();
      ctx.moveTo(-size, 0);
      ctx.lineTo(-size * 1.5, tailWave * size * 0.8 - size * 0.4);
      ctx.lineTo(-size * 1.5, tailWave * size * 0.8 + size * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Top fin (dorsal)
      const finWave = Math.sin(fish.finPhase) * 0.15;
      ctx.beginPath();
      ctx.moveTo(size * 0.2, -size * 0.5);
      ctx.lineTo(size * 0.1, -size * 0.9 + finWave * size);
      ctx.lineTo(-size * 0.2, -size * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Side fins (pectoral) - near the head
      for (let side = -1; side <= 1; side += 2) {
        if (side === 0) continue;
        ctx.beginPath();
        ctx.moveTo(size * 0.3, 0);
        ctx.lineTo(size * 0.5, side * (size * 0.5 + finWave * size * 0.3));
        ctx.lineTo(size * 0.1, side * size * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Eye - AT THE FRONT (positive X)
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(size * 0.6, -size * 0.15, size * 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Eye highlight
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(size * 0.58, -size * 0.17, size * 0.04, 0, Math.PI * 2);
      ctx.fill();

      // Mouth - at the front
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(size * 0.95, 0, size * 0.15, 0, Math.PI);
      ctx.stroke();

      // Scales pattern
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-size * 0.3 + i * size * 0.3, 0, size * 0.15, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    };

    // Animation loop
    const animate = () => {
      timeRef.current += 0.05;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw water effect background
      ctx.fillStyle = 'rgba(0, 100, 200, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Bubbles
      if (Math.random() > 0.95) {
        const bubbleX = Math.random() * canvas.width;
        const bubbleY = canvas.height;
        
        // Draw a few bubbles rising
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(
            bubbleX + (Math.random() - 0.5) * 50,
            bubbleY - i * 30,
            Math.random() * 3 + 2,
            0,
            Math.PI * 2
          );
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      fishRef.current.forEach((fish) => {
        // Update animations
        fish.tailPhase += 0.15;
        fish.finPhase += 0.1;

        // Check if we need a new target
        const dx = fish.targetX - fish.x;
        const dy = fish.targetY - fish.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 20) {
          // Reached target, pick new target
          fish.targetX = Math.random() * canvas.width;
          fish.targetY = Math.random() * canvas.height;
        } else {
          // Move towards target with swimming motion
          const moveX = (dx / distance) * fish.speed;
          const moveY = (dy / distance) * fish.speed;

          // Add swimming bobbing motion
          const bob = Math.sin(fish.tailPhase) * 0.5;
          const bobX = -moveY * bob * 0.2;
          const bobY = moveX * bob * 0.2;

          fish.x += moveX + bobX;
          fish.y += moveY + bobY;

          // Update angle to face direction
          fish.angle = Math.atan2(moveY, moveX);
        }

        // Keep fish on screen (with wrapping)
        if (fish.x < -50) fish.x = canvas.width + 50;
        if (fish.x > canvas.width + 50) fish.x = -50;
        if (fish.y < -50) fish.y = canvas.height + 50;
        if (fish.y > canvas.height + 50) fish.y = -50;

        drawFish(fish);
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
      {onClose && (
        <div className="fixed bottom-4 right-4 pointer-events-auto bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg transition-colors">
          <button
            onClick={onClose}
            className="text-center"
          >
            <div className="font-medium">Fish</div>
            <div className="text-xs opacity-75">(Ctrl+M)</div>
          </button>
        </div>
      )}
    </div>
  );
}
