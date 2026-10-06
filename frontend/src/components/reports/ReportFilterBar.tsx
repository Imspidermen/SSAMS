import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RawSelect } from '@/components/ui/Select';
import { SearchInput } from '@/components/common/SearchInput';
import { reportFilterSchema } from '@/validators/report.schema';
import type { ReportFilterValues } from '@/utils/reportFilters';
import type { Department, Subject } from '@/types';

export interface ReportFilterBarProps {
  values: ReportFilterValues;
  onChange: (patch: Partial<ReportFilterValues>) => void;
  onReset: () => void;
  subjects: Subject[];
  departments: Department[];
  /** Hide the department filter (teachers only see their own records). */
  showDepartments?: boolean;
  showSubjects?: boolean;
  isLoading?: boolean;
  rangePresets?: Array<{ label: string; days: number }>;
  onPreset?: (days: number) => void;
}

/**
 * Shared filter bar for attendance history and reports.
 *
 * `from`, `to`, `subjectId`, `departmentId` and `teacherId` are real backend
 * query parameters. `status` and `search` are applied to the returned rows
 * because the endpoint does not accept them - this is documented in
 * API_CONTRACT.md rather than silently pretending to be server-side.
 */
export function ReportFilterBar({
  values,
  onChange,
  onReset,
  subjects,
  departments,
  showDepartments = true,
  showSubjects = true,
  isLoading = false,
  rangePresets,
  onPreset,
}: ReportFilterBarProps) {
  const rangeError = (() => {
    const result = reportFilterSchema.safeParse({
      from: values.from || undefined,
      to: values.to || undefined,
      subjectId: values.subjectId || undefined,
      departmentId: values.departmentId || undefined,
    });
    if (result.success) return null;
    return result.error.issues[0]?.message ?? 'Check the selected date range.';
  })();

  const hasFilters =
    values.from !== '' ||
    values.to !== '' ||
    values.subjectId !== '' ||
    values.departmentId !== '' ||
    values.status !== '' ||
    values.search !== '';

  return (
    <div className="toolbar">
      <SearchInput
        className="toolbar__group"
        label="Search records"
        placeholder="Search student name, roll number or subject…"
        value={values.search}
        onChange={(search) => onChange({ search })}
        disabled={isLoading}
      />

      <div className="toolbar__group">
        <label className="field__label" htmlFor="filter-from">
          From
        </label>
        <input
          id="filter-from"
          className="input"
          type="date"
          value={values.from}
          max={values.to || undefined}
          onChange={(event) => onChange({ from: event.target.value })}
          disabled={isLoading}
        />
      </div>

      <div className="toolbar__group">
        <label className="field__label" htmlFor="filter-to">
          To
        </label>
        <input
          id="filter-to"
          className="input"
          type="date"
          value={values.to}
          min={values.from || undefined}
          aria-invalid={rangeError ? true : undefined}
          aria-describedby={rangeError ? 'filter-range-error' : undefined}
          onChange={(event) => onChange({ to: event.target.value })}
          disabled={isLoading}
        />
        {rangeError ? (
          <p className="field__error" id="filter-range-error" role="alert">
            {rangeError}
          </p>
        ) : null}
      </div>

      {showSubjects ? (
        <div className="toolbar__group">
          <label className="field__label" htmlFor="filter-subject">
            Subject
          </label>
          <RawSelect
            id="filter-subject"
            value={values.subjectId}
            onChange={(event) => onChange({ subjectId: event.target.value })}
            disabled={isLoading}
          >
            <option value="">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.code} · {subject.name}
              </option>
            ))}
          </RawSelect>
        </div>
      ) : null}

      {showDepartments ? (
        <div className="toolbar__group">
          <label className="field__label" htmlFor="filter-department">
            Department
          </label>
          <RawSelect
            id="filter-department"
            value={values.departmentId}
            onChange={(event) => onChange({ departmentId: event.target.value })}
            disabled={isLoading}
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </RawSelect>
        </div>
      ) : null}

      <div className="toolbar__group">
        <label className="field__label" htmlFor="filter-status">
          Status
        </label>
        <RawSelect
          id="filter-status"
          value={values.status}
          onChange={(event) => onChange({ status: event.target.value })}
          disabled={isLoading}
        >
          <option value="">All statuses</option>
          <option value="PRESENT">Present</option>
          <option value="LATE">Late</option>
          <option value="ABSENT">Absent</option>
          <option value="EXCUSED">Excused</option>
        </RawSelect>
      </div>

      <div className="toolbar__actions">
        {rangePresets && onPreset ? (
          <div className="row" style={{ gap: 'var(--space-1)' }}>
            {rangePresets.map((preset) => (
              <Button
                key={preset.days}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onPreset(preset.days)}
                disabled={isLoading}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        ) : null}

        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<X size={15} />}
            onClick={onReset}
            disabled={isLoading}
          >
            Clear filters
          </Button>
        ) : (
          <span className="text-caption row" style={{ gap: 'var(--space-1)' }}>
            <Filter size={13} aria-hidden="true" />
            No filters applied
          </span>
        )}
      </div>
    </div>
  );
}
