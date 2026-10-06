import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Ban, BookOpen, CalendarDays, Pencil, ScanFace, UserCheck } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Avatar } from '@/components/ui/Avatar';
import { Gauge } from '@/components/ui/Progress';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DefinitionList } from '@/components/common/DefinitionList';
import { PageHeader } from '@/components/common/PageHeader';
import { AttendanceIndicator } from '@/components/common/AttendanceIndicator';
import { SubjectAttendanceChart } from '@/components/dashboard/SubjectAttendanceChart';
import { StatusBreakdownChart } from '@/components/dashboard/StatusBreakdownChart';
import { useToast } from '@/hooks/useToast';
import {
  usePolicy,
  useResetStudentFace,
  useSetStudentActiveState,
  useStudent,
} from '@/hooks/queries/useAdminQueries';
import { useAttendanceReport } from '@/hooks/queries/useReportQueries';
import { groupReportBySubject, summariseReport } from '@/services/report.service';
import { paths } from '@/routes/paths';
import { FALLBACK_MIN_ATTENDANCE_PERCENTAGE } from '@/utils/constants';
import { describeApiError } from '@/utils/apiError';
import { attendanceStatusMeta, faceStatusMeta, studentStatusMeta } from '@/utils/attendance';
import { formatDate, formatNumber, formatPercent } from '@/utils/format';
import type { AttendanceStatus, ReportRow } from '@/types';

/**
 * Student profile (admin view).
 *
 * Identity data comes from the student record; every attendance number is
 * aggregated from `GET /reports/attendance?studentId=…`, which the backend
 * computes from PostgreSQL. No client-side estimates.
 */
