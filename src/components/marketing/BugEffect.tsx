import { useEffect, useRef } from "react";

interface BugEffectProps {
  onClose?: () => void;
}

interface Bug {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  size: number;
  speed: number;
  angle: number;
  legPhase: number;
  pauseTime: number;
  color: string;
}

export default function BugEffect({ onClose }: BugEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bugsRef = useRef<Bug[]>([]);
  const animationFrameRef = useRef<number>();
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Update time for animations
    const updateTime = () => {
      timeRef.current += 0.05;
    };

    // Set canvas size to window size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Bug types with different colors
    const bugColors = [
      '#000000', // Black beetle
      '#8B4513', // Brown beetle
      '#2F4F2F', // Dark green beetle
      '#1a1a1a', // Dark gray ant
      '#654321', // Brown ant
    ];

    // Create bugs
    const createBugs = () => {
      const count = 8;
      bugsRef.current = [];
      for (let i = 0; i < count; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        bugsRef.current.push({
          x,
          y,
          targetX: x,
          targetY: y,
          size: Math.random() * 10 + 8, // Increased from 6+4 to 10+8
          speed: Math.random() * 1.5 + 0.5,
          angle: Math.random() * Math.PI * 2,
          legPhase: Math.random() * Math.PI * 2,
          pauseTime: 0,
          color: bugColors[Math.floor(Math.random() * bugColors.length)],
        });
      }
    };
    createBugs();

    // Draw a realistic bug
    const drawBug = (bug: Bug) => {
      ctx.save();
      ctx.translate(bug.x, bug.y);
      ctx.rotate(bug.angle);

      const size = bug.size;

      // Body (oval)
      ctx.fillStyle = bug.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, size, size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head (smaller circle)
      ctx.beginPath();
      ctx.arc(-size * 0.7, 0, size * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Legs (6 legs, 3 on each side)
      ctx.strokeStyle = bug.color;
      ctx.lineWidth = 1;

      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 3; i++) {
          const legX = -size * 0.3 + i * size * 0.4;
          const legY = side * size * 0.5;
          
          // Animate legs
          const legOffset = Math.sin(bug.legPhase + i * Math.PI / 3) * size * 0.3;
          
          ctx.beginPath();
          ctx.moveTo(legX, 0);
          ctx.lineTo(legX + legOffset * 0.3, legY);
          ctx.lineTo(legX + legOffset, legY + size * 0.4);
          ctx.stroke();
        }
      }

      // Antennae (2 antennae) - longer and more visible
      ctx.strokeStyle = bug.color;
      ctx.lineWidth = 1.5; // Thicker antennae
      
      for (let side = -1; side <= 1; side += 2) {
        if (side === 0) continue;
        
        // Animated antennae that wave slightly
        const antennaeWave = Math.sin(timeRef.current * 3 + side) * 0.2;
        
        ctx.beginPath();
        ctx.moveTo(-size * 0.7, 0);
        // Make antennae much longer
        ctx.lineTo(-size * 1.5 + antennaeWave * size, side * size * 0.6);
        ctx.stroke();
        
        // Add antenna tip (small circle)
        ctx.beginPath();
        ctx.arc(-size * 1.5 + antennaeWave * size, side * size * 0.6, size * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = bug.color;
        ctx.fill();
      }

      ctx.restore();
    };

    // Animation loop
    const animate = () => {
      updateTime();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      bugsRef.current.forEach((bug) => {
        // Update leg animation
        bug.legPhase += 0.2;

        // Check if we need a new target
        const dx = bug.targetX - bug.x;
        const dy = bug.targetY - bug.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (bug.pauseTime > 0) {
          // Bug is paused (resting)
          bug.pauseTime--;
        } else if (distance < 5) {
          // Reached target, pick new target
          bug.targetX = Math.random() * canvas.width;
          bug.targetY = Math.random() * canvas.height;
          
          // Sometimes pause for a moment
          if (Math.random() > 0.7) {
            bug.pauseTime = Math.random() * 60 + 30; // Pause for 30-90 frames
          }
        } else {
          // Move towards target
          const moveX = (dx / distance) * bug.speed;
          const moveY = (dy / distance) * bug.speed;

          bug.x += moveX;
          bug.y += moveY;

          // Update angle to face direction of movement
          bug.angle = Math.atan2(moveY, moveX);
        }

        // Keep bugs on screen
        if (bug.x < 0) bug.x = canvas.width;
        if (bug.x > canvas.width) bug.x = 0;
        if (bug.y < 0) bug.y = canvas.height;
        if (bug.y > canvas.height) bug.y = 0;

        // Draw bug
        drawBug(bug);
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
            <div className="font-medium">Bugs</div>
            <div className="text-xs opacity-75">(Ctrl+M)</div>
          </button>
        </div>
      )}
    </div>
  );
}
