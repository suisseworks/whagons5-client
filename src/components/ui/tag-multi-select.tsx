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
          className={cn("w-full h-10 justify-between px-3 py-1.5", className)}
        >
          <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
            {selectedTags.length > 0 ? (
              <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
                {selectedTags.map((tag) => (
                  <div
                    key={tag.id}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium transition-colors h-5 flex-shrink-0"
                    style={{
                      backgroundColor: tag.color ? `${tag.color}20` : '#F3F4F6',
                      color: tag.color || '#374151',
                      border: `1px solid ${tag.color ? `${tag.color}40` : '#E5E7EB'}`,
                    }}
                    onClick={(e) => handleRemove(tag.id, e)}
                  >
                    <span className="truncate max-w-[100px]">{tag.name}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="rounded-full outline-none focus:ring-2 focus:ring-offset-1 focus:ring-ring cursor-pointer"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleRemove(tag.id, e)
                        }
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onClick={(e) => handleRemove(tag.id, e)}
                    >
                      <X className="h-2.5 w-2.5 opacity-70 hover:opacity-100" />
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground text-sm">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
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

