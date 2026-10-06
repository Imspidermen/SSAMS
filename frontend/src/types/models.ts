/**
 * Domain models. Field names and casing match the Prisma schema in
 * `backend/prisma/schema.prisma` and the JSON the controllers return.
 * All timestamps arrive as ISO-8601 strings over HTTP.
 */

export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';

export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'SUSPENDED';

export type FaceProfileStatus = 'NOT_ENROLLED' | 'PENDING' | 'ENROLLED' | 'RESET';

export type SessionStatus = 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export type VerificationSessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED' | 'FAILED';

export type PolicyScope = 'GLOBAL' | 'DEPARTMENT';

export type NotificationType =
  | 'ATTENDANCE_SUCCESS'
  | 'ATTENDANCE_FAILED'
  | 'LOW_ATTENDANCE'
  | 'ATTENDANCE_REMINDER'
  | 'SESSION_STARTED'
  | 'SESSION_ENDING'
  | 'SYSTEM_NOTIFICATION';

/** Liveness challenge steps issued by the backend verification service. */
export type ChallengeStep = 'TURN_LEFT' | 'TURN_RIGHT' | 'BLINK';

/* ------------------------------------------------------------------------- */
/* Identity                                                                   */
/* ------------------------------------------------------------------------- */

/** Full user object returned by POST /auth/login and POST /auth/refresh. */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  name: string;
}

/** Slimmer user object returned by GET /auth/me (JWT payload only). */
export interface SessionUser {
  id: string;
  role: Role;
  email: string;
}

