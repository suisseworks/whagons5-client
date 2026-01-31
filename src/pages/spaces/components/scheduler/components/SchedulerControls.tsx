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
    <div className="flex items-center gap-2 px-1">
      {/* Undo/Redo */}
      <div className="inline-flex rounded-lg border border-border/40 bg-background/80 p-0.5 shadow-sm">
        <Button
          size="sm"
          variant="ghost"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="h-8 w-8 p-0 rounded-md hover:bg-muted/60 transition-all disabled:opacity-40"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="h-8 w-8 p-0 rounded-md hover:bg-muted/60 transition-all disabled:opacity-40"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="scheduler-toolbar-divider h-6 w-px bg-border/40" />

      {/* Filters */}
      {(availableCategories.length > 0 ||
        availableStatuses.length > 0 ||
        availablePriorities.length > 0 ||
        availableTeams.length > 0) && (
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              size="sm" 
              variant="outline"
              className="h-8 px-3 gap-2 shadow-sm hover:shadow border-border/40 hover:border-border/60 transition-all text-xs font-medium bg-background/80"
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filters</span>
              {(filters.categories.length > 0 ||
                filters.statuses.length > 0 ||
                filters.priorities.length > 0 ||
                filters.teams.length > 0) && (
                <span className="ml-0.5 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold min-w-[18px] text-center">
                  {filters.categories.length +
                    filters.statuses.length +
                    filters.priorities.length +
                    filters.teams.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 rounded-xl border-border/40 shadow-xl" align="end">
            <div className="p-4 border-b border-border/30 bg-muted/20">
              <h4 className="font-semibold text-sm">Filter Events</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Select criteria to filter the timeline</p>
            </div>
            <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
              {availableCategories.length > 0 && (
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categories</Label>
                  <div className="mt-2 space-y-1.5 max-h-28 overflow-y-auto">
                    {availableCategories.map((cat) => (
                      <label
                        key={cat.id}
                        className="flex items-center space-x-2.5 cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors"
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
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Statuses</Label>
                  <div className="mt-2 space-y-1.5 max-h-28 overflow-y-auto">
                    {availableStatuses.map((status) => (
                      <label
                        key={status.id}
                        className="flex items-center space-x-2.5 cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors"
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
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priorities</Label>
                  <div className="mt-2 space-y-1.5 max-h-28 overflow-y-auto">
                    {availablePriorities.map((priority) => (
                      <label
                        key={priority.id}
                        className="flex items-center space-x-2.5 cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors"
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
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Teams</Label>
                  <div className="mt-2 space-y-1.5 max-h-28 overflow-y-auto">
                    {availableTeams.map((team) => (
                      <label
                        key={team.id}
                        className="flex items-center space-x-2.5 cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors"
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
            </div>
            <div className="flex justify-end p-3 border-t border-border/30 bg-muted/10">
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
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
          </PopoverContent>
        </Popover>
      )}

      {/* Export */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            size="sm" 
            variant="outline"
            className="h-8 px-3 gap-2 shadow-sm hover:shadow border-border/40 hover:border-border/60 transition-all text-xs font-medium bg-background/80"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl border-border/40 shadow-xl">
          <DropdownMenuItem onClick={onExportPDF} className="cursor-pointer">
            <span className="text-sm">Export as PDF</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onExportPNG} className="cursor-pointer">
            <span className="text-sm">Export as PNG</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onExportExcel} className="cursor-pointer">
            <span className="text-sm">Export as Excel</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
