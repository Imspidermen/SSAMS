import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { SkeletonTableRows } from './Skeleton';
import { EmptyState, ErrorState } from './StateBlock';
import { useIsCompact, useIsMobile } from '@/hooks/useMediaQuery';
import { cn } from '@/utils/cn';

export type SortDirection = 'asc' | 'desc';

export interface DataTableColumn<Row> {
  id: string;
  header: ReactNode;
  cell: (row: Row, index: number) => ReactNode;
  /** Extra class applied to both the header and body cells. */
  className?: string;
  align?: 'left' | 'right' | 'center';
  /** Hide this column below the given breakpoint (mobile tables get crowded). */
  hideOn?: 'mobile' | 'tablet';
  sortable?: boolean;
}

export interface DataTableSortState {
  key: string;
  direction: SortDirection;
}

export interface DataTableProps<Row> {
  columns: ReadonlyArray<DataTableColumn<Row>>;
  rows: ReadonlyArray<Row>;
  rowKey: (row: Row) => string;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: unknown;
  onRetry?: () => void;
  skeletonRows?: number;
  /** Accessible caption for the table. */
  caption?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  emptyVariant?: 'default' | 'search';
  onRowClick?: (row: Row) => void;
  selectedRowKey?: string | null;
  /** Card renderer used on phones instead of the table. */
  renderMobileCard?: (row: Row, index: number) => ReactNode;
  footer?: ReactNode;
  className?: string;
  sort?: DataTableSortState | null;
  onSortChange?: (sort: DataTableSortState | null) => void;
  /** Extra toolbar rendered above the table (filters, bulk actions). */
  toolbar?: ReactNode;
}

const ALIGN_CLASS: Record<string, string> = {
  right: 'cell-numeric',
  center: 'cell-center',
};

/**
 * One table implementation for the whole product: loading skeletons, error
 * state with retry, meaningful empty state, optional sorting, row click and a
 * card layout on phones. Pages never re-implement table logic.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  isLoading = false,
  isFetching = false,
  error,
  onRetry,
  skeletonRows = 6,
  caption,
  emptyTitle,
  emptyMessage,
  emptyActionLabel,
  onEmptyAction,
  emptyVariant = 'default',
  onRowClick,
  selectedRowKey = null,
  renderMobileCard,
  footer,
  className,
  sort,
  onSortChange,
  toolbar,
}: DataTableProps<Row>) {
  const isMobile = useIsMobile();
  const isCompact = useIsCompact();
  const useCards = isMobile && Boolean(renderMobileCard);

  // On phones a card renderer replaces the table entirely, so column hiding
  // only matters for the tablet/desktop table.
  const visibleColumns = columns.filter((column) => {
    if (useCards) return true;
    if (isMobile && column.hideOn === 'mobile') return false;
    if (isCompact && column.hideOn === 'tablet') return false;
    return true;
  });

  const toggleSort = (column: DataTableColumn<Row>) => {
    if (!onSortChange) return;
    if (!sort || sort.key !== column.id) {
      onSortChange({ key: column.id, direction: 'asc' });
      return;
    }
    if (sort.direction === 'asc') {
      onSortChange({ key: column.id, direction: 'desc' });
      return;
    }
    onSortChange(null);
  };

  const body = (() => {
    if (isLoading) {
      return useCards ? (
        <div className="stack stack-3" role="status" aria-label="Loading records">
          {Array.from({ length: Math.min(skeletonRows, 4) }, (_, index) => (
            <div className="card" key={index}>
              <div className="card__body stack stack-3">
                <span className="skeleton skeleton--text" style={{ width: '60%' }} />
                <span className="skeleton skeleton--text" style={{ width: '85%' }} />
              </div>
            </div>
          ))}
          <span className="sr-only">Loading…</span>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <thead>
              <tr>
                {visibleColumns.map((column) => (
                  <th key={column.id} scope="col" className={column.className}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <SkeletonTableRows rows={skeletonRows} columns={visibleColumns.length} />
          </table>
        </div>
      );
    }

    if (error) {
      return <ErrorState error={error} onRetry={onRetry} />;
    }

    if (rows.length === 0) {
      return (
        <EmptyState
          variant={emptyVariant}
          title={emptyTitle}
          message={emptyMessage}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
      );
    }

    if (useCards && renderMobileCard) {
      return (
        <ul className="stack stack-3 card-list" aria-busy={isFetching || undefined}>
          {rows.map((row, index) => (
            <li
              key={rowKey(row)}
              className={cn(
                'card card-list__item',
                selectedRowKey === rowKey(row) && 'card-list__item--selected',
              )}
            >
              {renderMobileCard(row, index)}
            </li>
          ))}
        </ul>
      );
    }

    return (
      <div className="table-wrap">
        <table className="data-table" aria-busy={isFetching || undefined}>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr>
              {visibleColumns.map((column) => {
                const isSorted = sort?.key === column.id;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    className={cn(
                      column.className,
                      column.align ? ALIGN_CLASS[column.align] : undefined,
                    )}
                    aria-sort={
                      isSorted && sort
                        ? sort.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : column.sortable
                          ? 'none'
                          : undefined
                    }
                  >
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        className={cn('sort-btn', isSorted && 'is-active')}
                        onClick={() => toggleSort(column)}
                      >
                        {column.header}
                        <span className="sort-btn__icon" aria-hidden="true">
                          {!isSorted ? (
                            <ChevronsUpDown size={13} />
                          ) : sort?.direction === 'asc' ? (
                            <ArrowUp size={13} />
                          ) : (
                            <ArrowDown size={13} />
                          )}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const key = rowKey(row);
              const clickable = Boolean(onRowClick);
              return (
                <tr
                  key={key}
                  className={cn(
                    clickable && 'is-clickable',
                    selectedRowKey === key && 'is-selected',
                  )}
                  onClick={clickable ? () => onRowClick?.(row) : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onKeyDown={
                    clickable
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onRowClick?.(row);
                          }
                        }
                      : undefined
                  }
                >
                  {visibleColumns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        column.className,
                        column.align ? ALIGN_CLASS[column.align] : undefined,
                      )}
                    >
                      {column.cell(row, index)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  })();

  return (
    <div className={cn('data-table-root', className)}>
      {toolbar ? <div className="data-table-root__toolbar">{toolbar}</div> : null}
      {body}
      {footer && rows.length > 0 && !isLoading ? footer : null}
    </div>
  );
}

/** Convenience cell renderers so every table looks the same. */
export function TableCellPrimary({
  primary,
  secondary,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <div>
      <div className="cell-primary">{primary}</div>
      {secondary ? <div className="cell-sub">{secondary}</div> : null}
    </div>
  );
}

export function TableIdentityCell({
  avatar,
  name,
  meta,
}: {
  avatar: ReactNode;
  name: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="table-identity">
      {avatar}
      <div className="table-identity__text">
        <div className="table-identity__name">{name}</div>
        {meta ? <div className="table-identity__meta">{meta}</div> : null}
      </div>
    </div>
  );
}
