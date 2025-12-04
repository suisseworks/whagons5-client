import { MultiStateBadge } from "@/animated/Status";
import { Button } from "@/components/ui/button";
import React from "react";

type BadgeState = "start" | "processing" | "success" | "error"

export default function TestPage() {
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
