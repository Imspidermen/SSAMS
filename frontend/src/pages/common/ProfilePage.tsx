import {
  BadgeCheck,
  BookOpen,
  CalendarCheck2,
  Fingerprint,
  IdCard,
  KeyRound,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  UserCog,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { DefinitionList } from '@/components/common/DefinitionList';
import { PageHeader } from '@/components/common/PageHeader';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm';
import { useAuth } from '@/hooks/useAuth';
import { useAuthProfile } from '@/hooks/useAuthProfile';
import { useTheme } from '@/hooks/useTheme';
import { useFaceStatus, useMyAttendance } from '@/hooks/queries/useStudentQueries';
import { useTeacherSubjects } from '@/hooks/queries/useTeacherQueries';
import { paths } from '@/routes/paths';
import { faceStatusMeta, studentStatusMeta, type Tone } from '@/utils/attendance';
import { describeApiError } from '@/utils/apiError';
import { formatDate, formatNumber, formatPercent } from '@/utils/format';
import { ROLE_LABELS } from '@/utils/constants';
import type { ThemePreference } from '@/context/ThemeContext';
import type { Role } from '@/types';

const ROLE_TONE: Record<Role, Tone> = {
  ADMIN: 'info',
  TEACHER: 'primary',
  STUDENT: 'success',
};

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: JSX.Element }> = [
  { value: 'light', label: 'Light', icon: <Sun size={15} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={15} /> },
  { value: 'system', label: 'System', icon: <Monitor size={15} /> },
];

/**
 * Shared profile screen for every role.
 *
 * Identity comes from the session (`GET /auth/me` + the role profile endpoint
 * the dashboards already use). Students additionally see their real attendance
 * summary and face-enrolment status; teachers see their assignment count.
 */
