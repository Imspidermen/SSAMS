import { CalendarDays, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { DefinitionList } from '@/components/common/DefinitionList';
import { attendanceStatusMeta } from '@/utils/attendance';
import {
  formatDate,
  formatDateTime,
  formatDistance,
  formatScore,
  formatTime,
} from '@/utils/format';
import type { AttendanceRecord, AttendanceStatus, ReportRow } from '@/types';

interface BaseProps {
  open: boolean;
  onClose: () => void;
}

export interface ReportRowDetailsProps extends BaseProps {
  /** Row shape returned by GET /reports/attendance (admin & teacher history). */
  row: ReportRow | null;
}

/** Verification evidence for one attendance mark. */
export function ReportRowDetailsModal({ open, onClose, row }: ReportRowDetailsProps) {
  if (!row) return null;
  const meta = attendanceStatusMeta(row.status as AttendanceStatus);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Attendance record"
      description={`${row.studentName} · ${row.subjectName}`}
      size="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="stack stack-4">
        <div className="row row--between">
          <Badge tone={meta.tone} dot size="lg">
            {meta.label}
          </Badge>
          <span className="text-caption row" style={{ gap: 'var(--space-2)' }}>
            <CalendarDays size={13} aria-hidden="true" />
            {formatDate(row.date)} at {row.time}
          </span>
        </div>

        <DefinitionList
          items={[
            { term: 'Student', value: row.studentName },
            { term: 'Student ID', value: <span className="text-mono">{row.studentCode}</span> },
            { term: 'Roll number', value: <span className="text-mono">{row.rollNumber}</span> },
            { term: 'Department', value: row.department },
            { term: 'Subject', value: `${row.subjectName} (${row.subjectCode})` },
            { term: 'Classroom', value: row.classroom },
            { term: 'Marked by', value: row.teacher },
            { term: 'Status', value: meta.label },
          ]}
        />

        <VerificationEvidence
          items={[
            {
              label: 'Face match',
              ok: row.faceVerified,
              detail:
                row.faceScore === '' ? null : `Similarity ${formatScore(Number(row.faceScore))}`,
            },
            { label: 'Liveness (head turn)', ok: row.livenessVerified },
            { label: 'Blink detection', ok: row.blinkVerified },
            {
              label: 'Geofence',
              ok: row.locationVerified,
              detail:
                row.distanceFromCenterM === ''
                  ? null
                  : `${formatDistance(Number(row.distanceFromCenterM))} from room centre`,
            },
          ]}
        />
      </div>
    </Modal>
  );
}

export interface AttendanceRecordDetailsProps extends BaseProps {
  /** Full record shape returned to a student for their own history. */
  record: AttendanceRecord | null;
}

/**
 * Detail view for a student's own record. Includes created/updated timestamps,
 * which the flattened report rows do not carry.
 */
export function AttendanceRecordDetailsModal({
  open,
  onClose,
  record,
}: AttendanceRecordDetailsProps) {
  if (!record) return null;
  const meta = attendanceStatusMeta(record.status);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Attendance details"
      description={record.session?.subject?.name ?? 'Session record'}
      size="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="stack stack-4">
        <div className="row row--between">
          <Badge tone={meta.tone} dot size="lg">
            {meta.label}
          </Badge>
          <span className="text-caption">{formatDateTime(record.markedAt)}</span>
        </div>

        <DefinitionList
          items={[
            {
              term: 'Date',
              value: `${formatDate(record.markedAt)} · ${formatTime(record.markedAt)}`,
            },
            {
              term: 'Subject',
              value: record.session?.subject
                ? `${record.session.subject.name} (${record.session.subject.code})`
                : null,
            },
            { term: 'Classroom', value: record.session?.classroom?.name },
            {
              term: 'Class',
              value: record.session
                ? `Semester ${record.session.semester} · Section ${record.session.section}`
                : null,
            },
            { term: 'Marked by', value: record.session?.teacher?.fullName },
            {
              term: 'Session',
              value: record.session
                ? `${formatTime(record.session.startTime)} – ${formatTime(record.session.endTime)}`
                : null,
            },
            { term: 'Status', value: meta.label },
            { term: 'Record created', value: formatDateTime(record.createdAt) },
            { term: 'Record updated', value: formatDateTime(record.updatedAt) },
            {
              term: 'Record ID',
              value: <span className="text-mono">{record.id.slice(0, 8)}</span>,
              mono: true,
            },
          ]}
        />

        <VerificationEvidence
          items={[
            {
              label: 'Face match',
              ok: record.faceVerified,
              detail:
                record.faceScore === null ? null : `Similarity ${formatScore(record.faceScore)}`,
            },
            { label: 'Liveness (head turn)', ok: record.livenessVerified },
            { label: 'Blink detection', ok: record.blinkVerified },
            {
              label: 'Geofence',
              ok: record.locationVerified,
              detail:
                record.distanceFromCenterM === null
                  ? null
                  : `${formatDistance(record.distanceFromCenterM)} from room centre`,
            },
          ]}
        />

        {record.correction ? (
          <div className="alert alert--warning">
            <div className="alert__content">
              <p className="alert__title">Corrected by a teacher</p>
              <p>
                Originally {attendanceStatusMeta(record.correction.originalStatus).label}, changed
                to {attendanceStatusMeta(record.correction.newStatus).label} on{' '}
                {formatDateTime(record.correction.createdAt)}.
              </p>
              <p style={{ marginTop: 'var(--space-1)' }}>
                <em>Reason: {record.correction.reason}</em>
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function VerificationEvidence({
  items,
}: {
  items: Array<{ label: string; ok: boolean; detail?: string | null }>;
}) {
  return (
    <div className="stack stack-2">
      <h3 className="section-title">Verification evidence</h3>
      <ul className="evidence-list">
        {items.map((item) => (
          <li className="evidence-list__item" key={item.label}>
            <span
              className={item.ok ? 'evidence-list__ok' : 'evidence-list__fail'}
              aria-hidden="true"
            >
              {item.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            </span>
            <span className="evidence-list__body">
              <strong>{item.label}</strong>
              <span className="text-caption">
                {item.ok ? 'Verified' : 'Not verified'}
                {item.detail ? ` · ${item.detail}` : ''}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
