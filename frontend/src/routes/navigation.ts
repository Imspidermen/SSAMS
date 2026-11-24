import {
  CalendarCheck2,
  ClipboardList,
  History,
  LayoutDashboard,
  ScanFace,
  Settings2,
  BookOpen,
  DoorOpen,
  FileBarChart,
  ScrollText,
  UserCog,
  Users,
  UserSquare2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Role } from '@/types';
import { paths } from './paths';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Match only the exact path (used for the dashboard root route). */
  end?: boolean;
  /** Key that resolves a dynamic badge count (e.g. unread notifications). */
  badge?: 'notifications' | 'activeSessions';
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

/** ADMIN navigation. */
export const adminNavigation: NavSection[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', to: paths.admin.dashboard, icon: LayoutDashboard, end: true }],
  },
  {
    label: 'People',
    items: [
      { label: 'Students', to: paths.admin.students, icon: Users },
      { label: 'Teachers', to: paths.admin.teachers, icon: UserCog },
    ],
  },
  {
    label: 'Academics',
    items: [
      { label: 'Subjects', to: paths.admin.subjects, icon: BookOpen },
      { label: 'Classrooms', to: paths.admin.classrooms, icon: DoorOpen },
    ],
  },
  {
    label: 'Attendance',
    items: [
      { label: 'Attendance', to: paths.admin.attendance, icon: CalendarCheck2 },
      { label: 'Attendance History', to: paths.admin.attendanceHistory, icon: History },
      { label: 'Reports', to: paths.admin.reports, icon: FileBarChart },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', to: paths.admin.settings, icon: Settings2 },
      { label: 'Audit Log', to: paths.admin.audit, icon: ScrollText },
      { label: 'Profile', to: paths.admin.profile, icon: UserSquare2 },
    ],
  },
];

/** TEACHER navigation. */
export const teacherNavigation: NavSection[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', to: paths.teacher.dashboard, icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Teaching',
    items: [
      { label: 'My Subjects', to: paths.teacher.subjects, icon: BookOpen },
      { label: 'Students', to: paths.teacher.students, icon: Users },
    ],
  },
  {
    label: 'Attendance',
    items: [
      { label: 'Mark Attendance', to: paths.teacher.attendance, icon: CalendarCheck2 },
      { label: 'Attendance History', to: paths.teacher.attendanceHistory, icon: History },
    ],
  },
  {
    label: 'Account',
    items: [{ label: 'Profile', to: paths.teacher.profile, icon: UserSquare2 }],
  },
];

/** STUDENT navigation. */
export const studentNavigation: NavSection[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', to: paths.student.dashboard, icon: LayoutDashboard, end: true }],
  },
  {
    label: 'My Records',
    items: [
      { label: 'My Profile', to: paths.student.profile, icon: UserSquare2 },
      { label: 'Face Enrolment', to: paths.student.face, icon: ScanFace },
      { label: 'My Attendance', to: paths.student.attendance, icon: CalendarCheck2 },
      { label: 'Attendance History', to: paths.student.attendanceHistory, icon: History },
    ],
  },
];

/** Bottom navigation shown on phones - the role's most-used destinations. */
export const mobileNavigation: Record<Role, NavItem[]> = {
  ADMIN: [
    { label: 'Dashboard', to: paths.admin.dashboard, icon: LayoutDashboard, end: true },
    { label: 'Students', to: paths.admin.students, icon: Users },
    { label: 'Attendance', to: paths.admin.attendance, icon: CalendarCheck2 },
    { label: 'Subjects', to: paths.admin.subjects, icon: BookOpen },
    { label: 'More', to: paths.admin.profile, icon: ClipboardList },
  ],
  TEACHER: [
    { label: 'Dashboard', to: paths.teacher.dashboard, icon: LayoutDashboard, end: true },
    { label: 'Mark', to: paths.teacher.attendance, icon: CalendarCheck2 },
    { label: 'Students', to: paths.teacher.students, icon: Users },
    { label: 'History', to: paths.teacher.attendanceHistory, icon: History },
    { label: 'More', to: paths.teacher.profile, icon: ClipboardList },
  ],
  STUDENT: [
    { label: 'Dashboard', to: paths.student.dashboard, icon: LayoutDashboard, end: true },
    { label: 'Attend', to: paths.student.attendance, icon: ScanFace },
    { label: 'History', to: paths.student.attendanceHistory, icon: History },
    { label: 'Profile', to: paths.student.profile, icon: UserSquare2 },
    { label: 'More', to: paths.student.attendance, icon: ClipboardList },
  ],
};

export const navigationForRole: Record<Role, NavSection[]> = {
  ADMIN: adminNavigation,
  TEACHER: teacherNavigation,
  STUDENT: studentNavigation,
};

/** Section label shown in the topbar for the current location. */
export function resolveContextLabel(role: Role | null, pathname: string): string {
  if (!role) return '';
  const sections = navigationForRole[role];

  let best: { label: string; length: number } | null = null;
  for (const section of sections) {
    for (const item of section.items) {
      const matches = item.end ? pathname === item.to : pathname.startsWith(item.to);
      if (matches && (!best || item.to.length > best.length)) {
        best = { label: item.label, length: item.to.length };
      }
    }
  }

  // Nested routes (e.g. /admin/students/:id/edit) inherit their parent label.
  if (best) return best.label;

  if (pathname.startsWith(paths.notifications)) return 'Notifications';
  return role === 'ADMIN' ? 'Administration' : role === 'TEACHER' ? 'Teaching' : 'My Account';
}

export const roleDescriptor: Record<Role, { title: string; blurb: string }> = {
  ADMIN: {
    title: 'Administration',
    blurb: 'Manage students, teachers, subjects, classrooms and attendance policy.',
  },
  TEACHER: {
    title: 'Teaching',
    blurb: 'Run verified attendance sessions and review your class records.',
  },
  STUDENT: {
    title: 'My Account',
    blurb: 'Mark attendance, enrol your face and track your percentage.',
  },
};