export function ProfilePage() {
  const { user, role } = useAuth();
  const { student, teacher, isProfileLoading } = useAuthProfile();
  const { preference, setPreference, resolvedTheme } = useTheme();

  const currentRole: Role = role ?? 'ADMIN';
  const meta = { label: ROLE_LABELS[currentRole], tone: ROLE_TONE[currentRole] };

  return (
    <>
      <PageHeader
        title="My profile"
        subtitle="Your account details, security settings and appearance preferences."
        actions={<ThemeToggle />}
      />

      <div className="profile-columns">
        <div className="stack stack-4">
          <Card>
            <CardBody>
              <div className="profile-hero">
                <Avatar name={user?.name ?? user?.email ?? ''} size="xl" />
                <div
                  className="stack stack-2"
                  style={{ alignItems: 'center', textAlign: 'center' }}
                >
                  <h2 className="section-title">
                    {isProfileLoading ? 'Loading…' : (user?.name ?? '—')}
                  </h2>
                  <p className="text-caption text-mono">{user?.email}</p>
                  <div className="row" style={{ justifyContent: 'center' }}>
                    <Badge tone={meta.tone} dot>
                      {meta.label}
                    </Badge>
                    {student ? (
                      <Badge tone={studentStatusMeta(student.status).tone}>
                        {studentStatusMeta(student.status).label}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                role === 'STUDENT'
                  ? 'Student record'
                  : role === 'TEACHER'
                    ? 'Staff record'
                    : 'Administrator account'
              }
              subtitle="Read from your profile in the database - contact an administrator to correct it."
              headingLevel={2}
              actions={
                role === 'STUDENT' ? (
                  <Badge tone="neutral" icon={<IdCard size={13} />}>
                    {student?.studentCode ?? '—'}
                  </Badge>
                ) : role === 'TEACHER' ? (
                  <Badge tone="neutral" icon={<IdCard size={13} />}>
                    {teacher?.employeeCode ?? '—'}
                  </Badge>
                ) : (
                  <Badge tone="neutral" icon={<ShieldCheck size={13} />}>
                    Full access
                  </Badge>
                )
              }
            />
            <CardBody>
              {isProfileLoading ? (
                <div className="stack stack-3">
                  <Skeleton width="60%" height="1rem" />
                  <Skeleton width="80%" height="1rem" />
                  <Skeleton width="70%" height="1rem" />
                </div>
              ) : role === 'STUDENT' && student ? (
                <DefinitionList
                  stacked
                  items={[
                    { term: 'Full name', value: student.fullName },
                    { term: 'Email', value: student.user?.email ?? user?.email },
                    { term: 'Phone', value: student.phone },
                    { term: 'Student ID', value: student.studentCode, mono: true },
                    { term: 'Roll number', value: student.rollNumber, mono: true },
                    { term: 'Department', value: student.department?.name ?? '—' },
                    {
                      term: 'Class',
                      value: `Semester ${student.semester} · Section ${student.section}`,
                    },
                    { term: 'Academic year', value: student.academicYear },
                    { term: 'Enrolled since', value: formatDate(student.createdAt) },
                  ]}
                />
              ) : role === 'TEACHER' && teacher ? (
                <DefinitionList
                  stacked
                  items={[
                    { term: 'Full name', value: teacher.fullName },
                    { term: 'Email', value: teacher.user?.email ?? user?.email },
                    { term: 'Phone', value: teacher.phone },
                    { term: 'Employee ID', value: teacher.employeeCode, mono: true },
                    { term: 'Department', value: teacher.department?.name ?? '—' },
                    { term: 'Designation', value: teacher.designation },
                    { term: 'Joined', value: formatDate(teacher.createdAt) },
                  ]}
                />
              ) : (
                <DefinitionList
                  stacked
                  items={[
                    { term: 'Name', value: user?.name ?? '—' },
                    { term: 'Email', value: user?.email },
                    { term: 'Role', value: meta.label },
                    {
                      term: 'Permissions',
                      value:
                        'Manage people, academics, sessions, reports, policy and the audit log.',
                    },
                  ]}
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Appearance"
              subtitle={`Currently ${resolvedTheme} mode. This is a device preference and does not change any record.`}
              headingLevel={2}
            />
            <CardBody>
              <div
                className="row"
                role="radiogroup"
                aria-label="Colour theme"
                style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}
              >
                {THEME_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={preference === option.value ? 'primary' : 'secondary'}
                    icon={option.icon}
                    role="radio"
                    aria-checked={preference === option.value}
                    onClick={() => setPreference(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="stack stack-4">
          {role === 'STUDENT' ? <StudentSummary /> : null}
          {role === 'TEACHER' ? <TeacherSummary /> : null}
          {role === 'ADMIN' ? (
            <Card>
              <CardHeader
                title="Quick actions"
                subtitle="The screens you use most."
                headingLevel={2}
              />
              <CardBody>
                <div className="stack stack-2">
                  <ButtonLink
                    to={paths.admin.students}
                    variant="secondary"
                    icon={<UserCog size={16} />}
                    block
                  >
                    Manage students
                  </ButtonLink>
                  <ButtonLink
                    to={paths.admin.settings}
                    variant="secondary"
                    icon={<ShieldCheck size={16} />}
                    block
                  >
                    Attendance policy
                  </ButtonLink>
                  <ButtonLink
                    to={paths.admin.audit}
                    variant="secondary"
                    icon={<BadgeCheck size={16} />}
                    block
                  >
                    Audit log
                  </ButtonLink>
                </div>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Change password"
              subtitle="Your password protects your attendance records."
              headingLevel={2}
              actions={<KeyRound size={17} aria-hidden="true" />}
            />
            <CardBody>
              <ChangePasswordForm />
            </CardBody>
          </Card>

          <Alert tone="info" title="Need something corrected?">
            Names, student IDs, departments and class assignments are maintained by an
            administrator. Passwords are the only credential you change yourself.
          </Alert>
        </div>
      </div>
    </>
  );
}

function StudentSummary() {
  const attendance = useMyAttendance();
  const face = useFaceStatus();

  return (
    <>
      <Card>
        <CardHeader
          title="My attendance"
          subtitle="Computed by the backend from your verified records."
          headingLevel={2}
          actions={
            <ButtonLink
              to={paths.student.attendance}
              variant="ghost"
              size="sm"
              icon={<CalendarCheck2 size={15} />}
            >
              Details
            </ButtonLink>
          }
        />
        <CardBody>
          {attendance.isPending ? (
            <div className="stack stack-3">
              <Skeleton width="50%" height="2rem" />
              <Skeleton width="100%" height="1rem" />
            </div>
          ) : attendance.isError ? (
            <Alert tone="error" title="Could not load your attendance">
              {describeApiError(attendance.error)}
            </Alert>
          ) : (
            <div className="attendance-summary">
              <p className="attendance-summary__value">
                {formatPercent(attendance.data?.overall.percentage ?? 0, 1)}
              </p>
              <p className="text-caption">
                {formatNumber(attendance.data?.overall.present ?? 0)} attended of{' '}
                {formatNumber(attendance.data?.overall.total ?? 0)} classes
              </p>
              <p className="text-caption">
                Minimum required:{' '}
                <strong>{formatPercent(attendance.data?.minAttendancePercentage ?? 0, 0)}</strong>
              </p>
              {(attendance.data?.overall.percentage ?? 0) <
              (attendance.data?.minAttendancePercentage ?? 0) ? (
                <Badge tone="danger" dot>
                  Below the minimum
                </Badge>
              ) : (
                <Badge tone="success" dot>
                  Meets the minimum
                </Badge>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Face enrolment"
          subtitle="Required before you can mark attendance in a session."
          headingLevel={2}
          actions={<Fingerprint size={17} aria-hidden="true" />}
        />
        <CardBody>
          {face.isPending ? (
            <Skeleton width="60%" height="1.5rem" />
          ) : face.isError ? (
            <Alert tone="error" title="Could not load your enrolment status">
              {describeApiError(face.error)}
            </Alert>
          ) : (
            <div className="stack stack-3">
              <div className="row row--between">
                <Badge tone={faceStatusMeta(face.data?.status ?? 'NOT_ENROLLED').tone} dot>
                  {faceStatusMeta(face.data?.status ?? 'NOT_ENROLLED').label}
                </Badge>
                <span className="text-caption">
                  {formatNumber(face.data?.sampleCount ?? 0)} samples
                </span>
              </div>
              {face.data?.enrolledAt ? (
                <p className="text-caption">Enrolled {formatDate(face.data.enrolledAt)}</p>
              ) : null}
              <ButtonLink
                to={paths.student.face}
                variant={face.data?.status === 'ENROLLED' ? 'secondary' : 'primary'}
                icon={<Fingerprint size={16} />}
                block
              >
                {face.data?.status === 'ENROLLED' ? 'View enrolment' : 'Enrol my face'}
              </ButtonLink>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}

function TeacherSummary() {
  const subjects = useTeacherSubjects();

  return (
    <Card>
      <CardHeader
        title="My subjects"
        subtitle="You can only open attendance sessions for assigned subjects."
        headingLevel={2}
        actions={
          <ButtonLink
            to={paths.teacher.subjects}
            variant="ghost"
            size="sm"
            icon={<BookOpen size={15} />}
          >
            Manage
          </ButtonLink>
        }
      />
      <CardBody>
        {subjects.isPending ? (
          <Skeleton width="70%" height="1.5rem" />
        ) : subjects.isError ? (
          <Alert tone="error" title="Could not load your subjects">
            {describeApiError(subjects.error)}
          </Alert>
        ) : (subjects.data ?? []).length === 0 ? (
          <Alert tone="warning" title="No subjects assigned">
            Ask an administrator to assign you a subject so you can start attendance sessions.
          </Alert>
        ) : (
          <ul className="checklist">
            {(subjects.data ?? []).map((assignment) => (
              <li className="checklist__item" key={assignment.id}>
                <span className="checklist__icon" aria-hidden="true">
                  <BookOpen size={15} />
                </span>
                <span className="checklist__body">
                  <strong>{assignment.subject?.name ?? 'Subject'}</strong>
                  <span className="text-caption">
                    {assignment.subject?.code}
                    {assignment.section ? ` · Section ${assignment.section}` : ' · All sections'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
