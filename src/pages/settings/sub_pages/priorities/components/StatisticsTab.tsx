import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ReactECharts from "echarts-for-react";

type PrioritiesByCategoryItem = {
  category: { name: string; color?: string | null };
  count: number;
};

export function StatisticsTab({
  globalCount,
  categoryCount,
  totalCount,
  prioritiesByCategory,
}: {
  globalCount: number;
  categoryCount: number;
  totalCount: number;
  prioritiesByCategory: PrioritiesByCategoryItem[];
}) {
  return (
    <div className="flex-1 min-h-0 overflow-auto p-4">
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{globalCount}</div>
                <div className="text-xs text-muted-foreground mt-1">Global Priorities</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">{categoryCount}</div>
                <div className="text-xs text-muted-foreground mt-1">Category Priorities</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{totalCount}</div>
                <div className="text-xs text-muted-foreground mt-1">Total Priorities</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Global vs Category Priorities</CardTitle>
              <CardDescription className="text-xs">Distribution of priority types</CardDescription>
            </CardHeader>
            <CardContent>
              {totalCount > 0 ? (
                <ReactECharts
                  option={{
                    tooltip: {
                      trigger: "item",
                      formatter: "{b}: {c} ({d}%)",
                    },
                    legend: {
                      orient: "vertical",
                      left: "left",
                      textStyle: { fontSize: 11 },
                    },
                    series: [
                      {
                        name: "Priorities",
                        type: "pie",
                        radius: ["40%", "70%"],
                        avoidLabelOverlap: false,
                        itemStyle: {
                          borderRadius: 8,
                          borderColor: "#fff",
                          borderWidth: 2,
                        },
                        label: {
                          show: true,
                          formatter: "{b}: {c}",
                        },
                        emphasis: {
                          label: {
                            show: true,
                            fontSize: 14,
                            fontWeight: "bold",
                          },
                        },
                        data: [
                          {
                            value: globalCount,
                            name: "Global",
                            itemStyle: { color: "#ef4444" },
                          },
                          {
                            value: categoryCount,
                            name: "Category",
                            itemStyle: { color: "#3b82f6" },
                          },
                        ],
                      },
                    ],
                  }}
                  style={{ height: "300px" }}
                />
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  No priority data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Priorities per Category</CardTitle>
              <CardDescription className="text-xs">How many priorities each category defines</CardDescription>
            </CardHeader>
            <CardContent>
              {prioritiesByCategory.length > 0 ? (
                <ReactECharts
                  option={{
                    tooltip: {
                      trigger: "axis",
                      axisPointer: { type: "shadow" },
                    },
                    grid: {
                      left: "3%",
                      right: "4%",
                      bottom: "3%",
                      containLabel: true,
                    },
                    xAxis: {
                      type: "value",
                      name: "Priorities",
                    },
                    yAxis: {
                      type: "category",
                      data: prioritiesByCategory.map((item) => item.category.name).reverse(),
                      axisLabel: {
                        formatter: (value: string) =>
                          value.length > 20 ? value.substring(0, 20) + "..." : value,
                      },
                    },
                    series: [
                      {
                        name: "Priorities",
                        type: "bar",
                        data: prioritiesByCategory
                          .map((item) => ({
                            value: item.count,
                            itemStyle: { color: item.category.color || "#6b7280" },
                          }))
                          .reverse(),
                      },
                    ],
                  }}
                  style={{ height: "300px" }}
                />
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  No category data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

