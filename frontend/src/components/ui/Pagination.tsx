import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from '@/types';
import { buildPageWindow } from '@/utils/pagination';
import { PAGE_SIZES } from '@/utils/constants';
import { formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';

export interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  isLoading?: boolean;
  className?: string;
  /** Item noun used in the summary, e.g. "students". */
  itemLabel?: string;
}

/**
 * Reusable pagination. Shows a 1-based window with ellipses, a "Showing x–y of
 * z" summary and an optional page-size selector.
 */
export function Pagination({
  meta,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
  className,
  itemLabel = 'records',
}: PaginationProps) {
  const { page, pageSize, total, totalPages, firstItemIndex, lastItemIndex } = meta;

  if (total === 0) return null;

  return (
    <nav
      className={cn('pagination', className)}
      aria-label={`${itemLabel} pagination`}
      aria-busy={isLoading || undefined}
    >
      <p className="pagination__summary" aria-live="polite">
        Showing <strong>{formatNumber(firstItemIndex)}</strong>–
        <strong>{formatNumber(lastItemIndex)}</strong> of <strong>{formatNumber(total)}</strong>{' '}
        {itemLabel}
      </p>

      <div className="pagination__controls">
        <button
          type="button"
          className="pagination__page"
          onClick={() => onPageChange(page - 1)}
          disabled={isLoading || !meta.hasPrevious}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} aria-hidden="true" />
          <span className="pagination__prev-label">Previous</span>
        </button>

        {buildPageWindow(page, totalPages).map((entry, index) =>
          entry === 'gap' ? (
            <span className="pagination__ellipsis" key={`gap-${index}`} aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              className="pagination__page"
              onClick={() => onPageChange(entry)}
              disabled={isLoading}
              aria-label={`Page ${entry}`}
              aria-current={entry === page ? 'page' : undefined}
            >
              {entry}
            </button>
          ),
        )}

        <button
          type="button"
          className="pagination__page"
          onClick={() => onPageChange(page + 1)}
          disabled={isLoading || !meta.hasNext}
          aria-label="Next page"
        >
          <span className="pagination__next-label">Next</span>
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>

      {onPageSizeChange ? (
        <label className="pagination__size">
          <span>Rows</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            disabled={isLoading}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </nav>
  );
}
