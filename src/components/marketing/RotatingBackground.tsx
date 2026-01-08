import { ReactNode, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type RotatingBackgroundProps = {
  images: string[];
  /** Defaults to 10s */
  intervalMs?: number;
  /** Start on a random image instead of index 0 */
  randomStart?: boolean;
  className?: string;
  children?: ReactNode;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

export default function RotatingBackground({
  images,
  intervalMs = 10_000,
  randomStart = true,
  className,
  children,
}: RotatingBackgroundProps) {
  const canAnimate = useMemo(() => !prefersReducedMotion(), []);

  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    if (!images?.length) return 0;
    return randomStart ? Math.floor(Math.random() * images.length) : 0;
  });
  const [nextIndex, setNextIndex] = useState<number>(currentIndex);
  const [showNext, setShowNext] = useState(false);

  useEffect(() => {
    if (!images?.length) return;
    // If images array changes, ensure indices stay valid.
    setCurrentIndex((i) => Math.min(i, images.length - 1));
  }, [images]);

  useEffect(() => {
    if (!images?.length) return;
    if (!canAnimate) return;
    if (images.length < 2) return;

    let timeoutId: number | null = null;
    const id = window.setInterval(() => {
      const next = (currentIndex + 1) % images.length;
      setNextIndex(next);
      setShowNext(true);

      // After fade completes, commit next as current.
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setCurrentIndex(next);
        setShowNext(false);
      }, 1000);
    }, intervalMs);

    return () => {
      window.clearInterval(id);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAnimate, images.length, intervalMs, currentIndex]);

  const current = images?.[currentIndex];
  const next = images?.[nextIndex];

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Background layers */}
      <div
        className={cn(
          "absolute inset-0 bg-cover bg-center bg-no-repeat",
          canAnimate && "transition-opacity duration-1000 ease-in-out"
        )}
        style={{ backgroundImage: current ? `url(${current})` : undefined, opacity: showNext ? 0 : 1 }}
      />
      <div
        className={cn(
          "absolute inset-0 bg-cover bg-center bg-no-repeat",
          canAnimate && "transition-opacity duration-1000 ease-in-out"
        )}
        style={{ backgroundImage: next ? `url(${next})` : undefined, opacity: showNext ? 1 : 0 }}
      />

      {/* Foreground */}
      {children ? <div className="relative z-10 h-full w-full">{children}</div> : null}
    </div>
  );
}


