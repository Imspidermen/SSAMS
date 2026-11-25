# SSAMS — Smart Student Attendance Management System

A geofenced, **face-verified** student attendance platform with three role-specific
portals (Admin, Teacher, Student). The system is built from three cooperating parts:

| Part                                      | Stack                                              |
| ------------------------------------------ | -------------------------------------------------- |
| `frontend/`                                | React 18 + TypeScript (strict) + Vite              |
| `backend/`                                 | Node.js + Express + Prisma + PostgreSQL            |
| `ai-service/`                              | Python + FastAPI + MediaPipe (CPU-only face CV)    |

Every screen talks to a **real REST API backed by PostgreSQL** — there is no mock
database, no seeded UI data and no `localStorage` persistence of application data.

## ▶️ One-command startup (production)

```bash
npm start
```

This builds the frontend and backend, serves the built SPA from the backend on a single
origin/port, runs the AI service, applies database migrations, and opens a **public
Cloudflare/ngrok tunnel** — all in one terminal. See **[START.md](./START.md)** for the
full walkthrough, configuration, the public-link setup, dev mode, and the Docker path.

```bash
npm run dev      # one terminal for the live-reload dev stack
```

## Repository layout

```
SSAMS/
├── frontend/        # React/TS SPA (Vite). Talks to the API via /api.
├── backend/         # Express + Prisma API; in production also serves the SPA.
├── ai-service/      # FastAPI CV microservice (face / liveness / blink).
├── scripts/         # One-command launcher (start.js), tunnel.js, db helper.
├── docker-compose.yml
├── START.md         # How to run it all with one command (production).
└── README.md
```

- **Frontend docs:** [`frontend/README.md`](./frontend/README.md) · API contract: [`frontend/API_CONTRACT.md`](./frontend/API_CONTRACT.md)
- **AI service docs:** [`ai-service/README.md`](./ai-service/README.md)

## Requirements

- Node.js 18.18+ and npm 9+
- Python 3.10+ (a virtualenv is created automatically)
- A PostgreSQL database (`DATABASE_URL`). A local one can be started with `npm run db:local`.
- For face/liveness: the system OpenGL library (`apt-get install -y libgl1` on headless Linux).

## Quick links

- One-command production startup → **[START.md](./START.md)**
- Backend API contract mirror & gap register → `frontend/API_CONTRACT.md`
