# SSAMS Frontend

Production React client for the **Smart Student Attendance System** — a geofenced,
face-verified attendance platform with three role-specific portals (Admin,
Teacher, Student).

Every screen talks to the real REST API exposed by `../backend` (Node + Express +
Prisma + PostgreSQL). There is **no mock database, no seeded UI data and no
localStorage persistence of application data** — PostgreSQL is the single source
of truth. Where the backend does not yet offer an endpoint, the UI says so
explicitly instead of inventing numbers; see [`API_CONTRACT.md`](./API_CONTRACT.md).

---

## Tech stack

| Concern       | Choice                                                        |
| ------------- | ------------------------------------------------------------- |
| UI            | React 18 + TypeScript (strict) + Vite 5                       |
| Styling       | Hand-written CSS3 with design tokens (no CSS framework)       |
| Routing       | React Router 6 (lazy-loaded route tree, role guards)          |
| Server state  | TanStack Query v5 (caching, invalidation, polling)            |
| HTTP          | Axios instance with auth interceptor + single-flight refresh  |
| Forms         | React Hook Form + Zod (schemas mirror the backend validators) |
| Icons         | Lucide React                                                  |
| Charts        | Recharts (every chart ships a screen-reader data table)       |
| Tests         | Vitest + React Testing Library + jsdom                        |
| Quality gates | ESLint (`--max-warnings 0`) + Prettier + `tsc --noEmit`       |

---

## Prerequisites

- **Node.js 18.18+** (20 LTS or 22 recommended) and **npm 9+**
- The backend running and reachable (default `http://localhost:4000`)
- For face verification / liveness features, the Python `ai-service` must also be
  running — the UI degrades gracefully and reports its availability from
  `GET /api/health`

Windows (PowerShell or CMD) and Linux/macOS (bash) are both first-class: every
command below is a plain `npm` script with no shell-specific syntax, no absolute
POSIX paths and no symlinks.

---

## Quick start

```bash
# 1. Install
cd frontend
npm install

# 2. Configure (only needed if your backend is not on http://localhost:4000)
#    .env.development is committed with safe defaults and contains no secrets.
#    Copy .env.example if you prefer to manage your own file.

# 3. Run the dev server (proxies /api to the backend)
npm run dev
```

Then open the printed URL (default `http://localhost:5173`).

### Demo accounts

Seed the backend database first (`cd ../backend && npx prisma migrate dev && npm run seed`),
then sign in with:

| Role    | Email                   | Password       |
| ------- | ----------------------- | -------------- |
| Admin   | `admin@ssams.dev`       | `DevPass#2026` |
| Teacher | `teacher@ssams.dev`     | `DevPass#2026` |
| Student | `aarav.mehta@ssams.dev` | `DevPass#2026` |

Five failed attempts lock an account for 15 minutes (enforced by the backend).

---

## Scripts

| Script                 | What it does                                                   |
| ---------------------- | -------------------------------------------------------------- |
| `npm run dev`          | Vite dev server on `0.0.0.0`, `/api` proxied to the backend    |
| `npm run build`        | Type-checks (`tsc --noEmit`) then produces `dist/`             |
| `npm run preview`      | Serves the production build (also proxies `/api`)              |
| `npm test`             | Runs the full Vitest suite once                                |
| `npm run test:watch`   | Vitest in watch mode                                           |
| `npm run lint`         | ESLint over `src/**/*.{ts,tsx}` with **zero** warnings allowed |
| `npm run lint:fix`     | ESLint with autofix                                            |
| `npm run typecheck`    | `tsc --noEmit`                                                 |
| `npm run format`       | Prettier **write**                                             |
| `npm run format:check` | Prettier **check** (use this in CI)                            |

All five gates are green on this branch: `lint`, `typecheck`, `test`,
`format:check`, `build`.

---

## Environment variables

Defined in `.env.example` / `.env.development`, read through `src/config/env.ts`.

