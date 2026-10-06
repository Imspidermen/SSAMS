import { useMemo, useState } from 'react';
import { BookOpen, Play, Radio, Users } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Progress } from '@/components/ui/Progress';
import { SearchInput } from '@/components/common/SearchInput';
import { PageHeader } from '@/components/common/PageHeader';
import { StartSessionModal } from '@/components/attendance/StartSessionModal';
import { useTeacherDashboard, useTeacherSubjects } from '@/hooks/queries/useTeacherQueries';
import { usePolicy } from '@/hooks/queries/useAdminQueries';
import { useReportAnalytics } from '@/hooks/queries/useReportAnalytics';
import { paths } from '@/routes/paths';
import { FALLBACK_MIN_ATTENDANCE_PERCENTAGE } from '@/utils/constants';
import { formatDate, formatNumber, formatPercent } from '@/utils/format';
import type { TeacherSubject } from '@/types';

const TREND_DAYS = 30;

/**
 * The subjects assigned to the signed-in teacher (GET /teacher/subjects).
 *
 * The attendance column is joined from GET /reports/attendance scoped to this
 * teacher over the last 30 days, matched by subject code - so it reflects real
 * records rather than a placeholder. Assignments themselves are managed by an
 * administrator; there is no teacher-facing write endpoint for them.
 */
