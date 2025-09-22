import * as Checkbox from "@radix-ui/react-checkbox";
import { motion } from "motion/react";
import { useId, useState } from "react";

export default function CheckboxAnimated() {
  const [checked, setChecked] = useState(false);
  const id = useId();

  return (
    <div className="p-6">
      <label htmlFor={id} className="inline-flex items-center gap-3 cursor-pointer select-none">
        <Checkbox.Root
          id={id}
          checked={checked}
          onCheckedChange={(v) => setChecked(Boolean(v))}
          asChild
        >
          <motion.button
            type="button"
            className="grid place-items-center size-6 rounded-md border border-zinc-400 dark:border-zinc-600"
            initial={false}
            whileTap={{ scale: 0.96 }}
            animate={{ backgroundColor: checked ? "rgb(37 99 235 / 0.10)" : "transparent" }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            {/* Keep mounted so we can animate both directions */}
            <Checkbox.Indicator asChild forceMount>
              <motion.svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Draws from left->right (M5→L19).
                   Uses strokeDashoffset (normalized) to avoid the round-cap "dot". */}
                <motion.path
                  d="M5 12.5 10 17 19 7"
                  vectorEffect="non-scaling-stroke"
                  // Normalize total length to 1 so dash math is simple
                  pathLength={1}
                  // One full-length dash; offset 1 = completely hidden, 0 = fully drawn
                  style={{ strokeDasharray: 1 }}
                  initial={false}
                  animate={{ strokeDashoffset: checked ? 0 : 1 }}
                  transition={{ duration: 0.14, ease: "easeInOut" }}
                />
              </motion.svg>
            </Checkbox.Indicator>
          </motion.button>
        </Checkbox.Root>

        <span className="text-sm">Accept terms</span>
      </label>
    </div>
  );
}
