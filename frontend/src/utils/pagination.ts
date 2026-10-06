/**
 * Pagination helpers shared by the reusable control and every list page.
 *
 * Kept out of the component file so the component module only exports
 * components (fast-refresh friendly) and so pages can build metadata for
 * client-side lists without importing UI.
 */
import type { PaginationMeta } from '@/types';

/** Produces e.g. [1, 'gap', 4, 5, 6, 'gap', 12]. */
export function buildPageWindow(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((page) => pages.add(page));
  if (current >= total - 2) [total - 1, total - 2, total - 3].forEach((page) => pages.add(page));

  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result: Array<number | 'gap'> = [];

  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push('gap');
    result.push(page);
  });

  return result;
}

/** Derives display metadata from the backend's `{ total, page, pageSize }`. */
export function buildPaginationMeta(input: {
  total: number;
  page: number;
  pageSize: number;
}): PaginationMeta {
  const total = Math.max(0, input.total);
  const pageSize = Math.max(1, input.pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, input.page), totalPages);
  const firstItemIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItemIndex = Math.min(total, page * pageSize);

  return {
    page,
    pageSize,
    total,
    totalPages,
    firstItemIndex,
    lastItemIndex,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
  };
}
