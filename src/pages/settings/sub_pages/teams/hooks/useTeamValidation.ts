import { useMemo } from "react";
import { Team, Category, Task } from "@/store/types";

export function useTeamValidation(teams: Team[], categories: Category[], tasks: Task[]) {
  const getTeamCategoryCount = (teamId: number) => {
    return categories.filter((category: Category) => category.team_id === teamId).length;
  };

  const getTeamTaskCount = (teamId: number) => {
    return tasks.filter((task: Task) => task.team_id === teamId).length;
  };

  const canDeleteTeam = (team: Team) => {
    const categoryCount = getTeamCategoryCount(team.id);
    const taskCount = getTeamTaskCount(team.id);
    return categoryCount === 0 && taskCount === 0;
  };

  return {
    getTeamCategoryCount,
    getTeamTaskCount,
    canDeleteTeam
  };
}
