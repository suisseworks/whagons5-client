import ReactECharts from 'echarts-for-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import dayjs from 'dayjs';

interface LineChartDataPoint {
  date: string;
  count: number;
}

interface LineChartProps {
  title: string;
  description?: string;
  data: LineChartDataPoint[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  height?: string;
  dateFormat?: string;
  translate?: (key: string, fallback: string) => string;
}

export const LineChart = ({
  title,
  description,
  data,
  xAxisLabel,
  yAxisLabel,
  height = '300px',
  dateFormat = 'MMM DD',
  translate
}: LineChartProps) => {
  const tt = translate || ((key: string, fallback: string) => fallback);

  if (data.length === 0) {
    return null;
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
              formatter: (params: any) => {
                const param = params[0];
                return `${param.axisValue}<br/>${param.marker}${param.seriesName}: ${param.value}`;
              }
            },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: {
              type: 'category',
              data: data.map(item => dayjs(item.date).format(dateFormat)),
              axisLabel: {
                rotate: 45,
                fontSize: 10
              }
            },
            yAxis: {
              type: 'value',
              name: yAxisLabel
            },
            series: [{
              name: yAxisLabel || 'Count',
              type: 'line',
              smooth: true,
              data: data.map(item => item.count),
              areaStyle: {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                    { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
                  ]
                }
              },
              itemStyle: {
                color: '#3b82f6'
              },
              lineStyle: {
                color: '#3b82f6',
                width: 2
              }
            }]
          }}
          style={{ height }}
        />
      </CardContent>
    </Card>
  );
};
