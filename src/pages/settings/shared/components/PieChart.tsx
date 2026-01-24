import ReactECharts from 'echarts-for-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PieChartData {
  name: string;
  value: number;
}

interface PieChartProps {
  title: string;
  description?: string;
  data: PieChartData[];
  height?: string;
  translate?: (key: string, fallback: string) => string;
}

export const PieChart = ({
  title,
  description,
  data,
  height = '300px',
  translate
}: PieChartProps) => {
  const tt = translate || ((key: string, fallback: string) => fallback);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
          {description && <CardDescription className="text-xs">{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
            {tt('stats.empty', 'No data available')}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ReactECharts
          option={{
            tooltip: {
              trigger: 'item',
              formatter: '{b}: {c} ({d}%)'
            },
            legend: {
              orient: 'vertical',
              left: 'left',
              textStyle: { fontSize: 11 }
            },
            series: [{
              name: title,
              type: 'pie',
              radius: ['40%', '70%'],
              avoidLabelOverlap: false,
              itemStyle: {
                borderRadius: 8,
                borderColor: '#fff',
                borderWidth: 2
              },
              label: {
                show: true,
                formatter: '{b}: {c}'
              },
              emphasis: {
                label: {
                  show: true,
                  fontSize: 14,
                  fontWeight: 'bold'
                }
              },
              data: data.map(item => ({
                value: item.value,
                name: item.name
              }))
            }]
          }}
          style={{ height }}
        />
      </CardContent>
    </Card>
  );
};
