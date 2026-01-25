import { Category } from "@/store/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";
import { useCategoryStatistics } from "../hooks/useCategoryStatistics";

interface StatisticsTabProps {
  categories: Category[];
  tasks: any[];
  teams: any[];
  translate: (key: string, fallback: string) => string;
}

export const StatisticsTab = ({ categories, tasks, teams, translate: tc }: StatisticsTabProps) => {
  const {
    enabledCategoriesCount,
    disabledCategoriesCount,
    tasksByCategory,
    categoriesByTeam,
    tasksOverTime
  } = useCategoryStatistics({ categories, tasks, teams });

  return (
    <div className="flex-1 min-h-0 overflow-auto p-4">
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{categories.length}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {tc('stats.cards.total', 'Total Categories')}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {enabledCategoriesCount}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {tc('stats.cards.enabled', 'Enabled Categories')}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {disabledCategoriesCount}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {tc('stats.cards.disabled', 'Disabled Categories')}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {tc('stats.charts.tasksByCategory.title', 'Tasks by Category')}
              </CardTitle>
              <CardDescription className="text-xs">
                {tc('stats.charts.tasksByCategory.description', 'Distribution of tasks across categories')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tasksByCategory.length > 0 ? (
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
                        name: tc('stats.charts.tasksByCategory.series', 'Tasks'),
                        type: "pie",
                        radius: ["40%", "70%"],
                        avoidLabelOverlap: false,
                        itemStyle: {
                          borderRadius: 8,
                          borderColor: "#fff",
                          borderWidth: 2
                        },
                        label: {
                          show: true,
                          formatter: "{b}: {c}"
                        },
                        emphasis: {
                          label: {
                            show: true,
                            fontSize: 14,
                            fontWeight: "bold"
                          }
                        },
                        data: tasksByCategory.map((item) => ({
                          value: item.count,
                          name: item.category.name,
                          itemStyle: {
                            color: item.category.color || "#6b7280"
                          }
                        }))
                      }
                    ]
                  }}
                  style={{ height: "300px" }}
                />
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  {tc('stats.charts.tasksByCategory.empty', 'No task data available')}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {tc('stats.charts.categoriesByTeam.title', 'Categories by Team')}
              </CardTitle>
              <CardDescription className="text-xs">
                {tc('stats.charts.categoriesByTeam.description', 'How categories are distributed across teams')}
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
                      name: tc('stats.charts.categoriesByTeam.axis', 'Categories')
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
                        name: tc('stats.charts.categoriesByTeam.axis', 'Categories'),
                        type: "bar",
                        data: categoriesByTeam
                          .map((item) => ({
                            value: item.count,
                            itemStyle: {
                              color:
                                item.team.color || "#3b82f6"
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
                  {tc('stats.charts.categoriesByTeam.empty', 'No team data available')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tasks over time */}
        {tasksOverTime.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {tc('stats.charts.tasksOverTime.title', 'Tasks Over Time')}
              </CardTitle>
              <CardDescription className="text-xs">
                {tc('stats.charts.tasksOverTime.description', 'Last 30 days of task creation across categories')}
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
                    name: tc('stats.charts.tasksOverTime.axis', 'Tasks')
                  },
                  series: [
                    {
                      name: tc('stats.charts.tasksOverTime.series', 'Tasks Created'),
                      type: "line",
                      smooth: true,
                      data: tasksOverTime.map(
                        (item) => item.count
                      ),
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
                              color:
                                "rgba(59, 130, 246, 0.3)"
                            },
                            {
                              offset: 1,
                              color:
                                "rgba(59, 130, 246, 0.05)"
                            }
                          ]
                        }
                      },
                      itemStyle: {
                        color: "#3b82f6"
                      },
                      lineStyle: {
                        color: "#3b82f6",
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
};
