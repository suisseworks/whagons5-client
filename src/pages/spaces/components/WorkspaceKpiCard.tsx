import React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Accent = "indigo" | "amber" | "emerald" | "purple";

const accentClasses: Record<
  Accent,
  { bar: string; icon: string; glow: string }
> = {
  indigo: {
    bar: "bg-indigo-500/35",
    icon: "text-indigo-600",
    glow: "group-hover:shadow-indigo-500/5",
  },
  amber: {
    bar: "bg-amber-500/35",
    icon: "text-amber-600",
    glow: "group-hover:shadow-amber-500/5",
  },
  emerald: {
    bar: "bg-emerald-500/35",
    icon: "text-emerald-600",
    glow: "group-hover:shadow-emerald-500/5",
  },
  purple: {
    bar: "bg-purple-500/35",
    icon: "text-purple-600",
    glow: "group-hover:shadow-purple-500/5",
  },
};

export type WorkspaceKpiCardProps = {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: Accent;
  helperText?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  isSelected?: boolean;
};

export function WorkspaceKpiCard({
  label,
  value,
  icon,
  accent,
  helperText,
  right,
  onClick,
  isSelected = false,
}: WorkspaceKpiCardProps) {
  const a = accentClasses[accent];

  return (
    <motion.div
      className={cn(
        "workspace-kpi-card group relative overflow-hidden rounded-xl border",
        "bg-card/95",
        "shadow-sm hover:shadow-md transition-all duration-200",
        "border-border/60 hover:-translate-y-0.5",
        "h-full min-h-[100px]",
        a.glow,
        onClick && "cursor-pointer",
        isSelected && "ring-2 ring-offset-2",
        isSelected && accent === "indigo" && "ring-indigo-500",
        isSelected && accent === "amber" && "ring-amber-500",
        isSelected && accent === "emerald" && "ring-emerald-500",
        isSelected && accent === "purple" && "ring-purple-500"
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      whileHover={{ scale: 1.01 }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      {/* Accent bar */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-0.5",
          a.bar
        )}
      />

      <div className="relative z-10 flex items-start gap-3 px-4 py-3 h-full">
        <div className="workspace-kpi-icon flex h-9 w-9 shrink-0 items-center justify-center">
          <span className={cn("kpi-icon-inner", a.icon)}>{icon}</span>
        </div>

        <div className="min-w-0 flex-1 flex flex-col justify-between h-full">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80 truncate mb-0.5">
              {label}
            </div>
            <div className="text-[26px] font-semibold leading-tight text-foreground truncate">
              {value}
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground/70 truncate mt-0.5 min-h-[14px]">
            {helperText || '\u00A0'}
          </div>
        </div>

        {right ? (
          <div className="flex-shrink-0 w-24 sm:w-28 opacity-80 group-hover:opacity-100 transition-opacity">
            {right}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

