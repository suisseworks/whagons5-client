"use client";

import React from "react";
import { MoreHorizontal, Edit3, Copy, Flag, Trash2, CheckCircle2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function TaskRowActions({
  onEdit,
  onDelete,
  onDuplicate,
  onMarkComplete,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onMarkComplete?: () => void;
}) {
  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent"
                aria-label="More actions"
                title="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Actions (.)</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={onEdit}><Edit3 className="h-4 w-4 mr-2" /> Edit	<span className="ml-auto text-xs text-muted-foreground">E</span></DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}><Copy className="h-4 w-4 mr-2" /> Duplicate	<span className="ml-auto text-xs text-muted-foreground">D</span></DropdownMenuItem>
        <DropdownMenuItem onClick={onMarkComplete}><CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" /> Mark Complete	<span className="ml-auto text-xs text-muted-foreground">C</span></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4 mr-2" /> Delete	<span className="ml-auto text-xs text-muted-foreground">Del</span></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default TaskRowActions;


