"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxProps {
  options: Array<{ value: string; label: string; description?: string }>
  value?: string
  onValueChange?: (value: string | undefined) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  autoFocus?: boolean
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  className,
  autoFocus = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const hasAutoFocusedRef = React.useRef(false)

  const selectedOption = options.find((option) => option.value === value)

  // Handle autoFocus: open popover and focus input immediately
  React.useEffect(() => {
    if (autoFocus && !hasAutoFocusedRef.current) {
      hasAutoFocusedRef.current = true
      // Open popover immediately
      setOpen(true)
      // Focus input after popover opens
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [autoFocus])

  // Focus input when popover opens (for non-autoFocus cases)
  React.useEffect(() => {
    if (open && !autoFocus) {
      // Delay to ensure popover content is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [open, autoFocus])

  // Handle keyboard input on trigger button to open popover
  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    // If user starts typing a printable character, open popover
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== 'Enter' && e.key !== ' ') {
      if (!open) {
        e.preventDefault()
        setOpen(true)
        // Focus will be handled by the useEffect when popover opens
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full h-10 justify-between px-3 py-1.5", className)}
          onKeyDown={handleTriggerKeyDown}
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput ref={inputRef} placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = value === option.value;
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      // Always set the value, don't toggle - let the parent handle deselection if needed
                      onValueChange?.(option.value)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      {option.description && (
                        <span className="text-xs text-[#6B7280]">{option.description}</span>
                      )}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

