import ReactECharts from 'echarts-for-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface BarChartData {
  name: string;
  value: number;
}

interface BarChartProps {
  title: string;
  description?: string;
  data: BarChartData[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  height?: string;
  maxLabelLength?: number;
  translate?: (key: string, fallback: string) => string;
}

export const BarChart = ({
  title,
  description,
  data,
  xAxisLabel,
  yAxisLabel,
  height = '300px',
  maxLabelLength = 20,
  translate
}: BarChartProps) => {
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
              trigger: 'axis',
              axisPointer: { type: 'shadow' }
            },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: {
              type: 'value',
              name: xAxisLabel
            },
            yAxis: {
              type: 'category',
              data: data.map(item => item.name).reverse(),
              axisLabel: {
                formatter: (value: string) => 
                  value.length > maxLabelLength ? value.substring(0, maxLabelLength) + '...' : value
              }
            },
            series: [{
              name: yAxisLabel || 'Value',
              type: 'bar',
              data: data.map(item => item.value).reverse(),
              itemStyle: {
                color: '#3b82f6'
              }
            }]
          }}
          style={{ height }}
        />
      </CardContent>
    </Card>
  );
};
