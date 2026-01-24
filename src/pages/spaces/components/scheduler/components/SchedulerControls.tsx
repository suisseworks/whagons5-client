import { Button } from "@/components/ui/button";
import { Download, Filter, Undo2, Redo2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { SchedulerEvent } from "../types/scheduler";

interface SchedulerControlsProps {
  onExportPDF?: () => void;
  onExportPNG?: () => void;
  onExportExcel?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onFilterChange?: (filters: {
    categories: number[];
    statuses: number[];
    priorities: number[];
    teams: number[];
  }) => void;
  filters?: {
    categories: number[];
    statuses: number[];
    priorities: number[];
    teams: number[];
  };
  availableCategories?: Array<{ id: number; name: string }>;
  availableStatuses?: Array<{ id: number; name: string }>;
  availablePriorities?: Array<{ id: number; name: string }>;
  availableTeams?: Array<{ id: number; name: string }>;
}

export default function SchedulerControls({
  onExportPDF,
  onExportPNG,
  onExportExcel,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onFilterChange,
  filters = { categories: [], statuses: [], priorities: [], teams: [] },
  availableCategories = [],
  availableStatuses = [],
  availablePriorities = [],
  availableTeams = [],
}: SchedulerControlsProps) {
  const handleFilterToggle = (
    type: "categories" | "statuses" | "priorities" | "teams",
    id: number
  ) => {
    const current = filters[type];
    const updated = current.includes(id)
      ? current.filter((fid) => fid !== id)
      : [...current, id];

    onFilterChange?.({
      ...filters,
      [type]: updated,
    });
  };

  return (
    <div className="flex items-center gap-2">
      {/* Undo/Redo */}
      <Button
        size="sm"
        variant="outline"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
      >
        <Redo2 className="h-4 w-4" />
      </Button>

      {/* Filters */}
      {(availableCategories.length > 0 ||
        availableStatuses.length > 0 ||
        availablePriorities.length > 0 ||
        availableTeams.length > 0) && (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {(filters.categories.length > 0 ||
                filters.statuses.length > 0 ||
                filters.priorities.length > 0 ||
                filters.teams.length > 0) && (
                <span className="ml-2 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-xs">
                  {filters.categories.length +
                    filters.statuses.length +
                    filters.priorities.length +
                    filters.teams.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              {availableCategories.length > 0 && (
                <div>
                  <Label className="text-sm font-semibold">Categories</Label>
                  <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                    {availableCategories.map((cat) => (
                      <label
                        key={cat.id}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={filters.categories.includes(cat.id)}
                          onCheckedChange={() =>
                            handleFilterToggle("categories", cat.id)
                          }
                        />
                        <span className="text-sm">{cat.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {availableStatuses.length > 0 && (
                <div>
                  <Label className="text-sm font-semibold">Statuses</Label>
                  <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                    {availableStatuses.map((status) => (
                      <label
                        key={status.id}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={filters.statuses.includes(status.id)}
                          onCheckedChange={() =>
                            handleFilterToggle("statuses", status.id)
                          }
                        />
                        <span className="text-sm">{status.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {availablePriorities.length > 0 && (
                <div>
                  <Label className="text-sm font-semibold">Priorities</Label>
                  <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                    {availablePriorities.map((priority) => (
                      <label
                        key={priority.id}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={filters.priorities.includes(priority.id)}
                          onCheckedChange={() =>
                            handleFilterToggle("priorities", priority.id)
                          }
                        />
                        <span className="text-sm">{priority.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {availableTeams.length > 0 && (
                <div>
                  <Label className="text-sm font-semibold">Teams</Label>
                  <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                    {availableTeams.map((team) => (
                      <label
                        key={team.id}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={filters.teams.includes(team.id)}
                          onCheckedChange={() =>
                            handleFilterToggle("teams", team.id)
                          }
                        />
                        <span className="text-sm">{team.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    onFilterChange?.({
                      categories: [],
                      statuses: [],
                      priorities: [],
                      teams: [],
                    })
                  }
                >
                  Clear All
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Export */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onExportPDF}>Export as PDF</DropdownMenuItem>
          <DropdownMenuItem onClick={onExportPNG}>Export as PNG</DropdownMenuItem>
          <DropdownMenuItem onClick={onExportExcel}>Export as Excel</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