export function TeacherSubjectsPage() {
  const subjects = useTeacherSubjects();
  const dashboard = useTeacherDashboard();
  const policy = usePolicy();
  const threshold = policy.data?.minAttendancePercentage ?? FALLBACK_MIN_ATTENDANCE_PERCENTAGE;
  const [search, setSearch] = useState('');
  const [startFor, setStartFor] = useState<string | null>(null);

  // Always scoped to this teacher's own records. (The backend does not force
  // that scoping for TEACHER callers - see the authorisation note in
  // API_CONTRACT.md - so the client passes its own teacherId explicitly.)
  const teacherId = dashboard.data?.teacher?.id;
  const analytics = useReportAnalytics(
    { teacherId },
    { rangeDays: TREND_DAYS, threshold, enabled: Boolean(teacherId) },
  );

  const percentages = useMemo(() => {
    const map = new Map<string, { percentage: number; present?: number; total?: number }>();
    for (const entry of analytics.bySubject) map.set(entry.code ?? '', entry);
    return map;
  }, [analytics.bySubject]);

  const rows = useMemo(() => {
    const items = subjects.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (assignment) =>
        (assignment.subject?.name ?? '').toLowerCase().includes(term) ||
        (assignment.subject?.code ?? '').toLowerCase().includes(term) ||
        (assignment.subject?.department?.name ?? '').toLowerCase().includes(term),
    );
  }, [subjects.data, search]);

  const columns: DataTableColumn<TeacherSubject>[] = [
    {
      id: 'subject',
      header: 'Subject',
      cell: (assignment) => (
        <div className="table-identity">
          <span className="table-identity__icon" aria-hidden="true">
            <BookOpen size={16} />
          </span>
          <div className="table-identity__text">
            <div className="table-identity__name">{assignment.subject?.name ?? 'Subject'}</div>
            <div className="table-identity__meta text-mono">
              {assignment.subject?.code ?? '—'}
              {assignment.subject?.department?.name
                ? ` · ${assignment.subject.department.name}`
                : ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'class',
      header: 'Class',
      cell: (assignment) => (
        <div>
          <div className="cell-primary">Semester {assignment.subject?.semester ?? '—'}</div>
          <div className="cell-sub">
            {assignment.section ? `Section ${assignment.section}` : 'All sections'}
          </div>
        </div>
      ),
    },
    {
      id: 'credits',
      header: 'Credits',
      align: 'right',
      cell: (assignment) => assignment.subject?.credits ?? '—',
      hideOn: 'tablet',
    },
    {
      id: 'attendance',
      header: `Attendance (${TREND_DAYS}d)`,
      cell: (assignment) => {
        const code = assignment.subject?.code ?? '';
        const entry = percentages.get(code);
        if (!entry) {
          return <span className="text-caption">No records yet</span>;
        }
        return (
          <div className="cell-progress">
            <Progress
              value={entry.percentage}
              size="sm"
              tone={entry.percentage >= threshold ? 'success' : 'danger'}
            />
            <span className="cell-progress__value">
              {formatPercent(entry.percentage, 1)}
              <span className="sr-only">
                {' '}
                ({entry.present ?? 0} of {entry.total ?? 0} marks)
              </span>
            </span>
          </div>
        );
      },
    },
    {
      id: 'assigned',
      header: 'Assigned',
      cell: (assignment) => formatDate(assignment.assignedAt),
      hideOn: 'tablet',
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      className: 'cell-actions',
      cell: (assignment) => (
        <div className="row-actions">
          <Button
            size="sm"
            variant="primary"
            icon={<Play size={14} />}
            onClick={() => setStartFor(assignment.subjectId)}
          >
            Start session
          </Button>
          <ButtonLink
            size="sm"
            variant="secondary"
            to={paths.teacher.students}
            icon={<Users size={14} />}
          >
            Roster
          </ButtonLink>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="My subjects"
        subtitle="Subjects an administrator has assigned to you. You can only open sessions for these."
        actions={
          <Button
            icon={<Play size={16} />}
            onClick={() => setStartFor('')}
            disabled={rows.length === 0}
          >
            Start session
          </Button>
        }
      />

      {subjects.isSuccess && rows.length === 0 && search === '' ? (
        <Alert tone="warning" title="Nothing assigned yet">
          Subject assignments are created by an administrator from{' '}
          <strong>Admin → Subjects → Assign teacher</strong>. Until then the backend rejects session
          creation with <code className="text-mono">NOT_ASSIGNED</code>.
        </Alert>
      ) : null}

      <Card flush>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(assignment) => assignment.id}
          isLoading={subjects.isPending}
          isFetching={subjects.isFetching}
          error={subjects.isError ? subjects.error : null}
          onRetry={() => void subjects.refetch()}
          caption="Assigned subjects"
          emptyVariant={search ? 'search' : 'default'}
          emptyTitle={search ? 'No subjects match your search' : 'No subjects assigned'}
          emptyMessage={search ? 'Try a different subject name, code or department.' : undefined}
          toolbar={
            <div className="toolbar">
              <SearchInput
                className="toolbar__group"
                label="Search my subjects"
                placeholder="Search by subject name, code or department…"
                value={search}
                onChange={setSearch}
              />
              <div className="toolbar__actions">
                <Badge tone="neutral" icon={<Radio size={12} />}>
                  {formatNumber(rows.length)} assigned
                </Badge>
              </div>
            </div>
          }
          renderMobileCard={(assignment) => {
            const code = assignment.subject?.code ?? '';
            const entry = percentages.get(code);
            return (
              <>
                <div className="card-list__header">
                  <div>
                    <p className="card-list__title">{assignment.subject?.name ?? 'Subject'}</p>
                    <p className="text-caption text-mono">
                      {code}
                      {assignment.subject?.department?.name
                        ? ` · ${assignment.subject.department.name}`
                        : ''}
                    </p>
                  </div>
                  <Badge tone="primary">Sem {assignment.subject?.semester ?? '—'}</Badge>
                </div>
                <dl className="card-list__meta">
                  <div>
                    <dt>Section</dt>
                    <dd>{assignment.section ?? 'All'}</dd>
                  </div>
                  <div>
                    <dt>Credits</dt>
                    <dd>{assignment.subject?.credits ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Assigned</dt>
                    <dd>{formatDate(assignment.assignedAt)}</dd>
                  </div>
                </dl>
                {entry ? (
                  <Progress
                    value={entry.percentage}
                    size="sm"
                    tone={entry.percentage >= threshold ? 'success' : 'danger'}
                    label={`Attendance over the last ${TREND_DAYS} days`}
                  />
                ) : (
                  <p className="text-caption">No attendance records yet for this subject.</p>
                )}
                <div className="card-list__actions">
                  <Button
                    size="sm"
                    icon={<Play size={14} />}
                    onClick={() => setStartFor(assignment.subjectId)}
                  >
                    Start session
                  </Button>
                  <ButtonLink
                    size="sm"
                    variant="secondary"
                    to={paths.teacher.students}
                    icon={<Users size={14} />}
                  >
                    Roster
                  </ButtonLink>
                </div>
              </>
            );
          }}
        />
      </Card>

      <Alert tone="info" title="Attendance figures" icon={<BookOpen size={17} />}>
        Percentages come from <code className="text-mono">GET /api/reports/attendance</code>{' '}
        filtered to your own records over the last {TREND_DAYS} days, measured against the{' '}
        {formatPercent(threshold, 0)} institutional minimum. Subjects with no sessions yet simply
        show “No records”.
      </Alert>

      <StartSessionModal
        open={startFor !== null}
        presetSubjectId={startFor || undefined}
        onClose={() => setStartFor(null)}
      />
    </>
  );
}
