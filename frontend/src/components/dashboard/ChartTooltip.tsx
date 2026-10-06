import type { ReactNode } from 'react';

export interface ChartTooltipRow {
  label: string;
  value: ReactNode;
  color?: string;
}

/** Shared Recharts tooltip body - themed by design tokens, not hard-coded. */
export function ChartTooltipCard({ title, rows }: { title?: ReactNode; rows: ChartTooltipRow[] }) {
  return (
    <div className="chart-tooltip">
      {title ? <p className="chart-tooltip__label">{title}</p> : null}
      {rows.map((row) => (
        <p className="chart-tooltip__row" key={row.label}>
          {row.color ? (
            <span className="chart-tooltip__swatch" style={{ background: row.color }} />
          ) : null}
          <span>{row.label}</span>
          <strong style={{ marginLeft: 'auto', color: 'var(--text-primary)' }}>{row.value}</strong>
        </p>
      ))}
    </div>
  );
}

export interface ChartLegendItem {
  label: string;
  color: string;
  value?: ReactNode;
}

/** Legend rendered as real text - colour is never the only cue. */
export function ChartLegend({ items }: { items: ChartLegendItem[] }) {
  return (
    <div className="chart-legend">
      {items.map((item) => (
        <span className="chart-legend__item" key={item.label}>
          <span
            className="chart-legend__swatch"
            style={{ background: item.color }}
            aria-hidden="true"
          />
          {item.label}
          {item.value !== undefined ? <strong>: {item.value}</strong> : null}
        </span>
      ))}
    </div>
  );
}

/**
 * Accessible fallback for charts: screen readers and no-JS/print contexts get
 * the same numbers as a table.
 */
export function ChartDataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            // Row identity is the full row content; index keeps keys stable.
            <tr key={`${row[0]}-${index}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
