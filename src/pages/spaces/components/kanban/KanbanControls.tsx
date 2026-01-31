import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Filter,
  X,
  Download,
  Grid3x3,
  LayoutList,
} from 'lucide-react';
import type { KanbanFilters } from './types/kanban.types';
import type { Category, Status, Priority, Team } from '@/store/types';
import { Badge } from '@/components/ui/badge';

interface KanbanControlsProps {
  filters: KanbanFilters;
  onFilterChange: (filters: KanbanFilters) => void;
  availableCategories: Category[];
  availableStatuses: Status[];
  availablePriorities: Priority[];
  availableTeams: Team[];
  viewMode: 'compact' | 'detailed';
  onViewModeChange: (mode: 'compact' | 'detailed') => void;
  groupBy: 'none' | 'priority' | 'team' | 'assignee';
  onGroupByChange: (groupBy: 'none' | 'priority' | 'team' | 'assignee') => void;
  onExport?: () => void;
}

export default function KanbanControls({
  filters,
  onFilterChange,
  availableCategories,
  availableStatuses,
  availablePriorities,
  availableTeams,
  viewMode,
  onViewModeChange,
  groupBy,
  onGroupByChange,
  onExport,
}: KanbanControlsProps) {
  const [searchValue, setSearchValue] = useState(filters.search);

  // Count active filters
  const activeFilterCount =
    filters.categories.length +
    filters.statuses.length +
    filters.priorities.length +
    filters.teams.length +
    (filters.search ? 1 : 0);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    onFilterChange({ ...filters, search: value });
  };

  const handleCategoryToggle = (categoryId: number) => {
    const newCategories = filters.categories.includes(categoryId)
      ? filters.categories.filter((id) => id !== categoryId)
      : [...filters.categories, categoryId];
    onFilterChange({ ...filters, categories: newCategories });
  };

  const handleStatusToggle = (statusId: number) => {
    const newStatuses = filters.statuses.includes(statusId)
      ? filters.statuses.filter((id) => id !== statusId)
      : [...filters.statuses, statusId];
    onFilterChange({ ...filters, statuses: newStatuses });
  };

  const handlePriorityToggle = (priorityId: number) => {
    const newPriorities = filters.priorities.includes(priorityId)
      ? filters.priorities.filter((id) => id !== priorityId)
      : [...filters.priorities, priorityId];
    onFilterChange({ ...filters, priorities: newPriorities });
  };

  const handleTeamToggle = (teamId: number) => {
    const newTeams = filters.teams.includes(teamId)
      ? filters.teams.filter((id) => id !== teamId)
      : [...filters.teams, teamId];
    onFilterChange({ ...filters, teams: newTeams });
  };

  const handleClearAll = () => {
    setSearchValue('');
    onFilterChange({
      categories: [],
      statuses: [],
      priorities: [],
      teams: [],
      search: '',
    });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-[300px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchValue && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => handleSearchChange('')}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Filters Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="default" className="ml-1 px-1.5 py-0 h-5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Filters</h4>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-auto p-1 text-xs"
                >
                  Clear all
                </Button>
              )}
            </div>

            <Separator />

            {/* Categories */}
            {availableCategories.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Categories</Label>
                <div className="space-y-2 max-h-[150px] overflow-y-auto">
                  {availableCategories.map((category) => (
                    <div key={category.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`category-${category.id}`}
                        checked={filters.categories.includes(category.id)}
                        onCheckedChange={() => handleCategoryToggle(category.id)}
                      />
                      <Label
                        htmlFor={`category-${category.id}`}
                        className="flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Priorities */}
            {availablePriorities.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Priorities</Label>
                <div className="space-y-2 max-h-[150px] overflow-y-auto">
                  {availablePriorities.map((priority) => (
                    <div key={priority.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`priority-${priority.id}`}
                        checked={filters.priorities.includes(priority.id)}
                        onCheckedChange={() => handlePriorityToggle(priority.id)}
                      />
                      <Label
                        htmlFor={`priority-${priority.id}`}
                        className="flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: priority.color || '#888' }}
                        />
                        {priority.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Teams */}
            {availableTeams.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Teams</Label>
                <div className="space-y-2 max-h-[150px] overflow-y-auto">
                  {availableTeams.map((team) => (
                    <div key={team.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`team-${team.id}`}
                        checked={filters.teams.includes(team.id)}
                        onCheckedChange={() => handleTeamToggle(team.id)}
                      />
                      <Label
                        htmlFor={`team-${team.id}`}
                        className="flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: team.color || '#888' }}
                        />
                        {team.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Group By */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Grid3x3 className="w-4 h-4" />
            Group: {groupBy === 'none' ? 'None' : groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48" align="start">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Group By</Label>
            {(['none', 'priority', 'team', 'assignee'] as const).map((option) => (
              <Button
                key={option}
                variant={groupBy === option ? 'default' : 'ghost'}
                size="sm"
                className="w-full justify-start"
                onClick={() => onGroupByChange(option)}
              >
                {option === 'none' ? 'None' : option.charAt(0).toUpperCase() + option.slice(1)}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* View Mode */}
      <div className="flex items-center gap-1 border rounded-md">
        <Button
          variant={viewMode === 'compact' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onViewModeChange('compact')}
          className="rounded-r-none"
        >
          <Grid3x3 className="w-4 h-4" />
        </Button>
        <Button
          variant={viewMode === 'detailed' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onViewModeChange('detailed')}
          className="rounded-l-none"
        >
          <LayoutList className="w-4 h-4" />
        </Button>
      </div>

      {/* Export */}
      {onExport && (
        <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
          <Download className="w-4 h-4" />
          Export
        </Button>
      )}
    </div>
  );
}
