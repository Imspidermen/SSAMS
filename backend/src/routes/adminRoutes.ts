import { Router } from 'express';
import * as adminController from '../controllers/adminController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createDepartmentSchema,
  createCourseSchema,
  createSubjectSchema,
  createClassroomSchema,
  createStudentSchema,
  updateStudentSchema,
  createTeacherSchema,
  assignTeacherSubjectSchema,
  enrollStudentSubjectSchema,
  updatePolicySchema,
  paginationSchema,
} from '../validators/adminValidators';

const router = Router();
router.use(authenticate, authorize('ADMIN'));

router.get('/dashboard', adminController.dashboard);

router.post(
  '/departments',
  validate({ body: createDepartmentSchema }),
  adminController.createDepartment,
);
router.get('/departments', adminController.listDepartments);

router.post('/courses', validate({ body: createCourseSchema }), adminController.createCourse);
router.get('/courses', adminController.listCourses);

router.post('/subjects', validate({ body: createSubjectSchema }), adminController.createSubject);
router.get('/subjects', adminController.listSubjects);
router.post(
  '/subjects/assign-teacher',
  validate({ body: assignTeacherSubjectSchema }),
  adminController.assignTeacherSubject,
);
router.post(
  '/subjects/enroll-student',
  validate({ body: enrollStudentSubjectSchema }),
  adminController.enrollStudentSubject,
);

router.post(
  '/classrooms',
  validate({ body: createClassroomSchema }),
  adminController.createClassroom,
);
router.get('/classrooms', adminController.listClassrooms);
router.patch('/classrooms/:id', adminController.updateClassroom);

router.post('/students', validate({ body: createStudentSchema }), adminController.createStudent);
router.get('/students', validate({ query: paginationSchema }), adminController.listStudents);
router.patch(
  '/students/:id',
  validate({ body: updateStudentSchema }),
  adminController.updateStudent,
);
router.post('/students/:id/deactivate', adminController.deactivateStudent);
router.post('/students/:id/reactivate', adminController.reactivateStudent);
router.post('/students/:id/reset-face', adminController.resetStudentFace);

router.post('/teachers', validate({ body: createTeacherSchema }), adminController.createTeacher);
router.get('/teachers', validate({ query: paginationSchema }), adminController.listTeachers);

router.get('/policy', adminController.getPolicy);
router.put('/policy', validate({ body: updatePolicySchema }), adminController.updatePolicy);

router.get('/audit-logs', adminController.auditLogs);

export default router;
