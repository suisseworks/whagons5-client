import React from "react"
import { Button } from "./button"
import { MultiStateBadge, AnimatedSpinner, AnimatedCheck } from "@/animated/Status"

export type StatusKind = "idle" | "processing" | "success" | "error"

interface StatusButtonProps extends React.ComponentProps<typeof Button> {
  status?: StatusKind
  label?: string
}

export function StatusButton({ status = "idle", label, children, disabled, ...props }: StatusButtonProps) {
  const isProcessing = status === "processing"
  const isSuccess = status === "success"
  const isError = status === "error"

  // Use shadcn Button shell and slot the status indicator inline before text
  return (
    <Button {...props} disabled={disabled || isProcessing}>
      <span className="inline-flex items-center gap-2">
        {status === "idle" && null}
        {isProcessing && <AnimatedSpinner />}
        {isSuccess && <AnimatedCheck active={true} />}
        {isError && (
          // fallback to text indicator; could import a red icon too
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
        )}
        <span>{label ?? children}</span>
      </span>
    </Button>
  )
}

export default StatusButton