export interface AuthTokens {
  user: AuthUser;
  accessToken: string;
  csrfToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/* ------------------------------------------------------------------------- */
/* Academic structure                                                         */
/* ------------------------------------------------------------------------- */

export interface Department {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  durationSemesters: number;
  createdAt: string;
  updatedAt: string;
  department?: Department;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  courseId: string | null;
  semester: number;
  credits: number;
  createdAt: string;
  updatedAt: string;
  department?: Department;
  course?: Course | null;
}

export interface Classroom {
  id: string;
  name: string;
  building: string | null;
  floor: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------------- */
/* People                                                                     */
/* ------------------------------------------------------------------------- */

export interface FaceProfile {
  id: string;
  studentId: string;
  status: FaceProfileStatus;
  sampleCount: number;
  enrolledAt: string | null;
  resetAt: string | null;
  resetBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentUserRef {
  email: string;
  isActive?: boolean;
}

export interface Student {
  id: string;
  userId: string;
  /** Human readable student ID (unique). */
  studentCode: string;
  rollNumber: string;
  fullName: string;
  phone: string | null;
  departmentId: string;
  semester: number;
  section: string;
  academicYear: string;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
  department?: Department;
  faceProfile?: FaceProfile | null;
  user?: StudentUserRef;
}

export interface Teacher {
  id: string;
  userId: string;
  employeeCode: string;
  fullName: string;
  phone: string | null;
  departmentId: string;
  designation: string | null;
  createdAt: string;
  updatedAt: string;
  department?: Department;
  user?: StudentUserRef;
}

export interface AdminProfile {
  id: string;
  userId: string;
  fullName: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherSubject {
  id: string;
  teacherId: string;
  subjectId: string;
  section: string | null;
  assignedAt: string;
  subject?: Subject;
}

export interface StudentSubjectEnrollment {
  id: string;
  studentId: string;
  subjectId: string;
  active: boolean;
  enrolledAt: string;
  subject?: Subject;
}

/* ------------------------------------------------------------------------- */
/* Attendance                                                                 */
/* ------------------------------------------------------------------------- */

export interface AttendanceSession {
  id: string;
  subjectId: string;
  teacherId: string;
  classroomId: string;
  semester: number;
  section: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  geofenceRadiusM: number | null;
  livenessRequired: boolean;
  blinkRequired: boolean;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  subject?: Subject;
  classroom?: Classroom;
  teacher?: Teacher;
  /** Present on GET /attendance/sessions (student view). */
  alreadyMarked?: boolean;
  _count?: { attendanceRecords: number };
}

export interface AttendanceCorrection {
  id: string;
  attendanceId: string;
  originalStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  reason: string;
  correctedByTeacherId: string | null;
  createdAt: string;
  teacher?: Teacher | null;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  markedAt: string;
  faceVerified: boolean;
  faceScore: number | null;
  livenessVerified: boolean;
  blinkVerified: boolean;
  locationVerified: boolean;
  locationAccuracyM: number | null;
  distanceFromCenterM: number | null;
  verificationMetadata: unknown;
  createdAt: string;
  updatedAt: string;
  session?: AttendanceSession;
  student?: Student;
  correction?: AttendanceCorrection | null;
}

/** Live roster row from GET /attendance/sessions/:id/live. */
export interface RosterEntry {
  studentId: string;
  studentCode: string;
  rollNumber: string;
  fullName: string;
  status: AttendanceStatus;
  markedAt: string | null;
  /**
   * Id of the AttendanceRecord for this student in this session.
   *
   * The backend's live roster does not currently include it, so corrections
   * (POST /attendance/correct, which is keyed by `attendanceId`) cannot be
   * issued from the roster yet. The UI enables the correction control only when
   * this field is present - see the required addition in API_CONTRACT.md.
   */
  attendanceId?: string | null;
}

export interface LiveAttendance {
  session: AttendanceSession;
  roster: RosterEntry[];
  presentCount: number;
  totalCount: number;
}

/* ------------------------------------------------------------------------- */
/* Verification pipeline (student self-service attendance)                    */
/* ------------------------------------------------------------------------- */

export interface LocationCheckRequest {
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestamp: number;
}

export interface LocationCheckResult {
  verificationId: string;
  distanceMeters: number;
  allowedRadiusMeters: number;
  challengeSequence: ChallengeStep[];
  livenessRequired: boolean;
  blinkRequired: boolean;
  expiresAt: string;
  faceMatchThreshold: number;
}

export interface FaceVerifyResult {
  verified: boolean;
  similarity: number;
  threshold: number;
}

export interface VerifiedStepResult {
  verified: boolean;
}

export interface FaceStatus {
  status: FaceProfileStatus;
  sampleCount: number;
  enrolledAt: string | null;
}

export interface StartSessionRequest {
  subjectId: string;
  classroomId: string;
  semester: number;
  section: string;
  durationMinutes?: number;
  geofenceRadiusM?: number;
  livenessRequired?: boolean;
  blinkRequired?: boolean;
}

export interface CorrectAttendanceRequest {
  attendanceId: string;
  newStatus: AttendanceStatus;
  reason: string;
}

/* ------------------------------------------------------------------------- */
/* Student self-service read models                                           */
/* ------------------------------------------------------------------------- */

export interface OverallAttendance {
  total: number;
  present: number;
  absent: number;
  percentage: number;
}

export interface SubjectAttendanceSummary {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  present: number;
  absent: number;
  total: number;
  percentage: number;
  belowThreshold: boolean;
  /** Consecutive future classes needed to reach the required percentage. */
  classesNeededForTarget: number;
}

export interface StudentAttendanceOverview {
  overall: OverallAttendance;
  subjectWise: SubjectAttendanceSummary[];
  history: AttendanceRecord[];
  minAttendancePercentage: number;
}

/* ------------------------------------------------------------------------- */
/* Dashboards                                                                 */
/* ------------------------------------------------------------------------- */

export interface AdminDashboard {
  totalStudents: number;
  totalTeachers: number;
  totalDepartments: number;
  activeSessions: number;
  /** Count of PRESENT records marked today. */
  todayAttendance: number;
  lowAttendanceStudents: number;
}

export interface TeacherDashboard {
  teacher: Teacher;
  activeSessions: number;
  totalSessionsToday: number;
  subjectCount: number;
  recentSessions: AttendanceSession[];
}

/* ------------------------------------------------------------------------- */
/* Policy / notifications / audit                                             */
/* ------------------------------------------------------------------------- */

export interface AttendancePolicy {
  id: string;
  scope: PolicyScope;
  departmentId: string | null;
  minAttendancePercentage: number;
  defaultGeofenceRadiusM: number;
  defaultSessionDurationMin: number;
  maxVerificationAttempts: number;
  livenessMandatory: boolean;
  blinkMandatory: boolean;
  faceMatchThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePolicyRequest {
  scope: PolicyScope;
  departmentId?: string;
  minAttendancePercentage?: number;
  defaultGeofenceRadiusM?: number;
  defaultSessionDurationMin?: number;
  maxVerificationAttempts?: number;
  livenessMandatory?: boolean;
  blinkMandatory?: boolean;
  faceMatchThreshold?: number;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  metadata: unknown;
  createdAt: string;
}

export interface NotificationList {
  items: AppNotification[];
  unreadCount: number;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user?: { email: string; role: Role } | null;
}

/* ------------------------------------------------------------------------- */
/* Reports                                                                    */
/* ------------------------------------------------------------------------- */

export interface ReportRow {
  date: string;
  time: string;
  studentCode: string;
  rollNumber: string;
  studentName: string;
  department: string;
  subjectCode: string;
  subjectName: string;
  classroom: string;
  teacher: string;
  status: AttendanceStatus;
  faceVerified: boolean;
  livenessVerified: boolean;
  blinkVerified: boolean;
  locationVerified: boolean;
  faceScore: number | string;
  distanceFromCenterM: number | string;
}

export interface ReportFilters {
  from?: string;
  to?: string;
  subjectId?: string;
  departmentId?: string;
  studentId?: string;
  teacherId?: string;
}

/* ------------------------------------------------------------------------- */
/* Create / update payloads                                                   */
/* ------------------------------------------------------------------------- */

export interface CreateStudentRequest {
  email: string;
  password?: string;
  studentCode: string;
  rollNumber: string;
  fullName: string;
  phone?: string;
  departmentId: string;
  semester: number;
  section: string;
  academicYear: string;
}

export type UpdateStudentRequest = Partial<CreateStudentRequest> & {
  status?: StudentStatus;
};

/** POST /admin/students returns the student plus the generated password. */
export interface CreateStudentResult {
  student: Student;
  temporaryPassword?: string;
}

export interface CreateTeacherRequest {
  email: string;
  password?: string;
  employeeCode: string;
  fullName: string;
  phone?: string;
  departmentId: string;
  designation?: string;
}

export interface CreateTeacherResult {
  teacher: Teacher;
  temporaryPassword?: string;
}

export interface CreateSubjectRequest {
  name: string;
  code: string;
  departmentId: string;
  courseId?: string;
  semester: number;
  credits?: number;
}

export interface CreateDepartmentRequest {
  name: string;
  code: string;
}

export interface CreateCourseRequest {
  name: string;
  code: string;
  departmentId: string;
  durationSemesters?: number;
}

export interface CreateClassroomRequest {
  name: string;
  building?: string;
  floor?: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}

export type UpdateClassroomRequest = Partial<CreateClassroomRequest>;

export interface AssignTeacherSubjectRequest {
  teacherId: string;
  subjectId: string;
  section?: string;
}

export interface EnrollStudentSubjectRequest {
  studentId: string;
  subjectId: string;
}