export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const studentQuery = useStudent(id);
  const policy = usePolicy();
  const threshold = policy.data?.minAttendancePercentage ?? FALLBACK_MIN_ATTENDANCE_PERCENTAGE;

  const reportQuery = useAttendanceReport({ studentId: id }, Boolean(id) && studentQuery.isSuccess);

  const setActive = useSetStudentActiveState();
  const resetFace = useResetStudentFace();
  const [pendingDeactivate, setPendingDeactivate] = useState(false);
  const [pendingFaceReset, setPendingFaceReset] = useState(false);

  const student = studentQuery.data;
  const rows = useMemo(() => reportQuery.data ?? [], [reportQuery.data]);

  const summary = useMemo(() => summariseReport(rows), [rows]);
  const bySubject = useMemo(() => groupReportBySubject(rows), [rows]);
  const statusCounts = useMemo<Record<AttendanceStatus, number>>(() => {
    const counts: Record<AttendanceStatus, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  }, [rows]);

  const historyColumns: DataTableColumn<ReportRow>[] = [
    { id: 'date', header: 'Date', cell: (row) => formatDate(row.date) },
    {
      id: 'time',
      header: 'Time',
      cell: (row) => <span className="text-mono">{row.time}</span>,
      hideOn: 'tablet',
    },
    {
      id: 'subject',
      header: 'Subject',
      cell: (row) => (
        <div>
          <div className="cell-primary">{row.subjectName}</div>
          <div className="cell-sub">{row.subjectCode}</div>
        </div>
      ),
    },
    { id: 'classroom', header: 'Classroom', cell: (row) => row.classroom, hideOn: 'tablet' },
    { id: 'teacher', header: 'Marked by', cell: (row) => row.teacher, hideOn: 'tablet' },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => {
        const meta = attendanceStatusMeta(row.status);
        return (
          <Badge tone={meta.tone} dot>
            {meta.label}
          </Badge>
        );
      },
    },
    {
      id: 'verification',
      header: 'Verified',
      cell: (row) => (
        <span className="row" style={{ gap: 'var(--space-1)' }}>
          <VerificationChip label="Face" ok={row.faceVerified} />
          <VerificationChip label="Live" ok={row.livenessVerified} />
          <VerificationChip label="Blink" ok={row.blinkVerified} />
          <VerificationChip label="Geo" ok={row.locationVerified} />
        </span>
      ),
      hideOn: 'tablet',
    },
  ];

  if (studentQuery.isPending) {
    return (
      <>
        <PageHeader
          title="Student profile"
          breadcrumbs={[{ label: 'Students', to: paths.admin.students }, { label: 'Loading' }]}
        />
        <Card>
          <CardBody className="stack stack-4">
            <div className="row" style={{ gap: 'var(--space-4)' }}>
              <Skeleton width="6rem" height="6rem" variant="circle" />
              <div className="stack stack-3" style={{ flex: 1 }}>
                <Skeleton variant="title" />
                <Skeleton width="40%" />
              </div>
            </div>
            <Skeleton width="100%" height="6rem" />
          </CardBody>
        </Card>
      </>
    );
  }

  if (studentQuery.isError || !student) {
    return (
      <>
        <PageHeader
          title="Student profile"
          breadcrumbs={[{ label: 'Students', to: paths.admin.students }]}
        />
        <Card>
          <div className="card__body">
            <Alert tone="error" title="Could not load this student">
              {describeApiError(studentQuery.error)}
            </Alert>
            <div className="row" style={{ marginTop: 'var(--space-4)' }}>
              <Button variant="secondary" onClick={() => void studentQuery.refetch()}>
                Try again
              </Button>
              <ButtonLink to={paths.admin.students} variant="ghost">
                Back to students
              </ButtonLink>
            </div>
          </div>
        </Card>
      </>
    );
  }

  const statusMeta = studentStatusMeta(student.status);
  const face = faceStatusMeta(student.faceProfile?.status ?? 'NOT_ENROLLED');
  const isActive = student.status === 'ACTIVE';

  return (
    <>
      <PageHeader
        title={student.fullName}
        subtitle={`${student.department?.name ?? ''} · Semester ${student.semester} · Section ${student.section}`}
        breadcrumbs={[{ label: 'Students', to: paths.admin.students }, { label: student.fullName }]}
        actions={
          <>
            <ButtonLink
              to={paths.admin.studentEdit(student.id)}
              variant="secondary"
              icon={<Pencil size={16} />}
            >
              Edit
            </ButtonLink>
            <Button
              variant={isActive ? 'dangerOutline' : 'secondary'}
              icon={isActive ? <Ban size={16} /> : <UserCheck size={16} />}
              onClick={() => setPendingDeactivate(true)}
            >
              {isActive ? 'Deactivate' : 'Reactivate'}
            </Button>
          </>
        }
      />

      <div className="split">
        <Card>
          <CardBody className="stack stack-5">
            <div className="profile-hero">
              <Avatar name={student.fullName} size="xl" tone={isActive ? undefined : 'neutral'} />
              <div className="stack stack-2" style={{ alignItems: 'center', textAlign: 'center' }}>
                <h2 className="section-title">{student.fullName}</h2>
                <p className="text-caption text-mono">{student.studentCode}</p>
                <div className="row" style={{ justifyContent: 'center' }}>
                  <Badge tone={statusMeta.tone} dot>
                    {statusMeta.label}
                  </Badge>
                  <Badge tone={face.tone} icon={<ScanFace size={12} />}>
                    {student.faceProfile?.status === 'ENROLLED'
                      ? 'Face enrolled'
                      : 'Face not enrolled'}
                  </Badge>
                </div>
              </div>
            </div>

            <DefinitionList
              stacked
              items={[
                {
                  term: 'Student ID',
                  value: <span className="text-mono">{student.studentCode}</span>,
                },
                {
                  term: 'Roll number',
                  value: <span className="text-mono">{student.rollNumber}</span>,
                },
                { term: 'Email', value: student.user?.email },
                { term: 'Phone', value: student.phone },
                { term: 'Department', value: student.department?.name },
                { term: 'Semester', value: `Semester ${student.semester}` },
                { term: 'Section', value: `Section ${student.section}` },
                { term: 'Academic year', value: student.academicYear },
                { term: 'Enrolled on', value: formatDate(student.createdAt) },
              ]}
            />

            {student.faceProfile?.status === 'ENROLLED' ? (
              <Button
                variant="dangerOutline"
                size="sm"
                block
                icon={<ScanFace size={15} />}
                onClick={() => setPendingFaceReset(true)}
              >
                Reset face profile
              </Button>
            ) : (
              <Alert tone="warning" title="Face enrolment required">
                This student cannot mark attendance until they complete face enrolment from their
                own account ({student.user?.email}).
              </Alert>
            )}
          </CardBody>
        </Card>

        <div className="stack stack-4">
          <Card>
            <CardHeader
              title="Attendance summary"
              subtitle="All recorded sessions for this student"
              headingLevel={2}
              actions={reportQuery.isFetching ? <Badge tone="neutral">Updating…</Badge> : null}
            />
            <CardBody>
              {reportQuery.isPending ? (
                <div
                  className="row"
                  style={{ justifyContent: 'center', padding: 'var(--space-6)' }}
                >
                  <Skeleton variant="circle" width="10rem" height="10rem" />
                </div>
              ) : summary.totalRecords === 0 ? (
                <Alert tone="info" title="No attendance recorded yet">
                  This student has no attendance records. Records appear once a teacher opens a
                  session for their class and the student verifies in.
                </Alert>
              ) : (
                <div className="attendance-summary">
                  <Gauge
                    value={summary.attendancePercentage}
                    tone={
                      summary.attendancePercentage >= threshold
                        ? 'success'
                        : summary.attendancePercentage >= threshold - 10
                          ? 'warning'
                          : 'danger'
                    }
                    size={160}
                  />

                  <div className="attendance-summary__stats">
                    <div className="stat-line">
                      <span className="text-caption">Present</span>
                      <strong>{formatNumber(summary.present)}</strong>
                    </div>
                    <div className="stat-line">
                      <span className="text-caption">Late</span>
                      <strong>{formatNumber(summary.late)}</strong>
                    </div>
                    <div className="stat-line">
                      <span className="text-caption">Absent</span>
                      <strong>{formatNumber(summary.absent)}</strong>
                    </div>
                    <div className="stat-line">
                      <span className="text-caption">Total records</span>
                      <strong>{formatNumber(summary.totalRecords)}</strong>
                    </div>
                    <div className="stat-line">
                      <span className="text-caption">Required minimum</span>
                      <strong>{formatPercent(threshold, 0)}</strong>
                    </div>
                  </div>
                </div>
              )}

              {summary.totalRecords > 0 ? (
                <div className="stack stack-4" style={{ marginTop: 'var(--space-5)' }}>
                  <AttendanceIndicator
                    percentage={summary.attendancePercentage}
                    threshold={threshold}
                    showBar
                  />
                  <StatusBreakdownChart counts={statusCounts} height={200} />
                </div>
              ) : null}
            </CardBody>
          </Card>

          {bySubject.length > 0 ? (
            <Card>
              <CardHeader
                title="Subject-wise attendance"
                subtitle={`Measured against the ${formatPercent(threshold, 0)} institutional minimum`}
                headingLevel={2}
              />
              <CardBody>
                <SubjectAttendanceChart
                  data={bySubject.map((entry) => ({
                    label: entry.subject,
                    code: entry.code,
                    percentage: entry.percentage,
                    present: entry.present,
                    total: entry.total,
                  }))}
                  threshold={threshold}
                  layout="horizontal"
                  height={Math.max(200, bySubject.length * 46)}
                />
              </CardBody>
            </Card>
          ) : null}

          <Card flush>
            <CardHeader
              title="Attendance history"
              subtitle="Every record with its verification evidence"
              headingLevel={2}
              actions={
                <ButtonLink
                  to={paths.admin.attendanceHistory}
                  variant="ghost"
                  size="sm"
                  icon={<CalendarDays size={15} />}
                >
                  Full history
                </ButtonLink>
              }
            />
            <DataTable
              columns={historyColumns}
              rows={rows}
              rowKey={(row) => `${row.date}-${row.time}-${row.subjectCode}`}
              isLoading={reportQuery.isPending}
              isFetching={reportQuery.isFetching}
              error={reportQuery.isError ? reportQuery.error : null}
              onRetry={() => void reportQuery.refetch()}
              caption={`Attendance history for ${student.fullName}`}
              emptyTitle="No attendance has been recorded yet"
              emptyMessage="This student has no records in any session so far."
              emptyActionLabel="Browse subjects"
              onEmptyAction={() => navigate(paths.admin.subjects)}
            />
          </Card>

          <Card>
            <CardHeader title="Subject enrolment" headingLevel={2} />
            <CardBody>
              <Alert tone="info" title="Enrol from the Subjects page" icon={<BookOpen size={17} />}>
                Attendance sessions only include students enrolled in the subject. Use{' '}
                <strong>Subjects → Enrol student</strong> to add {student.fullName.split(' ')[0]} to
                a subject.
              </Alert>
              <div style={{ marginTop: 'var(--space-3)' }}>
                <ButtonLink
                  to={paths.admin.subjects}
                  variant="secondary"
                  size="sm"
                  icon={<BookOpen size={15} />}
                >
                  Manage enrolments
                </ButtonLink>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={pendingDeactivate}
        title={isActive ? 'Deactivate this student?' : 'Reactivate this student?'}
        message={
          isActive ? (
            <>
              <strong>{student.fullName}</strong> will lose sign-in and attendance access.
              Historical records are preserved and the action can be reversed.
            </>
          ) : (
            <>
              <strong>{student.fullName}</strong> will regain sign-in and attendance access.
            </>
          )
        }
        confirmLabel={isActive ? 'Deactivate' : 'Reactivate'}
        tone={isActive ? 'danger' : 'primary'}
        isPending={setActive.isPending}
        onConfirm={async () => {
          try {
            await setActive.mutateAsync({ id: student.id, active: !isActive });
            toast.success(
              isActive ? 'Student deactivated' : 'Student reactivated',
              `${student.fullName}’s access was updated.`,
            );
          } catch (error) {
            toast.error('Action failed', describeApiError(error));
          } finally {
            setPendingDeactivate(false);
          }
        }}
        onCancel={() => setPendingDeactivate(false)}
      />

      <ConfirmDialog
        open={pendingFaceReset}
        title="Reset face profile?"
        message={
          <>
            All stored face embeddings for <strong>{student.fullName}</strong> will be deleted. They
            must re-enrol before marking attendance again.
          </>
        }
        confirmLabel="Reset face profile"
        isPending={resetFace.isPending}
        onConfirm={async () => {
          try {
            await resetFace.mutateAsync(student.id);
            toast.success('Face profile reset', `${student.fullName} must re-enrol.`);
          } catch (error) {
            toast.error('Reset failed', describeApiError(error));
          } finally {
            setPendingFaceReset(false);
          }
        }}
        onCancel={() => setPendingFaceReset(false)}
      />
    </>
  );
}

/** Small tick/cross chip for the four verification factors on a record. */
function VerificationChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Badge
      tone={ok ? 'success' : 'neutral'}
      title={`${label}: ${ok ? 'verified' : 'not verified'}`}
    >
      {label}
      <span className="sr-only">{ok ? ' verified' : ' not verified'}</span>
    </Badge>
  );
}
