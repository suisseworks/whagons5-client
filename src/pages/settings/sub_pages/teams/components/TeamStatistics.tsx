import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";
import { Team, Category, Task } from "@/store/types";

interface TeamStatisticsProps {
  teams: Team[];
  categories: Category[];
  tasks: Task[];
  translate: (key: string, fallback: string) => string;
}

export function TeamStatistics({ teams, categories, tasks, translate }: TeamStatisticsProps) {
  const totalTeams = teams.length;
  const totalCategories = categories.length;

  const activeTeams = useMemo(
    () => teams.filter((t: any) => t.is_active !== false).length,
    [teams]
  );

  const inactiveTeams = totalTeams - activeTeams;

  const tasksByTeam = useMemo(() => {
    const counts = new Map<number, number>();
    tasks.forEach((task: Task) => {
      const tid = task.team_id as number | null | undefined;
      if (!tid) return;
      counts.set(tid, (counts.get(tid) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([teamId, count]) => {
        const team = teams.find((t: Team) => t.id === teamId);
        return team ? { team, count } : null;
      })
      .filter((item): item is { team: Team; count: number } => !!item)
      .sort((a, b) => b.count - a.count);
  }, [tasks, teams]);

  const categoriesByTeam = useMemo(() => {
    const counts = new Map<number, number>();
    categories.forEach((cat: any) => {
      const tid = cat.team_id as number | null | undefined;
      if (!tid) return;
      counts.set(tid, (counts.get(tid) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([teamId, count]) => {
        const team = teams.find((t: Team) => t.id === teamId);
        return team ? { team, count } : null;
      })
      .filter((item): item is { team: Team; count: number } => !!item)
      .sort((a, b) => b.count - a.count);
  }, [categories, teams]);

  const tasksOverTime = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach((task: Task) => {
      if (!task.created_at) return;
      const date = dayjs(task.created_at).format("YYYY-MM-DD");
      map.set(date, (map.get(date) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [tasks]);

  const avgCategoriesPerTeam =
    totalTeams > 0 ? Math.round((totalCategories / totalTeams) * 10) / 10 : 0;

  const summaryLabels = {
    total: translate('stats.cards.total', 'Total Teams'),
    active: translate('stats.cards.active', 'Active Teams'),
    inactive: translate('stats.cards.inactive', 'Inactive Teams'),
    avgCategories: translate('stats.cards.avgCategories', 'Avg Categories / Team')
  };
  const statusChart = {
    title: translate('stats.charts.status.title', 'Teams by Status'),
    description: translate('stats.charts.status.description', 'Active vs inactive teams'),
    legendActive: translate('stats.charts.status.legendActive', 'Active'),
    legendInactive: translate('stats.charts.status.legendInactive', 'Inactive'),
    seriesName: translate('stats.charts.status.seriesName', 'Teams'),
    empty: translate('stats.empty.noTeams', 'No team data available')
  };
  const tasksChart = {
    title: translate('stats.charts.tasksByTeam.title', 'Tasks by Team'),
    description: translate('stats.charts.tasksByTeam.description', 'Top teams by assigned tasks'),
    axis: translate('stats.charts.tasksByTeam.axis', 'Tasks'),
    empty: translate('stats.empty.noTasks', 'No task data available')
  };
  const categoriesChart = {
    title: translate('stats.charts.categoriesByTeam.title', 'Categories by Team'),
    description: translate('stats.charts.categoriesByTeam.description', 'Distribution of categories across teams'),
    axis: translate('stats.charts.categoriesByTeam.axis', 'Categories'),
    empty: translate('stats.empty.noCategories', 'No category data available')
  };
  const overTimeChart = {
    title: translate('stats.charts.tasksOverTime.title', 'Tasks Over Time'),
    description: translate('stats.charts.tasksOverTime.description', 'Last 30 days of task creation across all teams'),
    axis: translate('stats.charts.tasksOverTime.axis', 'Tasks'),
    series: translate('stats.charts.tasksOverTime.series', 'Tasks Created')
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto p-4">
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{totalTeams}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {summaryLabels.total}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">
                  {activeTeams}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {summaryLabels.active}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {inactiveTeams}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {summaryLabels.inactive}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{avgCategoriesPerTeam}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {summaryLabels.avgCategories}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Donut chart: teams by status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{statusChart.title}</CardTitle>
            <CardDescription className="text-xs">
              {statusChart.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalTeams > 0 ? (
              <ReactECharts
                option={{
                  tooltip: {
                    trigger: "item",
                    formatter: "{b}: {c} ({d}%)"
                  },
                  legend: {
                    orient: "vertical",
                    left: "left",
                    textStyle: { fontSize: 11 }
                  },
                  series: [
                    {
                        name: statusChart.seriesName,
                      type: "pie",
                      radius: ["40%", "70%"],
                      avoidLabelOverlap: true,
                      itemStyle: {
                        borderRadius: 8,
                        borderColor: "#fff",
                        borderWidth: 2
                      },
                      label: {
                        show: true,
                        position: "inside",
                        formatter: "{b}",
                        fontSize: 11
                      },
                      labelLine: {
                        show: false
                      },
                      labelLayout: {
                        hideOverlap: true
                      },
                      emphasis: {
                        label: {
                          show: true,
                          fontSize: 12,
                          fontWeight: "bold"
                        }
                      },
                      data: [
                        {
                          value: activeTeams,
                            name: statusChart.legendActive,
                          itemStyle: { color: "#22c55e" }
                        },
                        {
                          value: inactiveTeams,
                            name: statusChart.legendInactive,
                          itemStyle: { color: "#9ca3af" }
                        }
                      ]
                    }
                  ]
                }}
                style={{ height: "260px" }}
              />
            ) : (
              <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
                  {statusChart.empty}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{tasksChart.title}</CardTitle>
              <CardDescription className="text-xs">
                {tasksChart.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tasksByTeam.length > 0 ? (
                <ReactECharts
                  option={{
                    tooltip: {
                      trigger: "axis",
                      axisPointer: { type: "shadow" }
                    },
                    grid: {
                      left: "3%",
                      right: "4%",
                      bottom: "3%",
                      containLabel: true
                    },
                    xAxis: {
                      type: "value",
                      name: tasksChart.axis
                    },
                    yAxis: {
                      type: "category",
                      data: tasksByTeam
                        .map((item) => item.team.name)
                        .reverse(),
                      axisLabel: {
                        formatter: (value: string) =>
                          value.length > 20
                            ? value.substring(0, 20) + "..."
                            : value
                      }
                    },
                    series: [
                      {
                        name: tasksChart.axis,
                        type: "bar",
                        data: tasksByTeam
                          .map((item) => ({
                            value: item.count,
                            itemStyle: {
                              color: item.team.color || "#3b82f6"
                            }
                          }))
                          .reverse()
                      }
                    ]
                  }}
                  style={{ height: "300px" }}
                />
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  {tasksChart.empty}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{categoriesChart.title}</CardTitle>
              <CardDescription className="text-xs">
                {categoriesChart.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {categoriesByTeam.length > 0 ? (
                <ReactECharts
                  option={{
                    tooltip: {
                      trigger: "axis",
                      axisPointer: { type: "shadow" }
                    },
                    grid: {
                      left: "3%",
                      right: "4%",
                      bottom: "3%",
                      containLabel: true
                    },
                    xAxis: {
                      type: "value",
                      name: categoriesChart.axis
                    },
                    yAxis: {
                      type: "category",
                      data: categoriesByTeam
                        .map((item) => item.team.name)
                        .reverse(),
                      axisLabel: {
                        formatter: (value: string) =>
                          value.length > 20
                            ? value.substring(0, 20) + "..."
                            : value
                      }
                    },
                    series: [
                      {
                        name: categoriesChart.axis,
                        type: "bar",
                        data: categoriesByTeam
                          .map((item) => ({
                            value: item.count,
                            itemStyle: {
                              color: item.team.color || "#8b5cf6"
                            }
                          }))
                          .reverse()
                      }
                    ]
                  }}
                  style={{ height: "300px" }}
                />
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  {categoriesChart.empty}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tasks over time */}
        {tasksOverTime.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{overTimeChart.title}</CardTitle>
              <CardDescription className="text-xs">
                {overTimeChart.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReactECharts
                option={{
                  tooltip: {
                    trigger: "axis",
                    formatter: (params: any) => {
                      const param = params[0];
                      return `${param.axisValue}<br/>${param.marker}${param.seriesName}: ${param.value}`;
                    }
                  },
                  grid: {
                    left: "3%",
                    right: "4%",
                    bottom: "3%",
                    containLabel: true
                  },
                  xAxis: {
                    type: "category",
                    data: tasksOverTime.map((item) =>
                      dayjs(item.date).format("MMM DD")
                    ),
                    axisLabel: {
                      rotate: 45,
                      fontSize: 10
                    }
                  },
                  yAxis: {
                    type: "value",
                    name: overTimeChart.axis
                  },
                  series: [
                    {
                        name: overTimeChart.series,
                      type: "line",
                      smooth: true,
                      data: tasksOverTime.map((item) => item.count),
                      areaStyle: {
                        color: {
                          type: "linear",
                          x: 0,
                          y: 0,
                          x2: 0,
                          y2: 1,
                          colorStops: [
                            {
                              offset: 0,
                              color: "rgba(139, 92, 246, 0.3)"
                            },
                            {
                              offset: 1,
                              color: "rgba(139, 92, 246, 0.05)"
                            }
                          ]
                        }
                      },
                      itemStyle: {
                        color: "#8b5cf6"
                      },
                      lineStyle: {
                        color: "#8b5cf6",
                        width: 2
                      }
                    }
                  ]
                }}
                style={{ height: "300px" }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
