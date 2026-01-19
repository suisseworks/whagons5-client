// @ts-ignore - canvas-confetti types may not be perfect
import confetti from 'canvas-confetti';

export type CelebrationType = 'confetti' | 'fireworks' | 'hearts' | 'balloons' | 'sparkles' | 'ribbons' | 'none';

const CELEBRATION_SETTING_KEY = 'wh-celebration-type';

/**
 * Get the current celebration type from localStorage
 */
export function getCelebrationType(): CelebrationType {
  if (typeof window === 'undefined') return 'confetti';
  try {
    const stored = localStorage.getItem(CELEBRATION_SETTING_KEY);
    console.log('[Celebration] Reading from localStorage:', stored, 'key:', CELEBRATION_SETTING_KEY);
    if (stored === 'confetti' || stored === 'fireworks' || stored === 'hearts' || stored === 'balloons' || stored === 'sparkles' || stored === 'ribbons' || stored === 'none') {
      return stored;
    }
  } catch (error) {
    console.warn('[Celebration] Error reading localStorage:', error);
  }
  return 'confetti'; // Default
}

/**
 * Set the celebration type in localStorage
 */
export function setCelebrationType(type: CelebrationType) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CELEBRATION_SETTING_KEY, type);
    console.log('[Celebration] Saved to localStorage:', type, 'key:', CELEBRATION_SETTING_KEY);
  } catch (error) {
    console.warn('[Celebration] Error saving to localStorage:', error);
  }
}

/**
 * Fireworks animation - explosive bursts that shoot up from bottom
 */
function celebrateWithFireworks() {
  if (typeof window === 'undefined') {
    console.warn('[Fireworks] Not in browser environment');
    return;
  }

  console.log('[Fireworks] Starting fireworks animation');

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  // Fire a single firework that shoots up then explodes
  function fireFirework(x: number, color: string[]) {
    // Rocket shooting up
    confetti({
      particleCount: 1,
      startVelocity: 0,
      ticks: 150,
      origin: { x, y: 0.9 },
      colors: color,
      shapes: ['circle'],
      scalar: 1.2,
      gravity: -0.5, // Negative gravity makes it shoot up
      zIndex: 9999,
    });

    // Explosion at the top (delayed)
    setTimeout(() => {
      // Main explosion burst
      confetti({
        particleCount: 120,
        angle: 90,
        spread: 360,
        origin: { x, y: randomInRange(0.2, 0.4) },
        colors: color,
        shapes: ['star', 'circle'],
        scalar: 1.5,
        gravity: 1.2,
        decay: 0.91,
        startVelocity: 35,
        ticks: 100,
        zIndex: 9999,
      });

      // Secondary smaller burst for extra sparkle
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 90,
          spread: 360,
          origin: { x, y: randomInRange(0.2, 0.4) },
          colors: ['#FFD700', '#FFF'],
          shapes: ['star'],
          scalar: 0.8,
          gravity: 1,
          decay: 0.92,
          startVelocity: 25,
          ticks: 80,
          zIndex: 9999,
        });
      }, 100);
    }, 400);
  }

  // Firework color palettes (each firework uses one palette)
  const colorPalettes = [
    ['#FF0000', '#FF4444', '#FF8888'], // Red
    ['#00FF00', '#44FF44', '#88FF88'], // Green
    ['#0000FF', '#4444FF', '#8888FF'], // Blue
    ['#FF00FF', '#FF44FF', '#FF88FF'], // Magenta
    ['#00FFFF', '#44FFFF', '#88FFFF'], // Cyan
    ['#FFFF00', '#FFFF44', '#FFFF88'], // Yellow
    ['#FF6600', '#FF9944', '#FFBB88'], // Orange
  ];

  // Fire initial sequence of 3 fireworks
  [0.2, 0.5, 0.8].forEach((x, index) => {
    setTimeout(() => {
      const colorPalette = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
      fireFirework(x, colorPalette);
    }, index * 600);
  });

  // Fire additional fireworks over 3 seconds
  const duration = 3000;
  const startTime = Date.now();
  const interval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    if (elapsed > duration) {
      clearInterval(interval);
      return;
    }

    // Random position for firework
    const x = randomInRange(0.15, 0.85);
    const colorPalette = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
    fireFirework(x, colorPalette);
  }, 800);
}

/**
 * Hearts animation - romantic celebration with hearts floating upward
 */
