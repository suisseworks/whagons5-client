import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Invitation, Team, UserTeam } from "@/store/types";
import type { TranslateFn, UserData } from "../types";

export function UserStatistics({
  users,
  teams,
  userTeams,
  jobPositions,
  invitations,
  translate,
}: {
  users: UserData[];
  teams: Team[];
  userTeams: UserTeam[];
  jobPositions: any[];
  invitations: Invitation[];
  translate: TranslateFn;
}) {
  const totalUsers = users.length;
  const adminCount = users.filter((u) => Boolean(u.is_admin)).length;
  const subscriptionCount = users.filter((u) => Boolean(u.has_active_subscription)).length;
  const activeSubPercent = totalUsers > 0 ? Math.round((subscriptionCount / totalUsers) * 100) : 0;

  const usersByTeam = useMemo(() => {
    const counts = new Map<number, number>();
    userTeams.forEach((ut) => {
      counts.set(ut.team_id, (counts.get(ut.team_id) || 0) + 1);
    });

    return teams
      .map((team) => ({ team, count: counts.get(team.id) || 0 }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [teams, userTeams]);

  const usersByJobPosition = useMemo(() => {
    const counts = new Map<number, number>();
    users.forEach((u) => {
      if (u.job_position_id != null) {
        const id = Number(u.job_position_id);
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    });

    return (jobPositions || [])
      .map((jp: any) => ({ jobPosition: jp, count: counts.get(Number(jp.id)) || 0 }))
      .filter((item: any) => item.count > 0)
      .sort((a: any, b: any) => b.count - a.count);
  }, [jobPositions, users]);

  const invitationsOverTime = useMemo(() => {
    const byDay = new Map<string, number>();
    invitations.forEach((inv) => {
      if (!inv.created_at) return;
      const dayKey = dayjs(inv.created_at).format("YYYY-MM-DD");
      byDay.set(dayKey, (byDay.get(dayKey) || 0) + 1);
    });

    const days = Array.from(byDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // keep last 30 days (if larger)
    return days.slice(-30);
  }, [invitations]);

  const summaryLabels = {
    total: translate("stats.summary.totalUsers", "Total users"),
    admins: translate("stats.summary.admins", "Admins"),
    subscriptions: translate("stats.summary.subscriptions", "Active subscriptions"),
    invitations: translate("stats.summary.invitations", "Invitations"),
  };

  const charts = {
    usersPerTeamTitle: translate("stats.charts.usersPerTeam.title", "Users per Team"),
    usersPerTeamDescription: translate("stats.charts.usersPerTeam.description", "Distribution of users across teams"),
    usersPerTeamAxis: translate("stats.charts.usersPerTeam.axis", "Users"),
    usersByJobTitle: translate("stats.charts.usersByJob.title", "Users by Job Position"),
    usersByJobDescription: translate("stats.charts.usersByJob.description", "Distribution across job positions"),
    usersByJobSeries: translate("stats.charts.usersByJob.series", "Users"),
    invitationsOverTimeTitle: translate("stats.charts.invitationsOverTime.title", "Invitations Over Time"),
    invitationsOverTimeDescription: translate("stats.charts.invitationsOverTime.description", "Last 30 days of invitation creation"),
    invitationsAxis: translate("stats.charts.invitationsOverTime.axis", "Invitations"),
  };

  const emptyStates = {
    noTeamAssignments: translate("stats.empty.noTeamAssignments", "No team assignment data available"),
    noJobPositions: translate("stats.empty.noJobPositions", "No job position data available"),
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto p-4">
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{totalUsers}</div>
                <div className="text-xs text-muted-foreground mt-1">{summaryLabels.total}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">{adminCount}</div>
                <div className="text-xs text-muted-foreground mt-1">{summaryLabels.admins}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">{activeSubPercent}%</div>
                <div className="text-xs text-muted-foreground mt-1">{summaryLabels.subscriptions}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-sky-600">{invitations.length}</div>
                <div className="text-xs text-muted-foreground mt-1">{summaryLabels.invitations}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{charts.usersPerTeamTitle}</CardTitle>
              <CardDescription className="text-xs">{charts.usersPerTeamDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {usersByTeam.length > 0 ? (
                <ReactECharts
                  option={{
                    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
                    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
                    xAxis: { type: "value", name: charts.usersPerTeamAxis },
                    yAxis: {
                      type: "category",
                      data: usersByTeam.map((item) => item.team.name).reverse(),
                      axisLabel: {
                        formatter: (value: string) =>
                          value.length > 20 ? value.substring(0, 20) + "..." : value,
                      },
                    },
                    series: [
                      {
                        name: charts.usersPerTeamAxis,
                        type: "bar",
                        data: usersByTeam
                          .map((item) => ({
                            value: item.count,
                            itemStyle: { color: item.team.color || "#6366f1" },
                          }))
                          .reverse(),
                      },
                    ],
                  }}
                  style={{ height: "300px" }}
                />
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  {emptyStates.noTeamAssignments}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{charts.usersByJobTitle}</CardTitle>
              <CardDescription className="text-xs">{charts.usersByJobDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {usersByJobPosition.length > 0 ? (
                <ReactECharts
                  option={{
                    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
                    legend: { orient: "vertical", left: "left", textStyle: { fontSize: 10 } },
                    series: [
                      {
                        name: charts.usersByJobSeries,
                        type: "pie",
                        radius: ["40%", "70%"],
                        avoidLabelOverlap: false,
                        itemStyle: { borderRadius: 8, borderColor: "#fff", borderWidth: 2 },
                        label: { show: true, formatter: "{b}: {c}" },
                        emphasis: { label: { show: true, fontSize: 12, fontWeight: "bold" } },
                        data: usersByJobPosition.map((item: any) => ({
                          value: item.count,
                          name: item.jobPosition.title,
                        })),
                      },
                    ],
                  }}
                  style={{ height: "300px" }}
                />
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  {emptyStates.noJobPositions}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Invitations over time */}
        {invitationsOverTime.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{charts.invitationsOverTimeTitle}</CardTitle>
              <CardDescription className="text-xs">{charts.invitationsOverTimeDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <ReactECharts
                option={{
                  tooltip: {
                    trigger: "axis",
                    formatter: (params: any) => {
                      const param = params[0];
                      return `${param.axisValue}<br/>${param.marker}${param.seriesName}: ${param.value}`;
                    },
                  },
                  grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
                  xAxis: {
                    type: "category",
                    data: invitationsOverTime.map((item) => dayjs(item.date).format("MMM DD")),
                  },
                  yAxis: { type: "value", name: charts.invitationsAxis },
                  series: [
                    {
                      name: charts.invitationsAxis,
                      type: "line",
                      smooth: true,
                      data: invitationsOverTime.map((item) => item.count),
                      areaStyle: { opacity: 0.15 },
                      itemStyle: { color: "#6366f1" },
                    },
                  ],
                }}
                style={{ height: "240px" }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

