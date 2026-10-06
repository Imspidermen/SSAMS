# SSAMS API Contract (frontend view)

This document is the **authoritative mirror** of the backend REST contract that
the React client is built against, plus a register of the gaps where the UI needs
something the API does not yet provide.

Source of truth: `../backend/src/routes/*.ts`, `../backend/src/services/*.ts`,
`../backend/src/validators/*.ts`, `../backend/prisma/schema.prisma`.
Client mirror: `src/types/api.ts`, `src/types/models.ts`, `src/services/*.ts`,
`src/hooks/queries/*.ts`.

Nothing in this file is aspirational: if an endpoint is listed, it exists in the
backend today. If the UI needs something that does not exist, it is listed under
[Backend gaps](#backend-gaps--required-contract-changes) and the UI degrades
visibly instead of faking data.

---

## 1. Conventions

### Base URL

All routes are mounted under `/api`. In development the Vite server proxies
`/api` → `VITE_DEV_PROXY_TARGET` (default `http://localhost:4000`) so
authentication cookies stay first-party.

### Response envelope

```jsonc
// success
{ "success": true, "data": { /* payload */ } }

// failure
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": { } } }
```

`src/services/api.ts` unwraps `data` for callers and converts `error` into an
`ApiError` (`src/utils/apiError.ts`), which also extracts per-field messages from
Zod's `details = error.flatten()` shape on `422`.

Unknown routes return `404 ROUTE_NOT_FOUND`.

### Pagination

List endpoints that paginate return:

```jsonc
{ "items": [], "total": 0, "page": 1, "pageSize": 20 }
```

`src/utils/pagination.ts` (`buildPaginationMeta`) turns that into the page-count /
range metadata the `Pagination` component renders. Query params `page` and
`pageSize` are always 1-based; changing any filter resets to page 1.

### Authentication

| Item             | Value                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Access token     | `httpOnly` cookie `access_token` (15 min) **and** a copy in `data.accessToken` held in memory only                                    |
| Refresh token    | `httpOnly` cookie `refresh_token` (7 days, `path=/api/auth`)                                                                          |
| CSRF token       | non-`httpOnly` cookie `csrf_token`, echoed back by the client on mutations                                                            |
| Cookie flags     | `sameSite=lax`, `secure` in production                                                                                                |
| Client behaviour | `withCredentials: true` + `Authorization: Bearer <in-memory token>`                                                                   |
| On `401`         | single-flight `POST /auth/refresh` → retry the original request once → else clear tokens, `queryClient.clear()`, redirect to `/login` |

No token is ever written to `localStorage`.

### Error codes used by the UI

`VALIDATION_ERROR` (422), `UNAUTHORIZED` (401), `FORBIDDEN` (403),
`NOT_FOUND` (404), `ACCOUNT_LOCKED` (423), `CONFLICT`/`ALREADY_*` (409),
`SESSION_EXPIRED` (410), `TOO_MANY_ATTEMPTS` (429), `RATE_LIMITED` (429),
`INTERNAL_ERROR` (500), `AI_SERVICE_UNAVAILABLE` (503), `NETWORK_ERROR` (0),
`TIMEOUT` (0), plus the domain codes listed in §5.

---

## 2. Endpoints

### 2.1 Auth — `/api/auth`

| Method | Path               | Roles  | Request                            | Response                                                                |
| ------ | ------------------ | ------ | ---------------------------------- | ----------------------------------------------------------------------- |
| POST   | `/login`           | public | `{ email, password }`              | `{ user: { id, email, role, name }, accessToken, csrfToken }` + cookies |
| POST   | `/refresh`         | public | – (refresh cookie)                 | same shape as `/login`                                                  |
| POST   | `/logout`          | any    | –                                  | `{ message }` + cleared cookies                                         |
| GET    | `/me`              | any    | –                                  | `{ id, email, role }` — **no `name`**                                   |
| POST   | `/change-password` | any    | `{ currentPassword, newPassword }` | `{ message }`                                                           |

Login throttling: 5 consecutive failures lock the account for 15 minutes
(`ACCOUNT_LOCKED`); 8 attempts per 15 minutes per IP return `429`.

Because `GET /me` omits the display name, the client bootstraps with
`POST /auth/refresh` first and only falls back to `/me` (+ a name derived from
the email) when the refresh cookie is unusable.

### 2.2 Students (self-service) — `/api/students`

| Method | Path                     | Roles   | Notes                                                                                                        |
| ------ | ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------ |
| GET    | `/me`                    | STUDENT | The signed-in student's profile                                                                              |
| GET    | `/me/attendance`         | STUDENT | `{ overall: { total, present, absent, percentage }, subjectWise[], history[≤200], minAttendancePercentage }` |
| GET    | `/me/attendance/history` | STUDENT | Up to 500 records, each including `session.{subject, classroom, teacher}`                                    |

Neither endpoint accepts query params — filtering/pagination of the student
history happens client-side over the returned window (stated in the UI).

`subjectWise[]` entries:
`{ subjectId, subjectName, subjectCode, present, absent, total, percentage, belowThreshold, classesNeededForTarget }`.

Attendance percentage semantics (identical on client and server):
`PRESENT` + `LATE` count as attended, `percentage = round(present / total * 1000) / 10`.
**The minimum percentage always comes from `minAttendancePercentage` / the policy
endpoint — never from a constant in the UI.**

### 2.3 Teacher — `/api/teacher`

| Method | Path         | Roles   | Response                                                                                                                                                               |
| ------ | ------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/dashboard` | TEACHER | `{ teacher, activeSessions, totalSessionsToday, subjectCount, recentSessions[≤10] }` — each recent session includes `subject`, `classroom`, `_count.attendanceRecords` |
| GET    | `/subjects`  | TEACHER | `TeacherSubject[]` (subjects assigned to the caller)                                                                                                                   |

That is the whole `/teacher` surface; teachers reach sessions through
`/attendance` and reporting through `/reports`.

### 2.4 Admin — `/api/admin`

| Method   | Path                       | Params / body                                                                                         | Notes                                                                                                        |
| -------- | -------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| GET      | `/dashboard`               | –                                                                                                     | `{ totalStudents, totalTeachers, totalDepartments, activeSessions, todayAttendance, lowAttendanceStudents }` |
| GET/POST | `/departments`             | `{ name, code }`                                                                                      | no update/delete route                                                                                       |
| GET/POST | `/courses`                 | `{ name, code, departmentId }`                                                                        | no update/delete route                                                                                       |
| GET/POST | `/subjects`                | filters `departmentId`, `semester`; body `{ name, code, departmentId, courseId?, semester, credits }` | no update/delete route                                                                                       |
| GET/POST | `/classrooms`              | body `{ name, building?, floor?, latitude, longitude, radiusMeters }`                                 | **list is ADMIN-only**; `PATCH /classrooms/:id` exists                                                       |
| GET/POST | `/teachers`                | `?page&pageSize&search`; body `{ fullName, email, employeeCode?, phone?, departmentId? }`             | returns `{ student?, temporaryPassword? }`-style temp credential for students only                           |
| GET      | `/students`                | `?page&pageSize(max 100, default 20)&search&departmentId&semester&section`                            | server-side search + filters                                                                                 |
| POST     | `/students`                | student payload                                                                                       | `{ student, temporaryPassword? }` (`Temp-<hex>`, `mustChangePassword`)                                       |
| PATCH    | `/students/:id`            | partial student payload                                                                               | –                                                                                                            |
| POST     | `/students/:id/deactivate` | –                                                                                                     | status → `INACTIVE`                                                                                          |
| POST     | `/students/:id/reactivate` | –                                                                                                     | status → `ACTIVE`                                                                                            |
| POST     | `/students/:id/reset-face` | –                                                                                                     | clears the face profile                                                                                      |
| POST     | `/subjects/assign-teacher` | `{ teacherId, subjectId, section? }`                                                                  | –                                                                                                            |
| POST     | `/subjects/enroll-student` | `{ subjectId, studentId }`                                                                            | –                                                                                                            |
| GET/PUT  | `/policy`                  | `?departmentId`; body = policy fields                                                                 | `scope: GLOBAL \| DEPARTMENT`                                                                                |
| GET      | `/audit-logs`              | `?page&pageSize(default 50, max 200)`                                                                 | **no filters** (search/actor/action are client-side)                                                         |

Validation mirrors `src/validators/*`: codes are 2–10 chars (upper-cased), names
≥ 2 chars, semester 1–12, credits 1–10, geofence radius 5–2000 m (default 100).

### 2.5 Attendance — `/api/attendance`

**Teacher**

| Method | Path                 | Body / params                                                                                                          | Notes                                                                                                                                                                                                                 |
| ------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/sessions`          | `{ subjectId, classroomId, semester, section, durationMinutes?, geofenceRadiusM?, livenessRequired?, blinkRequired? }` | `403 NOT_ASSIGNED` if the teacher does not teach the subject                                                                                                                                                          |
| POST   | `/sessions/:id/stop` | –                                                                                                                      | ends an ACTIVE session                                                                                                                                                                                                |
| GET    | `/sessions/teacher`  | `?status=` (≤100, `startTime desc`)                                                                                    | stale ACTIVE sessions are auto-expired by the query                                                                                                                                                                   |
| GET    | `/sessions/:id/live` | –                                                                                                                      | `{ session, roster[{ studentId, studentCode, rollNumber, fullName, status, markedAt }], presentCount, totalCount }`; works for ENDED sessions; `status` defaults to `ABSENT`; **roster rows carry no `attendanceId`** |
| POST   | `/correct`           | `{ attendanceId, newStatus, reason(≥5 chars) }`                                                                        | admin/teacher correction with an audit trail                                                                                                                                                                          |

**Student**

| Method | Path              | Body                                                            | Response                                                                                                                                     |
| ------ | ----------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/sessions`       | –                                                               | eligible ACTIVE sessions, each with `alreadyMarked`                                                                                          |
| POST   | `/location-check` | `{ sessionId, latitude, longitude, accuracyMeters, timestamp }` | `{ verificationId, distanceMeters, allowedRadiusMeters, challengeSequence, livenessRequired, blinkRequired, expiresAt, faceMatchThreshold }` |
| POST   | `/face/verify`    | `{ verificationId, image }` (base64)                            | `{ verified, similarity, threshold }`                                                                                                        |
| POST   | `/liveness`       | `{ verificationId, frames[3..40] }`                             | `{ verified }`                                                                                                                               |
| POST   | `/blink`          | `{ verificationId, frames[3..40] }`                             | `{ verified }`                                                                                                                               |
| POST   | `/mark`           | `{ verificationId }`                                            | the created `AttendanceRecord`                                                                                                               |

Verification sessions expire after 5 minutes; a student may attempt the pipeline
20 times per 10 minutes (`429 TOO_MANY_ATTEMPTS`). `challengeSequence` is
`['TURN_LEFT' | 'TURN_RIGHT' (shuffled), 'BLINK']`.

### 2.6 Face — `/api/face`

| Method | Path                | Roles   | Body / response                                                                                                                                  |
| ------ | ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/enroll`           | STUDENT | `{ images: base64[3..10] }` → `{ status, sampleCount }`; rejects dark/bright frames, quality < 0.35, multiple faces; `409` if already `ENROLLED` |
| GET    | `/status`           | STUDENT | `{ status, sampleCount, enrolledAt }`                                                                                                            |
| POST   | `/reset/:studentId` | ADMIN   | clears the profile                                                                                                                               |

### 2.7 Notifications — `/api/notifications`

| Method | Path        | Body | Notes                                     |
| ------ | ----------- | ---- | ----------------------------------------- |
| GET    | `/`         | –    | `{ items[≤50], unreadCount }` — poll only |
| POST   | `/:id/read` | –    | marks one read                            |
| POST   | `/read-all` | –    | marks everything read                     |

### 2.8 Reports — `/api/reports` (ADMIN, TEACHER)

| Method | Path          | Params                                                                            | Notes                                                                       |
| ------ | ------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| GET    | `/attendance` | `from`, `to`, `subjectId`, `departmentId`, `studentId`, `teacherId`, `format=csv` | ≤ 5000 rows, `markedAt desc`. With `format=csv` returns a real CSV download |

CSV columns: `date, time, studentCode, rollNumber, studentName, department,
subjectCode, subjectName, classroom, teacher, status, faceVerified,
livenessVerified, blinkVerified, locationVerified, faceScore,
distanceFromCenterM`.

There is **no `status` filter and no free-text search param**, so status/text
filtering is applied client-side over the fetched rows and the UI says so.
`teacherId` is **not** forced server-side for TEACHER callers, so every teacher
view in this client explicitly passes its own `teacherId`.

Row shape (`ReportRow`): the fields above plus `attendanceId`, `faceScore`,
`distanceFromCenterM` — and **no student UUID**, which is why report aggregation
keys on `studentCode`.

### 2.9 Health — `/api/health`

`{ status: 'ok', dependencies: { database, aiService } }` — used by the login
page and by the student pipeline to warn before attempting biometric steps.

---

## 3. Domain enums

| Enum                 | Values                                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `Role`               | `ADMIN`, `TEACHER`, `STUDENT`                                                                                                                  |
| `StudentStatus`      | `ACTIVE`, `INACTIVE`, `GRADUATED`, `SUSPENDED`                                                                                                 |
| `FaceProfileStatus`  | `NOT_ENROLLED`, `PENDING`, `ENROLLED`, `RESET`                                                                                                 |
| `SessionStatus`      | `SCHEDULED`, `ACTIVE`, `ENDED`, `CANCELLED`                                                                                                    |
| `AttendanceStatus`   | `PRESENT`, `ABSENT`, `LATE`, `EXCUSED`                                                                                                         |
| `VerificationStatus` | `IN_PROGRESS`, `COMPLETED`, `EXPIRED`, `FAILED`                                                                                                |
| `PolicyScope`        | `GLOBAL`, `DEPARTMENT`                                                                                                                         |
| `NotificationType`   | `ATTENDANCE_SUCCESS`, `ATTENDANCE_FAILED`, `LOW_ATTENDANCE`, `ATTENDANCE_REMINDER`, `SESSION_STARTED`, `SESSION_ENDING`, `SYSTEM_NOTIFICATION` |

Identifiers are UUIDs. `AttendanceRecord` is unique on `(sessionId, studentId)`.

---

## 4. How the UI consumes this

| Client module                                         | Endpoints                                              |
| ----------------------------------------------------- | ------------------------------------------------------ |
| `services/auth.service.ts`                            | `/auth/*`                                              |
| `services/student.service.ts`                         | `/students/me*`                                        |
| `services/teacher.service.ts`                         | `/teacher/*`                                           |
| `services/admin.service.ts`                           | `/admin/*`                                             |
| `services/attendance.service.ts`                      | `/attendance/*`                                        |
| `services/face.service.ts`                            | `/face/*`                                              |
| `services/notification.service.ts`                    | `/notifications*`                                      |
| `services/report.service.ts`                          | `/reports/attendance` (+ CSV blob, client aggregation) |
| `services/health.service.ts`                          | `/health`                                              |
| `services/subject.service.ts`, `dashboard.service.ts` | subject/department/course lookups, dashboard stats     |

Query keys live in `services/queryKeys.ts`; mutations invalidate exactly the keys
they affect (e.g. `queryKeys.reports.attendance` is a _function_, so report
mutations invalidate `reports.attendanceAll`).

---

## 5. Backend gaps — required contract changes

Each item states what the UI needs, the smallest backend change that would
provide it, and what the UI does **today** instead. No item is papered over with
mock data.

| #   | Need                                                                       | Required backend contract                                                                                      | Current UI behaviour                                                                                                                                            |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Profile photo upload/display                                               | `POST /students/:id/photo` (multipart) + `photoUrl` on `Student`/`User`, or a `GET /users/:id/avatar` endpoint | No photo field exists, so profiles show a deterministic initials `Avatar` and the student's real **face enrolment** sample count instead                        |
| 2   | Teacher marks attendance for a whole class manually                        | `POST /attendance/sessions/:id/records` accepting `[{ studentId, status }]`                                    | Not offered. The product is self-service: students verify themselves inside a teacher-opened session                                                            |
| 3   | Detail views for a single entity                                           | `GET /admin/students/:id`, `GET /admin/teachers/:id`, `GET /admin/subjects/:id`                                | Detail pages resolve the record from the already-fetched list (and refetch the list), never from a fake store                                                   |
| 4   | Edit / deactivate a teacher                                                | `updateTeacherSchema` exists but is unrouted — add `PATCH /admin/teachers/:id` (+ deactivate/reactivate)       | Teacher edit is hidden; only create + list + subject assignment are exposed                                                                                     |
| 5   | Delete for any entity                                                      | Soft-delete routes (`DELETE` or `status` transitions) with FK handling                                         | Destructive actions are absent; students use deactivate/reactivate, which the API does support                                                                  |
| 6   | Student fields: parent/guardian name, blood group, enrolment number, class | Columns on `Student` + accept them in create/update validators                                                 | Mapped to the fields that exist: `studentCode`, department, semester, section, academic year                                                                    |
| 7   | Update subjects / departments / courses                                    | `PATCH /admin/subjects/:id`, `/departments/:id`, `/courses/:id`                                                | Those screens are read-only with create + teacher assignment/enrolment                                                                                          |
| 8   | Filtered attendance history for admin/teacher                              | `GET /attendance/history` with `studentId`/`subjectId`/`status`/date filters and pagination                    | Derived from `GET /reports/attendance` with client-side status/text filters (labelled as such)                                                                  |
| 9   | Filterable audit log                                                       | `actorId`, `action`, `entity`, `from`, `to` params on `GET /admin/audit-logs`                                  | Server pagination only; search/actor/action filtering is client-side over the current page                                                                      |
| 10  | Admin list of active sessions                                              | `GET /admin/sessions?status=ACTIVE`                                                                            | Dashboard shows the `activeSessions` **count** only; no drill-down list                                                                                         |
| 11  | PDF export                                                                 | `format=pdf` on `/reports/attendance` or a dedicated export endpoint                                           | Only the real CSV endpoint is wired; there is no "Export PDF" button anywhere                                                                                   |
| 12  | Real-time notifications                                                    | WebSocket/SSE channel, plus pagination beyond the 50-item cap                                                  | Polled with TanStack Query refetch intervals; unread badge from `unreadCount`                                                                                   |
| 13  | Face/liveness/blink without the Python service                             | The `ai-service` must be running (`/verify-face`, `/liveness-analysis`, `/blink-analysis`)                     | `GET /api/health` drives an explicit banner and the pipeline blocks with `AI_SERVICE_UNAVAILABLE` copy instead of simulating a match                            |
| 14  | `attendanceId` in the live roster                                          | Include `attendanceId` (and `recordId`) in `GET /attendance/sessions/:id/live` roster rows                     | Teacher corrections are enabled only for rows that carry an id; otherwise an honest `Alert` explains that corrections must be made from the history/report view |
| 15  | Teacher-readable classroom list                                            | Allow TEACHER on `GET /admin/classrooms`, or add `GET /teacher/classrooms`                                     | Classrooms for "start session" are derived from `GET /teacher/dashboard → recentSessions[].classroom`, with a manual classroom-id fallback                      |
| 16  | Teacher-scoped reports                                                     | Force `teacherId = caller` for TEACHER on `GET /reports/attendance` (currently only ADMIN\|TEACHER is checked) | Every teacher-facing report query explicitly passes the signed-in teacher's id so a teacher can never see another's data                                        |

Also worth noting: `GET /students/me/attendance*` accept no query params
(so date-range filtering of a student's own history is client-side over the
returned window), and `GET /teacher/subjects` returns no enrolled-student list
outside a live session — gap #15's sibling, handled the same honest way.
