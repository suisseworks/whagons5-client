import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartColumn, faChartLine, faChartPie, faChartArea } from "@fortawesome/free-solid-svg-icons";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Aggregation = 'count';
interface ReportValue { field: string; agg: Aggregation; }
type VizType = 'bar' | 'stacked_bar' | 'line' | 'table';
interface ReportDef {
  name: string;
  dataset: 'tasks_v1';
  kind: 'status_team_90d' | 'throughput_month_created';
  rows?: string[];
  columns?: string[];
  values?: ReportValue[];
  filters?: Array<{ field: string; op: string; value: any }>;
  viz?: { type: VizType };
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Unknown";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function lastNMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const di = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    keys.push(`${di.getUTCFullYear()}-${String(di.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function Analytics() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">Choose a report to explore</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card
            className="cursor-pointer transition-all duration-200 group select-none hover:shadow-lg hover:scale-[1.02] h-[160px] overflow-hidden"
            onClick={() => { alert('Tasks by Status × Team coming soon'); }}
          >
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-3xl text-blue-500 group-hover:scale-110 transition-transform duration-200">
                  <FontAwesomeIcon icon={faChartColumn} />
                </div>
              </div>
              <div className="space-y-1">
                <CardTitle className="text-lg">Tasks by Status × Team</CardTitle>
                <CardDescription>Stacked bar, last 90 days</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card
            className="cursor-pointer transition-all duration-200 group select-none hover:shadow-lg hover:scale-[1.02] h-[160px] overflow-hidden"
            onClick={() => { alert('Throughput by Month coming soon'); }}
          >
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-3xl text-emerald-500 group-hover:scale-110 transition-transform duration-200">
                  <FontAwesomeIcon icon={faChartLine} />
                </div>
              </div>
              <div className="space-y-1">
                <CardTitle className="text-lg">Throughput by Month</CardTitle>
                <CardDescription>Line chart, last 12 months</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card
            className="cursor-pointer transition-all duration-200 group select-none hover:shadow-lg hover:scale-[1.02] h-[160px] overflow-hidden"
            onClick={() => { alert('Assignee Workload coming soon'); }}
          >
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-3xl text-purple-500 group-hover:scale-110 transition-transform duration-200">
                  <FontAwesomeIcon icon={faChartPie} />
                </div>
              </div>
              <div className="space-y-1">
                <CardTitle className="text-lg">Assignee Workload</CardTitle>
                <CardDescription>Distribution across users</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card
            className="cursor-pointer transition-all duration-200 group select-none hover:shadow-lg hover:scale-[1.02] h-[160px] overflow-hidden"
            onClick={() => { alert('Aging by Status coming soon'); }}
          >
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-3xl text-amber-500 group-hover:scale-110 transition-transform duration-200">
                  <FontAwesomeIcon icon={faChartArea} />
                </div>
              </div>
              <div className="space-y-1">
                <CardTitle className="text-lg">Aging by Status</CardTitle>
                <CardDescription>Time-in-status breakdown</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Analytics;
