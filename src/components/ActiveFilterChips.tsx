"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

interface ActiveFilterChipsProps {
  filterModel?: any;
  onRemoveFilter: (filterKey: string) => void;
  onClearAll: () => void;
}

export function ActiveFilterChips({ filterModel, onRemoveFilter, onClearAll }: ActiveFilterChipsProps) {
  const statuses = useSelector((s: RootState) => (s as any).statuses.value as any[]);
  const priorities = useSelector((s: RootState) => (s as any).priorities.value as any[]);
  const spots = useSelector((s: RootState) => (s as any).spots.value as any[]);
  const users = useSelector((s: RootState) => (s as any).users.value as any[]);
  const tags = useSelector((s: RootState) => (s as any).tags.value as any[]);

  if (!filterModel || Object.keys(filterModel).length === 0) {
    return null;
  }

  const chips: Array<{ key: string; label: string; value: string }> = [];

  // Status filter
  if (filterModel.status_id?.values) {
    const statusIds = filterModel.status_id.values;
    const statusNames = statusIds
      .map((id: number) => statuses.find((s: any) => Number(s.id) === Number(id))?.name)
      .filter(Boolean);
    if (statusNames.length > 0) {
      chips.push({
        key: 'status_id',
        label: 'Status',
        value: statusNames.join(', ')
      });
    }
  }

  // Priority filter
  if (filterModel.priority_id?.values) {
    const priorityIds = filterModel.priority_id.values;
    const priorityNames = priorityIds
      .map((id: number) => priorities.find((p: any) => Number(p.id) === Number(id))?.name)
      .filter(Boolean);
    if (priorityNames.length > 0) {
      chips.push({
        key: 'priority_id',
        label: 'Priority',
        value: priorityNames.join(', ')
      });
    }
  }

  // Spot/Location filter
  if (filterModel.spot_id?.values) {
    const spotIds = filterModel.spot_id.values;
    const spotNames = spotIds
      .map((id: number) => spots.find((s: any) => Number(s.id) === Number(id))?.name)
      .filter(Boolean);
    if (spotNames.length > 0) {
      chips.push({
        key: 'spot_id',
        label: 'Location',
        value: spotNames.join(', ')
      });
    }
  }

  // Owner filter
  if (filterModel.user_ids?.values) {
    const userIds = filterModel.user_ids.values;
    const userNames = userIds
      .map((id: number) => {
        const user = users.find((u: any) => Number(u.id) === Number(id));
        return user?.name || user?.email || `User #${id}`;
      })
      .filter(Boolean);
    if (userNames.length > 0) {
      chips.push({
        key: 'user_ids',
        label: 'Owner',
        value: userNames.join(', ')
      });
    }
  }

  // Tags filter
  if (filterModel.tag_ids?.values) {
    const tagIds = filterModel.tag_ids.values;
    const tagNames = tagIds
      .map((id: number) => tags.find((t: any) => Number(t.id) === Number(id))?.name)
      .filter(Boolean);
    if (tagNames.length > 0) {
      chips.push({
        key: 'tag_ids',
        label: 'Tags',
        value: tagNames.join(', ')
      });
    }
  }

  // Text search filter
  if (filterModel.name?.filter || filterModel.description?.filter) {
    const searchText = filterModel.name?.filter || filterModel.description?.filter;
    if (searchText) {
      chips.push({
        key: 'text',
        label: 'Search',
        value: searchText
      });
    }
  }

  // Due date filter
  if (filterModel.due_date) {
    let dueLabel = 'Due date';
    if (filterModel.due_date.type === 'overdue' || filterModel.due_date.type === 'dateBefore') {
      dueLabel = 'Overdue';
    } else if (filterModel.due_date.type === 'equals') {
      dueLabel = 'Due today';
    } else if (filterModel.due_date.operator === 'AND') {
      dueLabel = 'Due next 7 days';
    }
    chips.push({
      key: 'due_date',
      label: dueLabel,
      value: ''
    });
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {chips.map((chip) => (
        <div
          key={chip.key}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent/50 text-accent-foreground text-[11px] font-medium border border-border/30"
        >
          <span className="text-muted-foreground">{chip.label}:</span>
          <span className="truncate max-w-[200px]">{chip.value || chip.label}</span>
          <button
            type="button"
            onClick={() => onRemoveFilter(chip.key)}
            className="ml-0.5 hover:bg-accent rounded-sm p-0.5 transition-colors"
            aria-label={`Remove ${chip.label} filter`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      {chips.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
