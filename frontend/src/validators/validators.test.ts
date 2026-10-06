import { describe, expect, it } from 'vitest';
import { changePasswordSchema, loginSchema } from './auth.schema';
import { studentSchema, toStudentPayload } from './student.schema';
import { teacherSchema, toTeacherPayload } from './teacher.schema';
import {
  assignTeacherSubjectSchema,
  classroomSchema,
  courseSchema,
  departmentSchema,
  subjectSchema,
  toClassroomPayload,
  toSubjectPayload,
} from './academic.schema';
import { correctionSchema, startSessionSchema, toStartSessionPayload } from './attendance.schema';
import { policySchema, toPolicyPayload } from './policy.schema';

/**
 * These schemas mirror the backend validators, so a value accepted here must be
 * accepted by the API (and a value rejected here must never be sent).
 */

const validStudent = {
  fullName: 'Aarav Mehta',
  email: 'aarav.mehta@ssams.dev',
  studentCode: 'BCA2024001',
  rollNumber: '01',
  phone: '+91 98765 43210',
  departmentId: 'dept-1',
  semester: 3,
  section: 'A',
  academicYear: '2024-2025',
  password: '',
};

describe('studentSchema', () => {
  it('accepts a complete valid student', () => {
    expect(studentSchema.safeParse(validStudent).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = studentSchema.safeParse({ ...validStudent, email: 'aarav@' });
    expect(result.success).toBe(false);
  });

  it('rejects a name shorter than the backend minimum', () => {
    const result = studentSchema.safeParse({ ...validStudent, fullName: 'A' });
    expect(result.success).toBe(false);
  });

  it('rejects a semester outside 1..12 and coerces numeric strings', () => {
    expect(studentSchema.safeParse({ ...validStudent, semester: 13 }).success).toBe(false);
    expect(studentSchema.safeParse({ ...validStudent, semester: 0 }).success).toBe(false);
    expect(studentSchema.safeParse({ ...validStudent, semester: '3' }).success).toBe(true);
  });

  it('rejects an academic year in the wrong format', () => {
    expect(studentSchema.safeParse({ ...validStudent, academicYear: '2024' }).success).toBe(false);
    expect(studentSchema.safeParse({ ...validStudent, academicYear: '2024-25' }).success).toBe(
      false,
    );
  });

  it('requires at least 8 characters for an explicit password but allows blank', () => {
    expect(studentSchema.safeParse({ ...validStudent, password: 'short' }).success).toBe(false);
    expect(studentSchema.safeParse({ ...validStudent, password: 'TempPass123' }).success).toBe(
      true,
    );
    expect(studentSchema.safeParse({ ...validStudent, password: '' }).success).toBe(true);
  });

  it('rejects an impossible phone number', () => {
    expect(studentSchema.safeParse({ ...validStudent, phone: 'call-me' }).success).toBe(false);
  });

  it('shapes the payload the way the API expects', () => {
    const payload = toStudentPayload({
      ...validStudent,
      email: '  Aarav.Mehta@SSAMS.dev ',
      section: 'a',
      phone: '',
      password: '',
    });

    expect(payload.email).toBe('aarav.mehta@ssams.dev');
    expect(payload.section).toBe('A');
    expect(payload.phone).toBeUndefined();
    // A blank password must be omitted so the backend generates a temporary one.
    expect(payload.password).toBeUndefined();
    expect(payload.semester).toBe(3);
  });
});

describe('teacherSchema', () => {
  const validTeacher = {
    fullName: 'Dr. Ritu Sharma',
    email: 'teacher@ssams.dev',
    employeeCode: 'EMP001',
    phone: '',
    departmentId: 'dept-1',
    designation: 'Assistant Professor',
    password: '',
  };

  it('accepts a valid teacher and rejects a missing employee code', () => {
    expect(teacherSchema.safeParse(validTeacher).success).toBe(true);
    expect(teacherSchema.safeParse({ ...validTeacher, employeeCode: '' }).success).toBe(false);
  });

  it('omits a blank password so the backend generates one', () => {
    expect(toTeacherPayload(validTeacher).password).toBeUndefined();
    expect(toTeacherPayload({ ...validTeacher, password: 'TempPass123' }).password).toBe(
      'TempPass123',
    );
  });
});

describe('academic schemas', () => {
  it('validates a subject and upper-cases its code', () => {
    const values = {
      name: 'DBMS',
      code: 'bca302',
      departmentId: 'dept-1',
      courseId: '',
      semester: 3,
      credits: 4,
    };
    expect(subjectSchema.safeParse(values).success).toBe(true);
    const payload = toSubjectPayload(values);
    expect(payload.code).toBe('BCA302');
    expect(payload.courseId).toBeUndefined();
  });

  it('rejects credits and semester outside the backend ranges', () => {
    const base = {
      name: 'DBMS',
      code: 'BCA302',
      departmentId: 'd',
      courseId: '',
      semester: 3,
      credits: 4,
    };
    expect(subjectSchema.safeParse({ ...base, credits: 11 }).success).toBe(false);
    expect(subjectSchema.safeParse({ ...base, semester: 0 }).success).toBe(false);
  });

  it('validates a department code length', () => {
    expect(departmentSchema.safeParse({ name: 'Computer Applications', code: 'CA' }).success).toBe(
      true,
    );
    expect(
      departmentSchema.safeParse({ name: 'Computer Applications', code: 'ABCDEFGHIJK' }).success,
    ).toBe(false);
  });

  it('validates a course duration', () => {
    const base = { name: 'BCA', code: 'BCA', departmentId: 'd', durationSemesters: 6 };
    expect(courseSchema.safeParse(base).success).toBe(true);
    expect(courseSchema.safeParse({ ...base, durationSemesters: 0 }).success).toBe(false);
    expect(courseSchema.safeParse({ ...base, durationSemesters: '6' }).success).toBe(true);
  });

  it('validates classroom coordinates and radius', () => {
    const room = {
      name: 'Room 204',
      building: 'Main',
      floor: '2',
      latitude: 28.6139,
      longitude: 77.209,
      radiusMeters: 100,
    };
    expect(classroomSchema.safeParse(room).success).toBe(true);
    expect(classroomSchema.safeParse({ ...room, latitude: 95 }).success).toBe(false);
    expect(classroomSchema.safeParse({ ...room, longitude: -181 }).success).toBe(false);
    expect(classroomSchema.safeParse({ ...room, radiusMeters: 4 }).success).toBe(false);
    expect(classroomSchema.safeParse({ ...room, radiusMeters: 2001 }).success).toBe(false);
    expect(toClassroomPayload({ ...room, building: '', floor: '' }).building).toBeUndefined();
  });

  it('requires both sides of a subject assignment', () => {
    expect(
      assignTeacherSubjectSchema.safeParse({ teacherId: 't', subjectId: 's', section: '' }).success,
    ).toBe(true);
    expect(
      assignTeacherSubjectSchema.safeParse({ teacherId: '', subjectId: 's', section: '' }).success,
    ).toBe(false);
  });
});

describe('startSessionSchema', () => {
  const valid = {
    subjectId: 'sub-1',
    classroomId: 'room-1',
    semester: 3,
    section: 'a',
    durationMinutes: 15,
    geofenceRadiusM: '' as const,
    livenessRequired: true,
    blinkRequired: true,
  };

  it('accepts a valid session and normalises the section', () => {
    expect(startSessionSchema.safeParse(valid).success).toBe(true);
    expect(toStartSessionPayload(valid).section).toBe('A');
    expect(toStartSessionPayload(valid).geofenceRadiusM).toBeUndefined();
  });

  it('rejects a duration outside 1..240 minutes', () => {
    expect(startSessionSchema.safeParse({ ...valid, durationMinutes: 0 }).success).toBe(false);
    expect(startSessionSchema.safeParse({ ...valid, durationMinutes: 241 }).success).toBe(false);
  });

  it('requires a subject and a classroom', () => {
    expect(startSessionSchema.safeParse({ ...valid, subjectId: '' }).success).toBe(false);
    expect(startSessionSchema.safeParse({ ...valid, classroomId: '' }).success).toBe(false);
  });
});

describe('correctionSchema', () => {
  it('enforces the audited reason the backend requires', () => {
    // The backend requires at least 5 characters of audited reason.
    expect(correctionSchema.safeParse({ newStatus: 'PRESENT', reason: 'why' }).success).toBe(false);
    expect(correctionSchema.safeParse({ newStatus: 'PRESENT', reason: '     ' }).success).toBe(
      false,
    );
    expect(
      correctionSchema.safeParse({
        newStatus: 'PRESENT',
        reason: 'Device failure during verification',
      }).success,
    ).toBe(true);
  });

  it('only accepts real attendance statuses', () => {
    expect(
      correctionSchema.safeParse({ newStatus: 'MAYBE', reason: 'valid reason here' }).success,
    ).toBe(false);
  });
});

describe('auth schemas', () => {
  it('validates the login form', () => {
    expect(
      loginSchema.safeParse({ email: 'admin@ssams.dev', password: 'DevPass#2026' }).success,
    ).toBe(true);
    expect(loginSchema.safeParse({ email: 'admin', password: 'DevPass#2026' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: '', password: '' }).success).toBe(false);
  });

  it('requires matching confirmation and a different new password', () => {
    const base = {
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
      confirmPassword: 'NewPass123',
    };
    expect(changePasswordSchema.safeParse(base).success).toBe(true);
    expect(changePasswordSchema.safeParse({ ...base, confirmPassword: 'Other123' }).success).toBe(
      false,
    );
    expect(changePasswordSchema.safeParse({ ...base, newPassword: 'OldPass123' }).success).toBe(
      false,
    );
    expect(changePasswordSchema.safeParse({ ...base, newPassword: 'short' }).success).toBe(false);
    // Must contain a letter and a number, like the backend rule.
    expect(changePasswordSchema.safeParse({ ...base, newPassword: 'allletters' }).success).toBe(
      false,
    );
  });
});

describe('policySchema', () => {
  it('validates the institutional policy and drops the department for global scope', () => {
    const values = {
      scope: 'GLOBAL' as const,
      departmentId: '',
      minAttendancePercentage: 80,
      defaultGeofenceRadiusM: 100,
      defaultSessionDurationMin: 15,
      maxVerificationAttempts: 3,
      livenessMandatory: true,
      blinkMandatory: false,
      faceMatchThreshold: 0.62,
    };

    expect(policySchema.safeParse(values).success).toBe(true);
    const payload = toPolicyPayload(values);
    expect(payload.minAttendancePercentage).toBe(80);
    expect(payload.departmentId).toBeUndefined();
    expect(payload.blinkMandatory).toBe(false);
  });

  it('rejects an out-of-range threshold', () => {
    const values = {
      scope: 'GLOBAL' as const,
      departmentId: '',
      minAttendancePercentage: 120,
      defaultGeofenceRadiusM: 100,
      defaultSessionDurationMin: 15,
      maxVerificationAttempts: 3,
      livenessMandatory: true,
      blinkMandatory: true,
      faceMatchThreshold: 0.62,
    };
    expect(policySchema.safeParse(values).success).toBe(false);
  });
});