| Variable                | Default                 | Notes                                                                                                                                                                               |
| ----------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_URL`          | `/api`                  | Relative by default so the dev proxy keeps auth cookies first-party. Set an absolute URL only for a cross-origin production deployment (and allow it in the backend `CORS_ORIGIN`). |
| `VITE_DEV_PROXY_TARGET` | `http://localhost:4000` | Dev/preview server only — never bundled into the browser output.                                                                                                                    |
| `PORT`                  | `5173`                  | Dev server port (preview uses `4173`).                                                                                                                                              |
| `VITE_APP_NAME`         | `Smart Attendance`      | Shown on the login page, sidebar and document title.                                                                                                                                |

> **Security note.** Anything prefixed `VITE_` is inlined into the public bundle.
> Database credentials, JWT signing secrets and API keys must never appear here —
> they belong to the backend only.

---

## Project structure

```
frontend/
├── index.html
├── vite.config.ts            # proxy, alias, manual chunks, vitest config
├── vitest.setup.ts           # jsdom polyfills (matchMedia, ResizeObserver…)
├── .env.example              # documented, secret-free defaults
├── API_CONTRACT.md           # backend contract mirror + gap register
└── src/
    ├── main.tsx / App.tsx    # providers, error boundary, router
    ├── config/env.ts         # typed access to public env
    ├── styles/               # tokens.css, base.css, layout.css,
    │                         # components.css, utilities.css, index.css
    ├── types/                # api.ts (envelope, pagination) + models.ts
    ├── services/             # api.ts (axios instance) + 12 typed modules
    ├── hooks/                # useAuth, useMediaQuery, useDebouncedValue, …
    │   └── queries/          # TanStack Query wrappers per domain
    ├── context/              # AuthProvider, ThemeProvider, ToastProvider
    ├── routes/               # paths.ts, navigation.ts, guards, AppRoutes
    ├── layouts/              # AppShell (sidebar+topbar), AuthLayout, RoleShell
    ├── validators/           # Zod schemas mirroring backend validation
    ├── utils/                # apiError, format, pagination, reportFilters, …
    ├── lib/queryClient.ts    # retry/stale-time policy
    ├── components/           # ui/ (primitives), common/, and per-domain sets
    ├── pages/                # auth/, admin/, teacher/, student/, common/, errors/
    └── test/                 # renderWithProviders test helper
```

**Data flow.** `pages/` render, `hooks/queries/` own the fetch lifecycle,
`services/` build requests and unwrap the `{ success, data }` envelope, and
`utils/apiError.ts` turns any failure into actionable copy. Components never call
`fetch`/`axios` directly.

---

## Routing and roles

Route guards are **UX only** — the backend remains the security boundary and
re-checks every request.

| Area     | Path prefix                  | Guard                    | Landing page    |
| -------- | ---------------------------- | ------------------------ | --------------- |
| Public   | `/login`                     | redirects home if authed | —               |
| Admin    | `/admin/*`                   | `RoleRoute(ADMIN)`       | `/admin`        |
| Teacher  | `/teacher/*`                 | `RoleRoute(TEACHER)`     | `/teacher`      |
| Student  | `/student/*`                 | `RoleRoute(STUDENT)`     | `/student`      |
| Any role | `/notifications`, `/profile` | `ProtectedRoute`         | —               |
| Errors   | `403`, `404`, `503`          | —                        | dedicated pages |

Key screens: admin (dashboard, students CRUD + detail/edit, teachers, subjects,
classrooms, attendance overview, reports with CSV export, policy settings, audit
log), teacher (dashboard, subjects, students, start/monitor sessions, live
roster, corrections, history), student (dashboard with real percentages, mark
attendance pipeline, history, face enrolment, profile).

---

## Design system

All colour, spacing, radius, shadow and motion values are CSS custom properties
in `src/styles/tokens.css` (`--primary`, `--surface`, `--border`, `--success`,
`--warning`, `--danger`, `--space-*`, `--radius-*`, `--duration-*`, …).

