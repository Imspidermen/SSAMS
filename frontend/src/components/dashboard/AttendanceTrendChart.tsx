import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartDataTable, ChartTooltipCard } from './ChartTooltip';
import { useChartTheme } from './useChartTheme';
import { EmptyState } from '@/components/ui/StateBlock';
import { formatDate, formatPercent } from '@/utils/format';

export interface TrendPoint {
  date: string;
  percentage: number;
  present: number;
  total: number;
}

export interface AttendanceTrendChartProps {
  data: TrendPoint[];
  /** Policy minimum, drawn as a reference line. */
  threshold?: number;
  height?: number;
}

/** Daily attendance percentage over time, with the policy threshold marked. */
export function AttendanceTrendChart({ data, threshold, height = 272 }: AttendanceTrendChartProps) {
  const theme = useChartTheme();

  if (data.length === 0) {
    return (
      <EmptyState
        title="No attendance data in this period"
        message="Once sessions are recorded, the daily attendance trend will appear here."
      />
    );
  }

  return (
    <>
      <div
        className="chart-frame"
        style={{ height }}
        role="img"
        aria-label="Daily attendance percentage trend"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.primary} stopOpacity={0.28} />
                <stop offset="100%" stopColor={theme.primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => formatDate(value).slice(0, 6)}
              tick={{ fill: theme.axis, fontSize: 11 }}
              axisLine={{ stroke: theme.grid }}
              tickLine={false}
              minTickGap={18}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(value: number) => `${value}%`}
              tick={{ fill: theme.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              cursor={{ stroke: theme.axis, strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as TrendPoint;
                return (
                  <ChartTooltipCard
                    title={formatDate(point.date)}
                    rows={[
                      {
                        label: 'Attendance',
                        value: formatPercent(point.percentage),
                        color: theme.primary,
                      },
                      { label: 'Present', value: point.present },
                      { label: 'Records', value: point.total },
                    ]}
                  />
                );
              }}
            />
            {threshold !== undefined ? (
              <ReferenceLine
                y={threshold}
                stroke={theme.absent}
                strokeDasharray="4 4"
                label={{
                  value: `Minimum ${threshold}%`,
                  position: 'insideTopRight',
                  fill: theme.axis,
                  fontSize: 11,
                }}
              />
            ) : null}
            <Area
              type="monotone"
              dataKey="percentage"
              stroke={theme.primary}
              strokeWidth={2}
              fill="url(#trendFill)"
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <ChartDataTable
        caption="Daily attendance percentages"
        columns={['Date', 'Attendance', 'Present', 'Total']}
        rows={data.map((point) => [
          formatDate(point.date),
          formatPercent(point.percentage),
          point.present,
          point.total,
        ])}
      />
    </>
  );
}
