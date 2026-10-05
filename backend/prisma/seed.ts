/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

// NOTE: These are DEVELOPMENT-ONLY seed accounts for local testing.
// They must never be used in a production deployment. Change or remove
// this script's output before deploying.
const DEV_PASSWORD = 'DevPass#2026';

async function main() {
  console.log('Seeding development data...');

  const department = await prisma.department.upsert({
    where: { code: 'CA' },
    update: {},
    create: { name: 'Computer Applications', code: 'CA' },
  });

  const course = await prisma.course.upsert({
    where: { code: 'BCA' },
    update: {},
    create: {
      name: 'Bachelor of Computer Applications',
      code: 'BCA',
      departmentId: department.id,
      durationSemesters: 6,
    },
  });

  const subjectDS = await prisma.subject.upsert({
    where: { code: 'BCA301' },
    update: {},
    create: {
      name: 'Data Structures',
      code: 'BCA301',
      departmentId: department.id,
      courseId: course.id,
      semester: 3,
      credits: 4,
    },
  });

  const subjectDBMS = await prisma.subject.upsert({
    where: { code: 'BCA302' },
    update: {},
    create: {
      name: 'Database Management Systems',
      code: 'BCA302',
      departmentId: department.id,
      courseId: course.id,
      semester: 3,
      credits: 4,
    },
  });

  const classroom = await prisma.classroom.upsert({
    where: { id: 'seed-room-204' },
    update: {},
    create: {
      id: 'seed-room-204',
      name: 'Room 204',
      building: 'Main Block',
      floor: '2nd Floor',
      latitude: 28.6139,
      longitude: 77.209,
      radiusMeters: 100,
    },
  });

  await prisma.attendanceRule.upsert({
    where: { scope_departmentId: { scope: 'GLOBAL', departmentId: null } } as never,
    update: {},
    create: {
      scope: 'GLOBAL',
      minAttendancePercentage: 75,
      defaultGeofenceRadiusM: 100,
      defaultSessionDurationMin: 15,
      maxVerificationAttempts: 3,
      livenessMandatory: true,
      blinkMandatory: true,
      faceMatchThreshold: 0.62,
    },
  });

  const adminPasswordHash = await hashPassword(DEV_PASSWORD);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@ssams.dev' },
    update: {},
    create: { email: 'admin@ssams.dev', passwordHash: adminPasswordHash, role: 'ADMIN' },
  });
  await prisma.admin.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: { userId: adminUser.id, fullName: 'System Administrator' },
  });

  const teacherPasswordHash = await hashPassword(DEV_PASSWORD);
  const teacherUser = await prisma.user.upsert({
    where: { email: 'teacher@ssams.dev' },
    update: {},
    create: { email: 'teacher@ssams.dev', passwordHash: teacherPasswordHash, role: 'TEACHER' },
  });
  const teacher = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: {
      userId: teacherUser.id,
      employeeCode: 'EMP001',
      fullName: 'Dr. Ritu Sharma',
      departmentId: department.id,
      designation: 'Assistant Professor',
    },
  });

  await prisma.teacherSubject.upsert({
    where: {
      teacherId_subjectId_section: { teacherId: teacher.id, subjectId: subjectDS.id, section: 'A' },
    } as never,
    update: {},
    create: { teacherId: teacher.id, subjectId: subjectDS.id, section: 'A' },
  });
  await prisma.teacherSubject.upsert({
    where: {
      teacherId_subjectId_section: {
        teacherId: teacher.id,
        subjectId: subjectDBMS.id,
        section: 'A',
      },
    } as never,
    update: {},
    create: { teacherId: teacher.id, subjectId: subjectDBMS.id, section: 'A' },
  });

  const studentSeeds = [
    { code: 'BCA2024001', roll: '01', name: 'Aarav Mehta', email: 'aarav.mehta@ssams.dev' },
    { code: 'BCA2024002', roll: '02', name: 'Diya Kapoor', email: 'diya.kapoor@ssams.dev' },
    { code: 'BCA2024003', roll: '03', name: 'Kabir Singh', email: 'kabir.singh@ssams.dev' },
  ];

  for (const s of studentSeeds) {
    const passwordHash = await hashPassword(DEV_PASSWORD);
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: { email: s.email, passwordHash, role: 'STUDENT' },
    });
    const student = await prisma.student.upsert({
      where: { studentCode: s.code },
      update: {},
      create: {
        userId: user.id,
        studentCode: s.code,
        rollNumber: s.roll,
        fullName: s.name,
        departmentId: department.id,
        semester: 3,
        section: 'A',
        academicYear: '2024-2025',
      },
    });
    await prisma.faceProfile.upsert({
      where: { studentId: student.id },
      update: {},
      create: { studentId: student.id, status: 'NOT_ENROLLED' },
    });
    await prisma.studentSubjectEnrollment.upsert({
      where: { studentId_subjectId: { studentId: student.id, subjectId: subjectDS.id } },
      update: {},
      create: { studentId: student.id, subjectId: subjectDS.id },
    });
    await prisma.studentSubjectEnrollment.upsert({
      where: { studentId_subjectId: { studentId: student.id, subjectId: subjectDBMS.id } },
      update: {},
      create: { studentId: student.id, subjectId: subjectDBMS.id },
    });
  }

  console.log('\nSeed complete. DEVELOPMENT credentials (do not use in production):');
  console.log('  Admin   -> admin@ssams.dev / ' + DEV_PASSWORD);
  console.log('  Teacher -> teacher@ssams.dev / ' + DEV_PASSWORD);
  console.log(
    '  Student -> aarav.mehta@ssams.dev / ' + DEV_PASSWORD,
    '(and 2 more students, same password)',
  );
  console.log(
    '\nStudents must complete face enrollment (Register My Face) before marking attendance.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