function celebrateWithHearts() {
  if (typeof window === 'undefined') {
    console.warn('[Hearts] Not in browser environment');
    return;
  }

  console.log('[Hearts] Starting hearts animation');
  
  try {
    const duration = 3500;
    const animationEnd = Date.now() + duration;

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    // Pink/red color palette for hearts
    const heartColors = ['#FF1744', '#F50057', '#FF4081', '#FF80AB', '#FFB6C1', '#FF69B4'];

    // Initial burst from bottom center - hearts rising up
    confetti({
      particleCount: 40,
      startVelocity: 15,
      spread: 80,
      origin: { x: 0.5, y: 1.0 },
      colors: heartColors,
      shapes: ['circle'], // Use circles since hearts might not render
      scalar: 2.5, // Larger particles
      gravity: -0.3, // Negative gravity makes them float up
      drift: 0,
      ticks: 300,
      zIndex: 9999,
    });

    // Continuous hearts floating from bottom
    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = Math.floor(15 * (timeLeft / duration));

      // Hearts rise from random positions at bottom
      confetti({
        particleCount,
        startVelocity: randomInRange(10, 20),
        spread: randomInRange(40, 60),
        origin: { x: randomInRange(0.2, 0.8), y: 1.0 }, // Start from bottom
        colors: heartColors,
        shapes: ['circle'],
        scalar: randomInRange(2, 3), // Varying sizes
        gravity: -0.25, // Float upward
        drift: randomInRange(-0.3, 0.3), // Gentle side-to-side movement
        ticks: 350,
        zIndex: 9999,
      });

      // Additional smaller hearts for depth
      confetti({
        particleCount: Math.floor(particleCount / 2),
        startVelocity: randomInRange(8, 15),
        spread: randomInRange(30, 50),
        origin: { x: randomInRange(0.3, 0.7), y: 1.0 },
        colors: ['#FF80AB', '#FFB6C1', '#FFC0CB'],
        shapes: ['circle'],
        scalar: 1.5,
        gravity: -0.2,
        drift: randomInRange(-0.2, 0.2),
        ticks: 400,
        zIndex: 9999,
      });
    }, 200);
  } catch (error) {
    console.error('Hearts animation failed:', error);
  }
}

/**
 * Balloons animation - balloons floating upward
 */
function celebrateWithBalloons() {
  if (typeof window === 'undefined') {
    console.warn('[Balloons] Not in browser environment');
    return;
  }

  console.log('[Balloons] Starting balloons animation');
  
  try {
    const duration = 4000;
    const animationEnd = Date.now() + duration;

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    // Balloon colors
    const balloonColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#FFA500', '#00FFFF'];

    // Launch balloons from bottom
    const launchBalloon = (x: number, color: string, delay: number) => {
      setTimeout(() => {
        // Balloon
        confetti({
          particleCount: 1,
          startVelocity: 8,
          spread: 0,
          origin: { x, y: 1.1 },
          colors: [color],
          shapes: ['circle'],
          scalar: 3,
          gravity: -0.15, // Float upward slowly
          drift: randomInRange(-0.1, 0.1),
          ticks: 500,
          zIndex: 9999,
        });

        // String
        confetti({
          particleCount: 1,
          startVelocity: 8,
          spread: 0,
          origin: { x, y: 1.1 },
          colors: ['#333333'],
          shapes: ['line'],
          scalar: 0.5,
          gravity: -0.15,
          drift: randomInRange(-0.1, 0.1),
          ticks: 500,
          zIndex: 9999,
        });
      }, delay);
    };

    // Launch initial balloons
    for (let i = 0; i < 8; i++) {
      const x = 0.2 + (i * 0.1);
      const color = balloonColors[i % balloonColors.length];
      launchBalloon(x, color, i * 300);
    }

    // Continue launching balloons
    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const x = randomInRange(0.15, 0.85);
      const color = balloonColors[Math.floor(Math.random() * balloonColors.length)];
      launchBalloon(x, color, 0);
    }, 600);
  } catch (error) {
    console.error('Balloons animation failed:', error);
  }
}

/**
 * Sparkles animation - shimmering particles that appear and fade
 */
function celebrateWithSparkles() {
  if (typeof window === 'undefined') {
    console.warn('[Sparkles] Not in browser environment');
    return;
  }

  console.log('[Sparkles] Starting sparkles animation');
  
  try {
    const duration = 3500;
    const animationEnd = Date.now() + duration;

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    // Sparkle colors - gold and silver
    const sparkleColors = ['#FFD700', '#FFF', '#FFED4E', '#C0C0C0', '#F4E869'];

    // Create sparkles that appear randomly on screen
    const createSparkle = () => {
      const x = randomInRange(0.1, 0.9);
      const y = randomInRange(0.1, 0.9);

      // Multiple small sparkles in a cluster
      confetti({
        particleCount: 3,
        startVelocity: 0,
        spread: 30,
        origin: { x, y },
        colors: sparkleColors,
        shapes: ['star'],
        scalar: randomInRange(1, 2),
        gravity: 0, // No gravity - just appear and fade
        drift: 0,
        ticks: 60,
        decay: 0.9,
        zIndex: 9999,
      });
    };

    // Initial burst
    for (let i = 0; i < 15; i++) {
      setTimeout(() => createSparkle(), i * 100);
    }

    // Continuous sparkles
    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      createSparkle();
    }, 150);
  } catch (error) {
    console.error('Sparkles animation failed:', error);
  }
}

