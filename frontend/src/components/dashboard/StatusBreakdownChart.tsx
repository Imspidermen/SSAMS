import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartDataTable, ChartLegend, ChartTooltipCard } from './ChartTooltip';
import { useChartTheme } from './useChartTheme';
import { EmptyState } from '@/components/ui/StateBlock';
import { formatPercent } from '@/utils/format';
import type { AttendanceStatus } from '@/types';

export interface StatusBreakdownChartProps {
  counts: Record<AttendanceStatus, number>;
  height?: number;
}

/** Present / Late / Absent / Excused distribution with a legend that states counts. */
export function StatusBreakdownChart({ counts, height = 240 }: StatusBreakdownChartProps) {
  const theme = useChartTheme();

  const data = [
    { status: 'PRESENT' as const, label: 'Present', value: counts.PRESENT, color: theme.present },
    { status: 'LATE' as const, label: 'Late', value: counts.LATE, color: theme.late },
    { status: 'ABSENT' as const, label: 'Absent', value: counts.ABSENT, color: theme.absent },
    { status: 'EXCUSED' as const, label: 'Excused', value: counts.EXCUSED, color: theme.excused },
  ].filter((entry) => entry.value > 0);

  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  if (total === 0) {
    return (
      <EmptyState
        title="No attendance recorded yet"
        message="Status distribution appears here once attendance has been marked."
      />
    );
  }

  return (
    <>
      <div
        className="chart-frame chart-frame--sm"
        style={{ height }}
        role="img"
        aria-label="Attendance status distribution"
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="58%"
              outerRadius="86%"
              paddingAngle={2}
              stroke={theme.surface}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell key={entry.status} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const entry = payload[0].payload as (typeof data)[number];
                return (
                  <ChartTooltipCard
                    title={entry.label}
                    rows={[
                      { label: 'Records', value: entry.value, color: entry.color },
                      { label: 'Share', value: formatPercent((entry.value / total) * 100) },
                    ]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ChartLegend
        items={data.map((entry) => ({
          label: entry.label,
          color: entry.color,
          value: `${entry.value} (${formatPercent((entry.value / total) * 100, 0)})`,
        }))}
      />

      <ChartDataTable
        caption="Attendance status distribution"
        columns={['Status', 'Records', 'Share']}
        rows={data.map((entry) => [
          entry.label,
          entry.value,
          formatPercent((entry.value / total) * 100),
        ])}
      />
    </>
  );
}
