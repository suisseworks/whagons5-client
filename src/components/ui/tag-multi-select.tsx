"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
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

interface Tag {
  id: number;
  name: string;
  color?: string | null;
}

interface TagMultiSelectProps {
  tags: Tag[]
  value?: number[]
  onValueChange?: (value: number[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
}

export function TagMultiSelect({
  tags,
  value = [],
  onValueChange,
  placeholder = "Select tags...",
  searchPlaceholder = "Search tags...",
  emptyText = "No tags found.",
  className,
}: TagMultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const selectedValues = Array.isArray(value) ? value : []
  const selectedTags = tags.filter((tag) => selectedValues.includes(tag.id))

  const handleSelect = (tagId: number) => {
    const newValue = selectedValues.includes(tagId)
      ? selectedValues.filter((v) => v !== tagId)
      : [...selectedValues, tagId]
    onValueChange?.(newValue)
  }

  const handleRemove = (tagId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const newValue = selectedValues.filter((v) => v !== tagId)
    onValueChange?.(newValue)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full min-h-10 h-auto justify-between", className)}
        >
          <div className="flex flex-wrap gap-1.5 flex-1">
            {selectedTags.length > 0 ? (
              selectedTags.map((tag) => (
                <div
                  key={tag.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: tag.color ? `${tag.color}20` : '#F3F4F6',
                    color: tag.color || '#374151',
                    border: `1px solid ${tag.color ? `${tag.color}40` : '#E5E7EB'}`,
                  }}
                  onClick={(e) => handleRemove(tag.id, e)}
                >
                  <span>{tag.name}</span>
                  <button
                    className="rounded-full outline-none focus:ring-2 focus:ring-offset-1 focus:ring-ring"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleRemove(tag.id, e)
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onClick={(e) => handleRemove(tag.id, e)}
                  >
                    <X className="h-3 w-3 opacity-70 hover:opacity-100" />
                  </button>
                </div>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {tags.map((tag) => {
                const isSelected = selectedValues.includes(tag.id)
                return (
                  <CommandItem
                    key={tag.id}
                    value={tag.name}
                    onSelect={() => handleSelect(tag.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div
                      className="flex items-center gap-2 px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: tag.color ? `${tag.color}20` : '#F3F4F6',
                        color: tag.color || '#374151',
                      }}
                    >
                      {tag.name}
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

