"use client";

import { cn } from "@/lib/utils";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { useEffect, useRef, useState } from "react";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2 min-h-0 h-full", className)}
      {...props}
    />
  );
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const [indicatorStyle, setIndicatorStyle] = useState({
    transform: 'translateX(0px)',
    width: 0,
    top: 0,
    height: 2,
  });
  const tabsListRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const updateIndicator = React.useCallback(() => {
    if (!tabsListRef.current) return;

    const activeTab = tabsListRef.current.querySelector<HTMLElement>(
      '[data-state="active"]'
    );
    if (!activeTab) return;

    const activeRect = activeTab.getBoundingClientRect();
    const tabsRect = tabsListRef.current.getBoundingClientRect();

    const left = activeRect.left - tabsRect.left;
    const width = activeRect.width;
    const top = activeRect.bottom - tabsRect.top - 2; // underline position
    setIndicatorStyle({ 
      transform: `translateX(${left}px)`, 
      width, 
      top, 
      height: 2 
    });
  }, []);

  // Schedule a single indicator update on the next frame.
  // CSS transitions handle the animation; repeatedly measuring layout each frame
  // can trigger forced reflow warnings (especially during dialog/sheet open).
  const scheduleIndicatorUpdate = React.useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(() => {
      updateIndicator();
      animationFrameRef.current = null;
    });
  }, [updateIndicator]);

  useEffect(() => {
    // Initial update
    const timeoutId = setTimeout(updateIndicator, 0);

    // Event listeners
    window.addEventListener("resize", scheduleIndicatorUpdate);
    const observer = new MutationObserver(scheduleIndicatorUpdate);

    if (tabsListRef.current) {
      observer.observe(tabsListRef.current, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    return () => {
      clearTimeout(timeoutId);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener("resize", scheduleIndicatorUpdate);
      observer.disconnect();
    };
  }, [updateIndicator, scheduleIndicatorUpdate]);

  return (
    <div className="relative" ref={tabsListRef}>
      <TabsPrimitive.List
        ref={ref}
        data-slot="tabs-list"
        className={cn(
          "text-muted-foreground relative inline-flex h-10 w-fit items-center gap-1 border-b border-border/60",
          className
        )}
        {...props}
      />
      <div
        className="absolute left-0 h-[2px] rounded-full bg-foreground/80 transition-[transform,width] duration-300 ease-in-out pointer-events-none will-change-[transform,width]"
        style={indicatorStyle}
      />
    </div>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    data-slot="tabs-trigger"
      className={cn(
        "text-foreground/55 data-[state=active]:text-foreground data-[state=active]:font-semibold inline-flex h-[calc(100%-2px)] flex-1 items-center justify-center px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 focus-visible:outline-ring focus-visible:outline-1 focus-visible:ring-[3px] focus-visible:ring-ring/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[state=inactive]:[&_.tab-label-text]:max-w-0 data-[state=inactive]:[&_.tab-label-text]:opacity-0 data-[state=inactive]:[&_.tab-label-text]:w-0 data-[state=active]:[&_.tab-label-text]:max-w-full data-[state=active]:[&_.tab-label-text]:opacity-100 data-[state=active]:[&_.tab-label-text]:w-auto",
        className
      )}
    {...props}
  >
    <span className="inline-flex items-center gap-1.5 transition-[width,gap] duration-300 ease-in-out will-change-[width] [&_.tab-label-text]:transition-[max-width,opacity,width] [&_.tab-label-text]:duration-300 [&_.tab-label-text]:ease-in-out [&_.tab-label-text]:inline-block [&_.tab-label-text]:overflow-hidden">
      {props.children}
    </span>
  </TabsPrimitive.Trigger>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    data-slot="tabs-content"
    className={cn(
      // Keep layout sizing, but hide when not active
      "flex-1 min-h-0 flex flex-col outline-none mt-2 data-[state=inactive]:hidden",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
