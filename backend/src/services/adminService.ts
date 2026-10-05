import { prisma } from '../db/prisma';
import { hashPassword } from '../utils/password';
import { ConflictError, NotFoundError } from '../utils/errors';
import crypto from 'crypto';

function generateDevPassword(): string {
  // Only used when an admin does not supply an explicit initial password.
  return `Temp-${crypto.randomBytes(5).toString('hex')}`;
}

// ---------------------------------------------------------------------------
// Departments / Courses / Subjects / Classrooms
// ---------------------------------------------------------------------------

export async function createDepartment(data: { name: string; code: string }) {
  return prisma.department.create({ data });
}

export async function listDepartments() {
  return prisma.department.findMany({ orderBy: { name: 'asc' } });
}

export async function createCourse(data: {
  name: string;
  code: string;
  departmentId: string;
  durationSemesters?: number;
}) {
  return prisma.course.create({ data });
}

export async function listCourses() {
  return prisma.course.findMany({ include: { department: true }, orderBy: { name: 'asc' } });
}

export async function createSubject(data: {
  name: string;
  code: string;
  departmentId: string;
  courseId?: string;
  semester: number;
  credits?: number;
}) {
  return prisma.subject.create({ data });
}

export async function listSubjects(filter: { departmentId?: string; semester?: number } = {}) {
  return prisma.subject.findMany({
    where: filter,
    include: { department: true },
    orderBy: [{ semester: 'asc' }, { name: 'asc' }],
  });
}

export async function createClassroom(data: {
  name: string;
  building?: string;
  floor?: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}) {
  return prisma.classroom.create({ data });
}

export async function listClassrooms() {
  return prisma.classroom.findMany({ orderBy: { name: 'asc' } });
}

export async function updateClassroom(
  id: string,
  data: Partial<{
    name: string;
    building: string;
    floor: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  }>,
) {
  return prisma.classroom.update({ where: { id }, data });
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export interface CreateStudentInput {
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

export async function createStudent(input: CreateStudentInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });
  if (existingUser) throw new ConflictError('A user with this email already exists', 'EMAIL_TAKEN');

  const existingCode = await prisma.student.findUnique({
    where: { studentCode: input.studentCode },
  });
  if (existingCode) throw new ConflictError('Student ID already in use', 'STUDENT_CODE_TAKEN');

  const tempPassword = input.password ?? generateDevPassword();
  const passwordHash = await hashPassword(tempPassword);

  const student = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        role: 'STUDENT',
        mustChangePassword: !input.password,
      },
    });
    const created = await tx.student.create({
      data: {
        userId: user.id,
        studentCode: input.studentCode,
        rollNumber: input.rollNumber,
        fullName: input.fullName,
        phone: input.phone,
        departmentId: input.departmentId,
        semester: input.semester,
        section: input.section,
        academicYear: input.academicYear,
      },
    });
    await tx.faceProfile.create({ data: { studentId: created.id, status: 'NOT_ENROLLED' } });
    return created;
  });

  return { student, temporaryPassword: input.password ? undefined : tempPassword };
}

export async function updateStudent(
  id: string,
  data: Partial<CreateStudentInput> & {
    status?: 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'SUSPENDED';
  },
) {
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) throw new NotFoundError('Student not found');

  const { password: _password, email, ...rest } = data;
  void _password;

  if (
    email &&
    email.toLowerCase() !== (await prisma.user.findUnique({ where: { id: student.userId } }))?.email
  ) {
    await prisma.user.update({
      where: { id: student.userId },
      data: { email: email.toLowerCase() },
    });
  }

  return prisma.student.update({ where: { id }, data: rest });
}

export async function deactivateStudent(id: string) {
  const student = await prisma.student.findUniqueOrThrow({ where: { id } });
  await prisma.user.update({ where: { id: student.userId }, data: { isActive: false } });
  return prisma.student.update({ where: { id }, data: { status: 'INACTIVE' } });
}

export async function reactivateStudent(id: string) {
  const student = await prisma.student.findUniqueOrThrow({ where: { id } });
  await prisma.user.update({ where: { id: student.userId }, data: { isActive: true } });
  return prisma.student.update({ where: { id }, data: { status: 'ACTIVE' } });
}

export async function listStudents(params: {
  page: number;
  pageSize: number;
  search?: string;
  departmentId?: string;
  semester?: number;
  section?: string;
}) {
  const where = {
    AND: [
      params.departmentId ? { departmentId: params.departmentId } : {},
      params.semester ? { semester: params.semester } : {},
      params.section ? { section: params.section } : {},
      params.search
        ? {
            OR: [
              { fullName: { contains: params.search, mode: 'insensitive' as const } },
              { studentCode: { contains: params.search, mode: 'insensitive' as const } },
              { rollNumber: { contains: params.search, mode: 'insensitive' as const } },
            ],
          }
        : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        department: true,
        faceProfile: true,
        user: { select: { email: true, isActive: true } },
      },
      orderBy: { fullName: 'asc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.student.count({ where }),
  ]);

  return { items, total, page: params.page, pageSize: params.pageSize };
}

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------

