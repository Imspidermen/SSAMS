import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/context/ThemeProvider';
import { ToastProvider } from '@/context/ToastProvider';
import { createTestQueryClient } from '@/test/renderWithProviders';
import { ApiError } from '@/utils/apiError';
import { StudentDashboardPage } from './StudentDashboardPage';
import type { AuthContextValue } from '@/context/AuthContext';
import type {
  AttendanceSession,
  FaceStatus,
  HealthStatus,
  Student,
  StudentAttendanceOverview,
} from '@/types';

const mocks = vi.hoisted(() => ({
  attendance: { current: null as unknown },
  profile: { current: null as unknown },
  face: {
    current: {
      status: 'ENROLLED',
      sampleCount: 4,
      enrolledAt: '2026-01-12T09:00:00.000Z',
    } as unknown,
  },
  sessions: { current: [] as unknown },
  health: {
    current: { status: 'ok', dependencies: { database: 'ok', aiService: 'ok' } } as unknown,
  },
  attendanceError: { current: null as unknown },
  user: {
    current: {
      id: 'u-1',
      email: 'aarav@ssams.dev',
      role: 'STUDENT',
      name: 'Aarav Mehta',
    } as unknown,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () =>
    ({
      user: mocks.user.current,
      role: 'STUDENT',
      isAuthenticated: true,
      isInitialising: false,
    }) as unknown as AuthContextValue,
}));

vi.mock('@/services/student.service', () => ({
  getMyProfile: () => {
    if (mocks.profile.current instanceof Error) return Promise.reject(mocks.profile.current);
    return Promise.resolve(mocks.profile.current as Student);
  },
  getMyAttendance: () => {
    if (mocks.attendanceError.current) return Promise.reject(mocks.attendanceError.current);
    return Promise.resolve(mocks.attendance.current as StudentAttendanceOverview);
  },
  getMyHistory: () => Promise.resolve([]),
}));

vi.mock('@/services/face.service', () => ({
  getFaceStatus: () => Promise.resolve(mocks.face.current as FaceStatus),
  enrollFace: vi.fn(),
  resetFaceProfile: vi.fn(),
}));

vi.mock('@/services/attendance.service', () => ({
  listActiveSessions: () => Promise.resolve(mocks.sessions.current as AttendanceSession[]),
}));

vi.mock('@/services/health.service', () => ({
  getHealth: () => Promise.resolve(mocks.health.current as HealthStatus),
}));

/**
 * The minimum attendance percentage is deliberately 80 (not the usual 75) so a
 * hard-coded threshold anywhere in the UI would fail these tests.
 */
function overview(overrides: Partial<StudentAttendanceOverview> = {}): StudentAttendanceOverview {
  return {
    overall: { total: 40, present: 28, absent: 12, percentage: 70 },
    minAttendancePercentage: 80,
    subjectWise: [
      {
        subjectId: 's1',
        subjectName: 'Data Structures',
        subjectCode: 'BCA301',
        present: 12,
        absent: 8,
        total: 20,
        percentage: 60,
        belowThreshold: true,
        classesNeededForTarget: 10,
      },
      {
        subjectId: 's2',
        subjectName: 'DBMS',
        subjectCode: 'BCA302',
        present: 16,
        absent: 4,
        total: 20,
        percentage: 80,
        belowThreshold: false,
        classesNeededForTarget: 0,
      },
    ],
    history: [
      {
        id: 'r1',
        sessionId: 'ses1',
        studentId: 'u-1',
        status: 'PRESENT',
        markedAt: '2026-02-10T09:15:00.000Z',
        faceVerified: true,
        faceScore: 0.86,
        livenessVerified: true,
        blinkVerified: true,
        locationVerified: true,
        locationAccuracyM: 8,
        distanceFromCenterM: 12,
        verificationMetadata: null,
        createdAt: '2026-02-10T09:15:00.000Z',
        updatedAt: '2026-02-10T09:15:00.000Z',
        session: {
          id: 'ses1',
          subjectId: 's1',
          teacherId: 't1',
          classroomId: 'c1',
          semester: 3,
          section: 'A',
          startTime: '2026-02-10T09:00:00.000Z',
          endTime: '2026-02-10T09:15:00.000Z',
          status: 'ENDED',
          geofenceRadiusM: 100,
          livenessRequired: true,
          blinkRequired: true,
          maxAttempts: 3,
          createdAt: '2026-02-10T09:00:00.000Z',
          updatedAt: '2026-02-10T09:15:00.000Z',
          subject: {
            id: 's1',
            name: 'Data Structures',
            code: 'BCA301',
            departmentId: 'd1',
            courseId: null,
            semester: 3,
            credits: 4,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          classroom: {
            id: 'c1',
            name: 'Room 204',
            building: 'Main Block',
            floor: '2',
            latitude: 28.6139,
            longitude: 77.209,
            radiusMeters: 100,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      },
    ],
    ...overrides,
  };
}

/** Returns the `.stat` tile element that carries the given label. */
function statTile(label: string): HTMLElement {
  const match = screen
    .getAllByText(label)
    .map((node) => node.closest('.stat'))
    .find((node): node is HTMLElement => node !== null);
  if (!match) throw new Error(`No stat tile labelled "${label}"`);
  return match;
}

function renderDashboard() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter>
            <StudentDashboardPage />
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.attendance.current = overview();
  mocks.profile.current = {
    id: 'st-1',
    userId: 'u-1',
    studentCode: 'BCA2024001',
    rollNumber: '01',
    fullName: 'Aarav Mehta',
    phone: null,
    departmentId: 'd1',
    semester: 3,
    section: 'A',
    academicYear: '2024-2025',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } satisfies Student;
  mocks.face.current = {
    status: 'ENROLLED',
    sampleCount: 4,
    enrolledAt: '2026-01-12T09:00:00.000Z',
  };
  mocks.sessions.current = [];
  mocks.health.current = { status: 'ok', dependencies: { database: 'ok', aiService: 'ok' } };
  mocks.attendanceError.current = null;
});

describe('StudentDashboardPage', () => {
  it('shows the attendance percentage computed by the backend', async () => {
    renderDashboard();

    expect(await screen.findByLabelText(/overall attendance: 70\.0 percent/i)).toBeInTheDocument();

    const attendedTile = statTile('Classes attended');
    const absentTile = statTile('Classes missed');
    expect(within(attendedTile).getByText('28')).toBeInTheDocument();
    expect(within(absentTile).getByText('12')).toBeInTheDocument();
    expect(within(attendedTile).getByText(/out of 40 held/i)).toBeInTheDocument();
  });

  it('uses the institutional minimum from the API, not a hard-coded 75', async () => {
    renderDashboard();

    expect(await screen.findAllByText(/80%/)).not.toHaveLength(0);
    expect(screen.queryAllByText(/75%/)).toHaveLength(0);
  });

  it('warns when the student is below the minimum', async () => {
    renderDashboard();

    expect(await screen.findByText(/you are below the required minimum/i)).toBeInTheDocument();
  });

  it('confirms compliance when the student is above the minimum', async () => {
    mocks.attendance.current = overview({
      overall: { total: 40, present: 36, absent: 4, percentage: 90 },
      subjectWise: [],
    });
    renderDashboard();

    expect(await screen.findByText(/you meet the attendance requirement/i)).toBeInTheDocument();
    expect(screen.queryByText(/subjects that need attention/i)).not.toBeInTheDocument();
  });

  it('reports how many classes are needed, using the backend calculation', async () => {
    renderDashboard();

    expect(await screen.findByText(/needs 10 more consecutive classes/i)).toBeInTheDocument();
    expect(screen.getAllByText(/data structures/i).length).toBeGreaterThan(0);
  });

  it('prompts for face enrolment when the profile is not enrolled', async () => {
    mocks.face.current = { status: 'NOT_ENROLLED', sampleCount: 0, enrolledAt: null };
    renderDashboard();

    expect(await screen.findByText(/FACE_NOT_ENROLLED/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /enrol my face/i })).toHaveAttribute(
      'href',
      '/student/face',
    );
  });

  it('surfaces an open session the student can mark right now', async () => {
    mocks.sessions.current = [
      {
        id: 'ses-9',
        subjectId: 's1',
        teacherId: 't1',
        classroomId: 'c1',
        semester: 3,
        section: 'A',
        startTime: '2026-02-11T09:00:00.000Z',
        endTime: '2026-02-11T09:15:00.000Z',
        status: 'ACTIVE',
        geofenceRadiusM: 100,
        livenessRequired: true,
        blinkRequired: true,
        maxAttempts: 3,
        createdAt: '2026-02-11T09:00:00.000Z',
        updatedAt: '2026-02-11T09:00:00.000Z',
        alreadyMarked: false,
        subject: {
          id: 's1',
          name: 'Data Structures',
          code: 'BCA301',
          departmentId: 'd1',
          courseId: null,
          semester: 3,
          credits: 4,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    ] satisfies AttendanceSession[];

    renderDashboard();

    expect(await screen.findByText(/a session is open for you now/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /verify and mark/i })).toHaveAttribute(
      'href',
      '/student/attendance',
    );
  });

  it('does not offer to mark a session that is already marked', async () => {
    mocks.sessions.current = [
      {
        id: 'ses-9',
        subjectId: 's1',
        teacherId: 't1',
        classroomId: 'c1',
        semester: 3,
        section: 'A',
        startTime: '2026-02-11T09:00:00.000Z',
        endTime: '2026-02-11T09:15:00.000Z',
        status: 'ACTIVE',
        geofenceRadiusM: 100,
        livenessRequired: true,
        blinkRequired: true,
        maxAttempts: 3,
        createdAt: '2026-02-11T09:00:00.000Z',
        updatedAt: '2026-02-11T09:00:00.000Z',
        alreadyMarked: true,
      },
    ] satisfies AttendanceSession[];

    renderDashboard();

    await waitFor(() => expect(screen.getByText(/classes attended/i)).toBeInTheDocument());
    expect(screen.queryByText(/a session is open for you now/i)).not.toBeInTheDocument();
  });

  it('warns when the face verification service is down', async () => {
    mocks.health.current = {
      status: 'degraded',
      dependencies: { database: 'ok', aiService: 'down' },
    };
    renderDashboard();

    expect(
      await screen.findByText(/face verification is temporarily unavailable/i),
    ).toBeInTheDocument();
  });

  it('renders an error state when the attendance API fails', async () => {
    mocks.attendanceError.current = new ApiError({
      message: 'Boom',
      status: 500,
      code: 'INTERNAL_ERROR',
    });
    renderDashboard();

    expect(await screen.findByText(/the server encountered an error/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('lists recent classes from the backend history', async () => {
    renderDashboard();

    expect(await screen.findByText(/room 204/i)).toBeInTheDocument();
    expect(screen.getAllByText('Data Structures').length).toBeGreaterThan(0);

    await waitFor(() => expect(document.querySelector('.activity-list')).not.toBeNull());
    const activity = document.querySelector('.activity-list') as HTMLElement;
    expect(within(activity).getByText('Present')).toBeInTheDocument();
    expect(within(activity).getAllByText(/data structures/i).length).toBeGreaterThan(0);
    expect(within(activity).getByText(/room 204/i)).toBeInTheDocument();
  });
});