Status colours are consistent everywhere — green = present/success, red =
absent/danger, amber = late or below the attendance minimum, blue = primary
action — and **colour is never the only signal**: every status also carries a
label, dot or icon.

Dark mode is a persisted `data-theme` attribute driven by the same variables
(`ThemeProvider`), so it costs no extra component logic.

Typography uses an Inter → `system-ui` stack with a single scale
(`--text-xs` … `--text-3xl`).

---

## Responsive behaviour

Verified at 1920×1080, 1366×768, 1024×768, 768×1024, 390×844 and 360×800.

- Desktop: fixed sidebar + topbar, multi-column stat grids, full data tables.
- Tablet: sidebar collapses to icons/drawer, grids drop to two columns.
- Mobile: hamburger drawer, bottom-friendly navigation subset, tables become
  scrollable card lists, forms collapse to a single column, no horizontal
  overflow (breakpoints live in `tokens.css`; components read them through
  `useMediaQuery` / `useIsMobile` rather than calling `matchMedia` themselves).

---

## Accessibility

- Semantic landmarks, one `h1` per page, heading levels that never skip.
- Visible focus rings on every interactive element; full keyboard operation of
  dialogs (focus trap, `Esc` to close, focus restored to the trigger).
- Every icon-only button has an accessible label; icons are `aria-hidden`.
- Form errors are linked with `aria-describedby` and announced via a live region.
- Error/empty states are announced (`role="alert"` / `role="status"`).
- Charts render an equivalent `sr-only` data table; aggregates are announced
  through `LiveRegion`.

---

## Error handling and sessions

`services/api.ts` attaches the in-memory access token plus the CSRF token from
the cookie, and on `401` performs a **single-flight** `POST /auth/refresh`,
retries the original request once, and otherwise clears tokens, wipes the query
cache and routes to `/login` with a reason. `utils/apiError.ts` maps
400 / 401 / 403 / 404 / 409 / 410 / 422 / 429 / 5xx / timeout / offline to
user-facing copy and extracts per-field messages from Zod `422` payloads so forms
can highlight the exact inputs. `alert()` is never used — feedback goes through
toasts, inline `Alert`s and error states.

Mutations invalidate the relevant query keys (`services/queryKeys.ts`) so lists,
dashboards and counters refresh without a page reload.

---

## Testing

```bash
npm test
```

10 files / 110 tests covering: login form + validation, route and role guards,
student dashboard percentages (including proof that the minimum comes from the
API, not a hard-coded 75%), Zod validators, report service aggregation,
debounced search, logout/cache clearing, session expiry, and every mapped error
state.

Helpers: `src/test/renderWithProviders.tsx` (QueryClient + theme + toast +
router) and `vitest.setup.ts` (jsdom polyfills). Note that `restoreMocks: true`
is enabled, so setup-file stubs are plain functions rather than `vi.fn()`.

---

## Troubleshooting

| Symptom                                  | Fix                                                                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `Network Error` on login                 | Backend not running, or `VITE_DEV_PROXY_TARGET` points at the wrong port (the API listens on **4000**, not 5000).             |
| Logged out immediately after refresh     | Cookies are being blocked (third-party context / `SameSite`). Keep `VITE_API_URL=/api` in development.                        |
| `403 CSRF` on mutations                  | The `csrf_token` cookie is missing — usually a cross-origin deployment without `credentials: include` on the backend CORS.    |
| Face steps report the AI service is down | Start `../ai-service`; `GET /api/health` reports `dependencies.aiService` and the UI shows a banner instead of failing.       |
| Blank screen after `npm run build`       | Serve `dist/` behind a router that falls back to `index.html`, and proxy `/api` to the backend (`npm run preview` does both). |

---

## Known backend limitations

Sixteen gaps between what this UI needs and what the API currently offers are
documented — with the exact endpoint or field each one requires — in
[`API_CONTRACT.md`](./API_CONTRACT.md#backend-gaps--required-contract-changes).
Each is surfaced honestly in the product (an explanatory `Alert`, a disabled
control with a reason, or a hidden action) rather than faked.
