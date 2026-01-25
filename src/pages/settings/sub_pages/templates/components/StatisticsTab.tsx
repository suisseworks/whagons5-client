import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faExclamationTriangle, faCheckCircle, faClock } from "@fortawesome/free-solid-svg-icons";
import { TemplateStatistics } from "@/pages/settings/sub_pages/templates/types";
import { StatisticsCards, BarChart, PieChart, LineChart } from "../../../shared/components";
import dayjs from "dayjs";
import { Task, Template } from "@/store/types";
import { Badge } from "@/components/ui/badge";

interface StatisticsTabProps {
  statistics: TemplateStatistics | null;
  statsLoading: boolean;
  templates: Template[];
  tasks: Task[];
  getTemplateTaskCount: (templateId: number) => number;
  translate: (key: string, fallback: string) => string;
}

export const StatisticsTab = ({
  statistics,
  statsLoading,
  templates,
  tasks,
  getTemplateTaskCount,
  translate: tt
}: StatisticsTabProps) => {
  if (statsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-muted-foreground animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">{tt('stats.calculating', 'Calculating statistics...')}</p>
      </div>
    );
  }

  if (!statistics) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <p className="text-sm text-muted-foreground">{tt('stats.clickToLoad', 'Click the Statistics tab to load statistics')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <StatisticsCards
        cards={[
          {
            value: statistics.totalTemplates,
            label: tt('stats.totalTemplates', 'Total Templates')
          },
          {
            value: statistics.urgentTasksCount,
            label: tt('stats.urgentTasks', 'Urgent Tasks'),
            icon: faExclamationTriangle,
            valueColor: '#dc2626'
          },
          {
            value: statistics.tasksWithApprovalsCount,
            label: tt('stats.withApprovals', 'With Approvals'),
            icon: faCheckCircle,
            valueColor: '#2563eb'
          },
          {
            value: statistics.latestTasks.length,
            label: tt('stats.recentTasks', 'Recent Tasks'),
            icon: faClock,
            valueColor: '#16a34a'
          }
        ]}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarChart
          title={tt('stats.mostUsed.title', 'Most Used Templates')}
          description={tt('stats.mostUsed.description', 'Top templates by task count')}
          data={statistics.mostUsedTemplates.map(item => ({
            name: item.template.name,
            value: item.count
          }))}
          xAxisLabel={tt('stats.mostUsed.tasks', 'Tasks')}
          yAxisLabel={tt('stats.mostUsed.tasksCreated', 'Tasks Created')}
          translate={tt}
        />

        <PieChart
          title={tt('stats.byCategory.title', 'Templates by Category')}
          description={tt('stats.byCategory.description', 'Distribution across categories')}
          data={statistics.templatesByCategory.map(item => ({
            name: item.category.name,
            value: item.count
          }))}
          translate={tt}
        />
      </div>

      {/* Tasks Over Time Chart */}
      {statistics.tasksOverTime.length > 0 && (
        <LineChart
          title={tt('stats.overTime.title', 'Tasks Created Over Time')}
          description={tt('stats.overTime.description', 'Last 30 days of template-based task creation')}
          data={statistics.tasksOverTime}
          yAxisLabel={tt('stats.overTime.tasks', 'Tasks')}
          translate={tt}
        />
      )}

      {/* Latest Tasks List */}
      {statistics.latestTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{tt('stats.latest.title', 'Latest Tasks from Templates')}</CardTitle>
            <CardDescription className="text-xs">{tt('stats.latest.description', 'Most recently created tasks using templates')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {statistics.latestTasks.map((task: Task) => {
                const template = templates.find((t: Template) => t.id === task.template_id);
                return (
                  <div key={task.id} className="flex items-center justify-between p-2 border rounded-md hover:bg-accent/50">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{task.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {tt('stats.latest.template', 'Template')}: {template?.name || 'Unknown'} • {dayjs(task.created_at).format('MMM DD, YYYY HH:mm')}
                      </div>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {getTemplateTaskCount(task.template_id || 0)} {tt('stats.latest.total', 'total')}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-xl font-semibold">{statistics.withDefaultSpot}</div>
              <div className="text-xs text-muted-foreground mt-1">{tt('stats.withDefaultSpot', 'With Default Spot')}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-xl font-semibold">{statistics.withDefaultUsers}</div>
              <div className="text-xs text-muted-foreground mt-1">{tt('stats.withDefaultUsers', 'With Default Users')}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-xl font-semibold">{statistics.withExpectedDuration}</div>
              <div className="text-xs text-muted-foreground mt-1">{tt('stats.withExpectedDuration', 'With Expected Duration')}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