export interface CreateTeacherInput {
  email: string;
  password?: string;
  employeeCode: string;
  fullName: string;
  phone?: string;
  departmentId: string;
  designation?: string;
}

export async function createTeacher(input: CreateTeacherInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });
  if (existingUser) throw new ConflictError('A user with this email already exists', 'EMAIL_TAKEN');

  const existingCode = await prisma.teacher.findUnique({
    where: { employeeCode: input.employeeCode },
  });
  if (existingCode) throw new ConflictError('Employee ID already in use', 'EMPLOYEE_CODE_TAKEN');

  const tempPassword = input.password ?? generateDevPassword();
  const passwordHash = await hashPassword(tempPassword);

  const teacher = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        role: 'TEACHER',
        mustChangePassword: !input.password,
      },
    });
    return tx.teacher.create({
      data: {
        userId: user.id,
        employeeCode: input.employeeCode,
        fullName: input.fullName,
        phone: input.phone,
        departmentId: input.departmentId,
        designation: input.designation,
      },
    });
  });

  return { teacher, temporaryPassword: input.password ? undefined : tempPassword };
}

export async function listTeachers(params: { page: number; pageSize: number; search?: string }) {
  const where = params.search
    ? {
        OR: [
          { fullName: { contains: params.search, mode: 'insensitive' as const } },
          { employeeCode: { contains: params.search, mode: 'insensitive' as const } },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
      include: { department: true, user: { select: { email: true, isActive: true } } },
      orderBy: { fullName: 'asc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.teacher.count({ where }),
  ]);
  return { items, total, page: params.page, pageSize: params.pageSize };
}

export async function assignTeacherSubject(data: {
  teacherId: string;
  subjectId: string;
  section?: string;
}) {
  return prisma.teacherSubject.upsert({
    where: {
      teacherId_subjectId_section: {
        teacherId: data.teacherId,
        subjectId: data.subjectId,
        section: data.section ?? null,
      },
    } as never,
    create: data,
    update: {},
  });
}

export async function enrollStudentInSubject(data: { studentId: string; subjectId: string }) {
  return prisma.studentSubjectEnrollment.upsert({
    where: { studentId_subjectId: { studentId: data.studentId, subjectId: data.subjectId } },
    create: data,
    update: { active: true },
  });
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

export async function getPolicy(departmentId?: string) {
  const scope = departmentId ? 'DEPARTMENT' : 'GLOBAL';
  const policy = await prisma.attendanceRule.findUnique({
    where: { scope_departmentId: { scope, departmentId: departmentId ?? null } } as never,
  });
  if (policy) return policy;
  if (departmentId) return getPolicy(undefined);
  return prisma.attendanceRule.create({ data: { scope: 'GLOBAL' } });
}

export async function upsertPolicy(input: {
  scope: 'GLOBAL' | 'DEPARTMENT';
  departmentId?: string;
  [key: string]: unknown;
}) {
  const { scope, departmentId, ...rest } = input;
  return prisma.attendanceRule.upsert({
    where: { scope_departmentId: { scope, departmentId: departmentId ?? null } } as never,
    create: { scope, departmentId, ...rest } as never,
    update: rest as never,
  });
}

// ---------------------------------------------------------------------------
// Dashboard overview
// ---------------------------------------------------------------------------

export async function getAdminDashboard() {
  const [totalStudents, totalTeachers, totalDepartments, activeSessions, today, lowAttendance] =
    await Promise.all([
      prisma.student.count({ where: { status: 'ACTIVE' } }),
      prisma.teacher.count(),
      prisma.department.count(),
      prisma.attendanceSession.count({ where: { status: 'ACTIVE' } }),
      prisma.attendanceRecord.count({
        where: { markedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }, status: 'PRESENT' },
      }),
      computeLowAttendanceCount(),
    ]);

  return {
    totalStudents,
    totalTeachers,
    totalDepartments,
    activeSessions,
    todayAttendance: today,
    lowAttendanceStudents: lowAttendance,
  };
}

async function computeLowAttendanceCount(): Promise<number> {
  const policy = await getPolicy();
  const students = await prisma.student.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      enrollments: { select: { subjectId: true } },
    },
  });

  let lowCount = 0;
  for (const student of students) {
    const subjectIds = student.enrollments.map((e) => e.subjectId);
    if (subjectIds.length === 0) continue;
    const [present, total] = await Promise.all([
      prisma.attendanceRecord.count({
        where: {
          studentId: student.id,
          status: 'PRESENT',
          session: { subjectId: { in: subjectIds } },
        },
      }),
      prisma.attendanceRecord.count({
        where: { studentId: student.id, session: { subjectId: { in: subjectIds } } },
      }),
    ]);
    if (total > 0 && (present / total) * 100 < policy.minAttendancePercentage) lowCount += 1;
  }
  return lowCount;
}
