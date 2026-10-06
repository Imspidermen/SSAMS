import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartDataTable, ChartTooltipCard } from './ChartTooltip';
import { useChartTheme } from './useChartTheme';
import { EmptyState } from '@/components/ui/StateBlock';
import { attendanceTone } from '@/utils/attendance';
import { formatPercent } from '@/utils/format';

export interface SubjectBar {
  label: string;
  code?: string;
  percentage: number;
  present?: number;
  total?: number;
}

export interface SubjectAttendanceChartProps {
  data: SubjectBar[];
  threshold: number;
  height?: number;
  layout?: 'vertical' | 'horizontal';
}

/**
 * Subject-wise attendance bars, coloured against the configured threshold.
 * Every bar is labelled with its percentage so colour is never the only cue.
 */
export function SubjectAttendanceChart({
  data,
  threshold,
  height = 260,
  layout = 'vertical',
}: SubjectAttendanceChartProps) {
  const theme = useChartTheme();

  if (data.length === 0) {
    return (
      <EmptyState
        title="No subjects to chart"
        message="Subject-wise attendance appears here once you are enrolled in subjects with recorded sessions."
      />
    );
  }

  const colorFor = (percentage: number) => {
    const tone = attendanceTone(percentage, threshold);
    if (tone === 'success') return theme.present;
    if (tone === 'warning') return theme.late;
    return theme.absent;
  };

  const isVerticalBars = layout === 'vertical';

  return (
    <>
      <div
        className="chart-frame"
        style={{ height }}
        role="img"
        aria-label="Subject-wise attendance percentages"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={isVerticalBars ? 'horizontal' : 'vertical'}
            margin={{ top: 8, right: 16, bottom: 4, left: isVerticalBars ? -18 : 8 }}
            barCategoryGap={isVerticalBars ? '28%' : '22%'}
          >
            <CartesianGrid
              stroke={theme.grid}
              strokeDasharray="3 3"
              vertical={isVerticalBars}
              horizontal={!isVerticalBars}
            />
            {isVerticalBars ? (
              <>
                <XAxis
                  dataKey="label"
                  tick={{ fill: theme.axis, fontSize: 11 }}
                  axisLine={{ stroke: theme.grid }}
                  tickLine={false}
                  interval={0}
                  angle={data.length > 5 ? -18 : 0}
                  textAnchor={data.length > 5 ? 'end' : 'middle'}
                  height={data.length > 5 ? 54 : 30}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(value: number) => `${value}%`}
                  tick={{ fill: theme.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
              </>
            ) : (
              <>
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(value: number) => `${value}%`}
                  tick={{ fill: theme.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fill: theme.axis, fontSize: 11 }}
                  axisLine={{ stroke: theme.grid }}
                  tickLine={false}
                  width={128}
                />
              </>
            )}
            <Tooltip
              cursor={{ fill: theme.grid, opacity: 0.35 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const entry = payload[0].payload as SubjectBar;
                return (
                  <ChartTooltipCard
                    title={entry.code ? `${entry.label} (${entry.code})` : entry.label}
                    rows={[
                      {
                        label: 'Attendance',
                        value: formatPercent(entry.percentage),
                        color: colorFor(entry.percentage),
                      },
                      ...(entry.present !== undefined && entry.total !== undefined
                        ? [{ label: 'Present / Total', value: `${entry.present} / ${entry.total}` }]
                        : []),
                      { label: 'Required', value: formatPercent(threshold, 0) },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey="percentage"
              radius={isVerticalBars ? [4, 4, 0, 0] : [0, 4, 4, 0]}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell key={entry.label} fill={colorFor(entry.percentage)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ChartDataTable
        caption="Subject-wise attendance"
        columns={['Subject', 'Attendance', 'Present', 'Total']}
        rows={data.map((entry) => [
          entry.code ? `${entry.label} (${entry.code})` : entry.label,
          formatPercent(entry.percentage),
          entry.present ?? '-',
          entry.total ?? '-',
        ])}
      />
    </>
  );
}
