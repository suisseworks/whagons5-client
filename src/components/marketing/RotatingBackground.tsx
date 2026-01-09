import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
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

  // Track images that fail to load so we can skip them (e.g. missing local assets).
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const preloadedRef = useRef<Set<string>>(new Set());

  const usableImages = useMemo(() => {
    const list = (images ?? []).filter(Boolean);
    if (!failedImages.size) return list;
    return list.filter((src) => !failedImages.has(src));
  }, [images, failedImages]);

  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    if (!images?.length) return 0;
    return randomStart ? Math.floor(Math.random() * images.length) : 0;
  });
  const [nextIndex, setNextIndex] = useState<number>(currentIndex);
  const [showNext, setShowNext] = useState(false);

  useEffect(() => {
    if (!usableImages?.length) return;
    // If images array changes, ensure indices stay valid.
    setCurrentIndex((i) => Math.min(i, usableImages.length - 1));
  }, [usableImages.length]);

  useEffect(() => {
    if (!images?.length) return;
    // Fire-and-forget preload to detect broken URLs; background-image doesn't surface load errors.
    images.forEach((src) => {
      if (!src) return;
      if (preloadedRef.current.has(src)) return;
      preloadedRef.current.add(src);

      const img = new Image();
      img.onload = () => {
        // keep
      };
      img.onerror = () => {
        setFailedImages((prev) => {
          if (prev.has(src)) return prev;
          const next = new Set(prev);
          next.add(src);
          return next;
        });
      };
      img.src = src;
    });
  }, [images]);

  useEffect(() => {
    if (!usableImages?.length) return;
    if (!canAnimate) return;
    if (usableImages.length < 2) return;

    let timeoutId: number | null = null;
    const id = window.setInterval(() => {
      const next = (currentIndex + 1) % usableImages.length;
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
  }, [canAnimate, usableImages.length, intervalMs, currentIndex]);

  const current = usableImages?.[currentIndex];
  const next = usableImages?.[nextIndex];

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


