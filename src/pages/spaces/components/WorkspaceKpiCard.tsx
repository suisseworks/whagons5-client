import React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Accent = "indigo" | "amber" | "emerald" | "purple";

const accentClasses: Record<
  Accent,
  { bar: string; icon: string; iconBg: string; glow: string }
> = {
  indigo: {
    bar: "from-indigo-400/60 via-indigo-300/30 to-indigo-400/60",
    icon: "text-indigo-600",
    iconBg: "bg-indigo-500/10 ring-indigo-500/15",
    glow: "group-hover:shadow-indigo-500/10",
  },
  amber: {
    bar: "from-amber-400/60 via-amber-300/30 to-amber-400/60",
    icon: "text-amber-600",
    iconBg: "bg-amber-500/10 ring-amber-500/15",
    glow: "group-hover:shadow-amber-500/10",
  },
  emerald: {
    bar: "from-emerald-400/60 via-emerald-300/30 to-emerald-400/60",
    icon: "text-emerald-600",
    iconBg: "bg-emerald-500/10 ring-emerald-500/15",
    glow: "group-hover:shadow-emerald-500/10",
  },
  purple: {
    bar: "from-purple-400/60 via-purple-300/30 to-purple-400/60",
    icon: "text-purple-600",
    iconBg: "bg-purple-500/10 ring-purple-500/15",
    glow: "group-hover:shadow-purple-500/10",
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
};

export function WorkspaceKpiCard({
  label,
  value,
  icon,
  accent,
  helperText,
  right,
  onClick,
}: WorkspaceKpiCardProps) {
  const a = accentClasses[accent];

  return (
    <motion.div
      className={cn(
        "workspace-kpi-card group relative overflow-hidden rounded-xl border",
        "bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm",
        "shadow-sm hover:shadow-md transition-all duration-300",
        "border-border/60 hover:-translate-y-0.5",
        a.glow,
        onClick && "cursor-pointer"
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
          "absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r animate-gradient-x opacity-70",
          a.bar
        )}
      />

      {/* Soft wash */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-[0.035] transition-opacity duration-300",
          a.bar
        )}
      />

      <div className="relative z-10 flex items-start gap-3 px-4 py-3">
        <div
          className={cn(
            "workspace-kpi-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            "ring-1",
            a.iconBg
          )}
        >
          <span className={cn("kpi-icon-inner", a.icon)}>{icon}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80 truncate mb-0.5">
            {label}
          </div>
          <div className="text-2xl font-bold leading-tight text-foreground truncate">
            {value}
          </div>
          {helperText ? (
            <div className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
              {helperText}
            </div>
          ) : null}
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

