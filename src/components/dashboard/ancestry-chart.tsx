'use client';

import * as React from 'react';
import { Label, Pie, PieChart, Tooltip, Legend, Cell } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

const chartColors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    'hsl(180, 50%, 50%)',
    'hsl(300, 50%, 50%)',
    'hsl(60, 50%, 50%)',
];

const parseAncestryData = (dataString: string) => {
  const regex = /(\d+(?:\.\d+)?)%\s*([\w\s-]+)/g;
  let match;
  const results = [];
  while ((match = regex.exec(dataString)) !== null) {
    results.push({
      region: match[2].trim(),
      value: parseFloat(match[1]),
    });
  }
  return results;
};

type AncestryChartProps = {
  data: string;
};

export function AncestryChart({ data }: AncestryChartProps) {
  const chartData = React.useMemo(() => parseAncestryData(data), [data]);
  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {};
    chartData.forEach((item, index) => {
      config[item.region] = {
        label: item.region,
        color: chartColors[index % chartColors.length],
      };
    });
    return config;
  }, [chartData]);

  const totalValue = React.useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.value, 0);
  }, [chartData]);
  
  if (chartData.length === 0) {
    return <p className="text-muted-foreground">Could not parse ancestry data. The format may be incorrect.</p>;
  }

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-center">
      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square max-h-[400px]"
      >
        <PieChart>
          <Tooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel nameKey="region" />}
          />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="region"
            innerRadius="60%"
            strokeWidth={5}
            activeIndex={0}
            activeShape={({ outerRadius = 0, ...props }) => (
                <g>
                    <props.payload.region />
                    <circle cx={props.cx} cy={props.cy} r={outerRadius + 10} fill={props.fill} />
                </g>
            )}
          >
             {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
            ))}
            <Label
              content={({ viewBox }) => {
                if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-foreground text-3xl font-bold font-headline"
                      >
                        {totalValue.toFixed(0)}%
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy || 0) + 24}
                        className="fill-muted-foreground"
                      >
                        Total
                      </tspan>
                    </text>
                  );
                }
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>

      <div className="space-y-4">
        <h3 className="font-headline text-xl font-semibold text-primary">Breakdown</h3>
        <Separator />
        <div className="grid gap-3 text-sm">
          {chartData.map((item) => (
            <div key={item.region} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: chartConfig[item.region]?.color }}
                />
                <span>{item.region}</span>
              </div>
              <span className="font-medium">{item.value.toFixed(2)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
