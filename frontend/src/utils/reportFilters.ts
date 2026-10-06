/**
 * Filter state for the attendance history and reports screens.
 *
 * `from`, `to`, `subjectId`, `departmentId` and `teacherId` map 1:1 onto
 * GET /reports/attendance query parameters. `status` and `search` are applied to
 * the returned rows in the browser because that endpoint does not accept them -
 * the required additions are documented in frontend/API_CONTRACT.md.
 */
export interface ReportFilterValues {
  from: string;
  to: string;
  subjectId: string;
  departmentId: string;
  status: string;
  search: string;
}

export const EMPTY_REPORT_FILTERS: ReportFilterValues = {
  from: '',
  to: '',
  subjectId: '',
  departmentId: '',
  status: '',
  search: '',
};
