import { useMemo } from "react";
import type { SchedulerResource } from "../types/scheduler";

export type GroupByOption = "none" | "team" | "role";

export function useResourceGrouping(
  resources: SchedulerResource[],
  groupBy: GroupByOption = "team"
) {
  const groupedResources = useMemo(() => {
    if (groupBy === "none") {
      return [{ key: "all", label: "All Resources", resources }];
    }

    if (groupBy === "team") {
      const groups = new Map<string, SchedulerResource[]>();
      
      resources.forEach((resource) => {
        const teamKey = resource.teamName || "Unassigned";
        if (!groups.has(teamKey)) {
          groups.set(teamKey, []);
        }
        groups.get(teamKey)!.push(resource);
      });

      return Array.from(groups.entries())
        .sort(([a], [b]) => {
          if (a === "Unassigned") return 1;
          if (b === "Unassigned") return -1;
          return a.localeCompare(b);
        })
        .map(([key, resources]) => ({
          key,
          label: key,
          resources,
        }));
    }

    // For role grouping, we'd need role data which isn't in SchedulerResource yet
    // This is a placeholder for future implementation
    return [{ key: "all", label: "All Resources", resources }];
  }, [resources, groupBy]);

  return {
    groupedResources,
    totalResources: resources.length,
  };
}