/**
 * Ribbons animation - flowing streamers across the screen
 */
function celebrateWithRibbons() {
  if (typeof window === 'undefined') {
    console.warn('[Ribbons] Not in browser environment');
    return;
  }

  console.log('[Ribbons] Starting ribbons animation');
  
  try {
    const duration = 3000;
    const animationEnd = Date.now() + duration;

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    // Ribbon colors
    const ribbonColors = ['#FF1744', '#00E676', '#2979FF', '#FFD600', '#FF6D00', '#E040FB'];

    // Create flowing ribbons from top
    const createRibbon = (x: number, color: string) => {
      confetti({
        particleCount: 8,
        startVelocity: 25,
        spread: 15,
        angle: 90,
        origin: { x, y: 0 },
        colors: [color],
        shapes: ['square'],
        scalar: 2,
        gravity: 0.8,
        drift: randomInRange(-1, 1),
        ticks: 200,
        zIndex: 9999,
      });
    };

    // Launch ribbons from multiple positions
    [0.2, 0.4, 0.6, 0.8].forEach((x, index) => {
      setTimeout(() => {
        createRibbon(x, ribbonColors[index % ribbonColors.length]);
      }, index * 200);
    });

    // Continuous ribbons
    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const x = randomInRange(0.15, 0.85);
      const color = ribbonColors[Math.floor(Math.random() * ribbonColors.length)];
      createRibbon(x, color);
    }, 400);
  } catch (error) {
    console.error('Ribbons animation failed:', error);
  }
}

/**
 * Confetti animation - classic celebration
 */
function celebrateWithConfetti() {
  // Ensure we're in a browser environment
  if (typeof window === 'undefined') {
    console.warn('[Confetti] Not in browser environment');
    return;
  }

  console.log('[Confetti] Starting celebration animation');
  
  try {
    const duration = 3000; // 3 seconds
    const animationEnd = Date.now() + duration;
    
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 9999,
      colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'],
    };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    // Fire initial burst from center
    confetti({
      ...defaults,
      particleCount: 100,
      origin: { x: 0.5, y: 0.7 },
      angle: 60,
      spread: 55,
    });

    // Fire from both sides
    confetti({
      ...defaults,
      particleCount: 50,
      origin: { x: 0.2, y: 0.6 },
      angle: 60,
      spread: 55,
    });
    confetti({
      ...defaults,
      particleCount: 50,
      origin: { x: 0.8, y: 0.6 },
      angle: 120,
      spread: 55,
    });

    // Continuous bursts for duration
    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = Math.floor(50 * (timeLeft / duration));

      // Fire from both sides of the screen
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: 0.6 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: 0.6 }
      });
    }, 200);
  } catch (error) {
    console.error('Confetti animation failed:', error);
    // Fallback: try a simple confetti burst
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (fallbackError) {
      console.error('Confetti fallback also failed:', fallbackError);
    }
  }
}

/**
 * Triggers a celebration animation when a task is completed
 * Uses the celebration type from settings (confetti, fireworks, or none)
 * @param categoryEffect - Optional category-specific celebration effect. If not provided or empty, uses global default.
 */
export function celebrateTaskCompletion(categoryEffect?: string | null) {
  // Use category-specific effect if provided and not empty, otherwise use global default
  const celebrationType = (categoryEffect && categoryEffect !== '') ? categoryEffect : getCelebrationType();
  
  console.log('[Celebration] Category effect:', categoryEffect, 'Final type:', celebrationType);
  
  if (celebrationType === 'none') {
    console.log('[Celebration] Animation disabled');
    return; // No animation
  }

  if (celebrationType === 'fireworks') {
    console.log('[Celebration] Triggering fireworks');
    celebrateWithFireworks();
  } else if (celebrationType === 'hearts') {
    console.log('[Celebration] Triggering hearts');
    celebrateWithHearts();
  } else if (celebrationType === 'balloons') {
    console.log('[Celebration] Triggering balloons');
    celebrateWithBalloons();
  } else if (celebrationType === 'sparkles') {
    console.log('[Celebration] Triggering sparkles');
    celebrateWithSparkles();
  } else if (celebrationType === 'ribbons') {
    console.log('[Celebration] Triggering ribbons');
    celebrateWithRibbons();
  } else {
    console.log('[Celebration] Triggering confetti');
    celebrateWithConfetti();
  }
}

// Expose function globally for testing: window.testConfetti()
if (typeof window !== 'undefined') {
  (window as any).testConfetti = celebrateTaskCompletion;
  (window as any).testFireworks = celebrateWithFireworks;
  (window as any).testConfettiOnly = celebrateWithConfetti;
  (window as any).testHearts = celebrateWithHearts;
  (window as any).testBalloons = celebrateWithBalloons;
  (window as any).testSparkles = celebrateWithSparkles;
  (window as any).testRibbons = celebrateWithRibbons;
}
