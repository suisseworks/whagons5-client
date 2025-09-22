import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { XCircle } from "lucide-react"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

// If you're using shadcn/ui in your project, you can keep these imports.
// Otherwise, swap the <button> wrappers to plain elements as needed.
import { Button } from "@/components/ui/button"

// --- Types & config ---------------------------------------------------------

type BadgeState = "start" | "processing" | "success" | "error" | "custom"

type StatusConfig = {
  label: string
  icon?: React.ComponentType<{ className?: string }> | any // Can be FontAwesome icon object
  bg: string
  glow: string
  color?: string
}

const STATE_MAP: Record<Exclude<BadgeState, "custom">, StatusConfig> = {
  start: {
    label: "Start",
    bg: "text-blue-600 ring-blue-500/20",
    glow: "ring-blue-500/25",
  },
  processing: {
    label: "Processing",
    bg: "text-indigo-600 ring-indigo-500/20",
    glow: "ring-indigo-500/25",
  },
  success: {
    label: "Success",
    bg: "text-emerald-600 ring-emerald-500/20",
    glow: "ring-emerald-500/25",
  },
  error: {
    label: "Error",
    icon: XCircle,
    bg: "text-red-600 ring-red-500/20",
    glow: "ring-red-500/25",
  },
}

// Small spring for snappy, delightful transitions
const SPRING = { type: "spring", stiffness: 520, damping: 24, mass: 0.9 }

// --- Component --------------------------------------------------------------

// Inline animated SVG spinner (smooth rotating dash)
function AnimatedSpinner() {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      initial={false}
    >
      <motion.circle
        cx="12"
        cy="12"
        r="9"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
        style={{ strokeDasharray: "0.3 0.7" }}
        animate={{ strokeDashoffset: [0, -1] }}
        transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
      />
    </motion.svg>
  )
}

// Inline animated SVG check that path-traces left→right without a start/end dot
function AnimatedCheck({ active }: { active: boolean }) {
  return (
    <motion.svg
      key={String(active)}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={false}
      aria-hidden
    >
      <motion.path
        d="M5 12.5 10 17 19 7"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
        style={{ strokeDasharray: 1 }}
        animate={{ strokeDashoffset: active ? 0 : 1, filter: active ? "blur(0px)" : "blur(2px)" }}
        transition={{ duration: 0.18, ease: "easeInOut" }}
      />
    </motion.svg>
  )
}

interface MultiStateBadgeProps {
  state: BadgeState
  onClick?: () => void
  className?: string
  label?: string // override label if desired
  customStatus?: StatusConfig // for custom status states
}

export function MultiStateBadge({ state, onClick, className = "", label, customStatus }: MultiStateBadgeProps) {
  const cfg = state === "custom" ? customStatus : STATE_MAP[state]
  if (!cfg) return null

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={[
        "relative inline-flex items-center gap-2 rounded-full px-3.5 py-1.5",
        state !== "custom" ? "bg-background/50 backdrop-blur-sm ring-1" : "",
        cfg.bg,
        className,
      ].join(" ")}
      style={state !== "custom" && cfg.color ? { color: cfg.color } : undefined}
      layout="size"
      transition={SPRING}
      whileTap={{ scale: 0.98 }}
      aria-busy={state === "processing"}
    >
      {/* Soft glow that morphs between states */}
      {state !== "custom" && (
        <motion.span
          className={["absolute inset-0 rounded-full pointer-events-none", cfg.glow].join(" ")}
          layoutId="badge-glow"
          aria-hidden
        />
      )}

            {/* Icon / Indicator */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state + "-icon"}
          className="inline-flex"
          initial={{ opacity: 0, rotate: -6, y: -1, filter: "blur(2px)" }}
          animate={{ opacity: 1, rotate: 0, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, rotate: 6, y: 2, filter: "blur(2px)" }}
          transition={{ duration: 0.14 }}
          aria-hidden
        >
          {state === "success" ? (
            <AnimatedCheck active={true} />
          ) : state === "processing" ? (
            <AnimatedSpinner />
          ) : cfg.icon ? (
            // Check if it's a FontAwesome icon object or React component
            typeof cfg.icon === 'object' && cfg.icon.iconName ? (
              <FontAwesomeIcon
                icon={cfg.icon}
                className="h-3.5 w-3.5"
                style={{ color: cfg.color }}
              />
            ) : React.isValidElement(cfg.icon) ? (
              cfg.icon
            ) : null
          ) : null}
        </motion.span>
      </AnimatePresence>

      {/* Label (crossfades + springy width) */}
      <span className="sr-only">Status:</span>
      <motion.div layout="size" transition={SPRING} className="relative inline-flex overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={state + "-label"}
            layout
            initial={{ opacity: 0, y: -4, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 4, filter: "blur(4px)" }}
            transition={{ duration: 0.16 }}
            className="block text-xs font-medium tracking-wide"
          >
            {label ?? cfg.label}
          </motion.span>
        </AnimatePresence>
      </motion.div>
    </motion.button>
  )
}

// --- Demo page --------------------------------------------------------------

export default function DemoMultiStateBadge() {
  const [state, setState] = React.useState<BadgeState>("start")
  const order: BadgeState[] = ["start", "processing", "success", "error"]

  function cycle() {
    setState((s) => order[(order.indexOf(s) + 1) % order.length])
  }

  return (
    <div className="min-h-[60vh] w-full grid place-items-center p-8">
      <div className="flex flex-col items-center gap-6">
        <MultiStateBadge state={state} onClick={cycle} />

        <div className="flex items-center gap-2">
          {order.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={s === state ? "default" : "outline"}
              onClick={() => setState(s)}
              className="capitalize"
            >
              {s}
            </Button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Click the badge to cycle states
        </p>
      </div>
    </div>
  )
}
