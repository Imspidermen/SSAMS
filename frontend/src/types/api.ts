/**
 * Wire-format types shared by every service.
 *
 * These mirror the actual Node/Express backend (`backend/src/middleware/
 * errorHandler.ts` and the controllers) exactly:
 *
 *   success -> { success: true,  data: T }
 *   failure -> { success: false, error: { code, message, details? } }
 *
 * Paginated collections use `{ items, total, page, pageSize }` - the backend
 * does NOT return `totalPages`, so it is derived on the client.
 */

export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

/** Shape produced by Zod's `error.flatten()` for 422 VALIDATION_ERROR responses. */
export interface ZodFlattenedError {
  formErrors: string[];
  fieldErrors: Record<string, string[] | undefined>;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorBody;
}

/** The paginated envelope returned by list endpoints. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Common list-endpoint query parameters. */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface StudentListParams extends PaginationParams {
  departmentId?: string;
  semester?: number;
  section?: string;
}

/** Derived pagination metadata used by the <Pagination /> component. */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  firstItemIndex: number;
  lastItemIndex: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface HealthStatus {
  status: string;
  dependencies: {
    database: 'ok' | 'down';
    aiService: 'ok' | 'down';
  };
}
