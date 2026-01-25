import { useMemo } from "react";
import { Category, Task, Team } from "@/store/types";
import dayjs from "dayjs";

interface UseCategoryStatisticsProps {
  categories: Category[];
  tasks: Task[];
  teams: Team[];
}

export const useCategoryStatistics = ({ categories, tasks, teams }: UseCategoryStatisticsProps) => {
  const enabledCategoriesCount = useMemo(
    () => categories.filter((cat: Category) => cat.enabled).length,
    [categories]
  );

  const disabledCategoriesCount = useMemo(
    () => categories.filter((cat: Category) => !cat.enabled).length,
    [categories]
  );

  const tasksByCategory = useMemo(() => {
    const counts = new Map<number, number>();
    (tasks as Task[]).forEach((task: Task) => {
      const cid = task.category_id;
      if (!cid) return;
      counts.set(cid, (counts.get(cid) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([categoryId, count]) => {
        const category = categories.find((c: Category) => c.id === categoryId);
        return category ? { category, count } : null;
      })
      .filter(
        (item): item is { category: Category; count: number } => !!item
      )
      .sort((a, b) => b.count - a.count);
  }, [tasks, categories]);

  const categoriesByTeam = useMemo(() => {
    const counts = new Map<number, number>();
    categories.forEach((cat: Category) => {
      const tid = (cat as any).team_id as number | null | undefined;
      if (!tid) return;
      counts.set(tid, (counts.get(tid) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([teamId, count]) => {
        const team = teams.find((t: Team) => t.id === teamId);
        return team ? { team, count } : null;
      })
      .filter(
        (item): item is { team: Team; count: number } => !!item
      )
      .sort((a, b) => b.count - a.count);
  }, [categories, teams]);

  const tasksOverTime = useMemo(() => {
    const map = new Map<string, number>();
    (tasks as Task[]).forEach((task: Task) => {
      if (!task.created_at) return;
      const date = dayjs(task.created_at).format("YYYY-MM-DD");
      map.set(date, (map.get(date) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [tasks]);

  return {
    enabledCategoriesCount,
    disabledCategoriesCount,
    tasksByCategory,
    categoriesByTeam,
    tasksOverTime
  };
};
