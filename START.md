# Running SSAMS with a single command

SSAMS is a three-part system — a React/TypeScript **frontend**, a Node/Express/Prisma
**backend**, and a Python/FastAPI **AI service** (face detection / liveness / blink).
This repository ships a single launcher that boots the whole stack in **one terminal,
with one command**, in a way that is production-real rather than a dev demo.

```bash
npm start          # production: build + serve + AI service + public tunnel
```

That is the whole startup. No separate terminals, no `npm run dev` in three windows.

---

## What `npm start` actually does

1. **Installs dependencies** (idempotent) for the backend, frontend and the Python
   AI service (creates a `.venv` and `pip install`s requirements).
2. **Generates the Prisma client** and **applies database migrations**
   (`prisma migrate deploy`) against `DATABASE_URL`.
3. **Builds for production** — `tsc` for the backend and `vite build` for the
   frontend. No Vite dev server is involved.
4. **Serves the built SPA from the backend itself.** The backend now also hosts
   `frontend/dist` on the same origin/port (see `backend/src/middleware/staticFrontend.ts`),
   so there is a single endpoint, single set of httpOnly cookies, and no CORS proxy.
5. **Runs the AI service** (uvicorn) as a supervised child process.
6. **Opens a public tunnel** (cloudflared quick tunnel by default — no account or
   authtoken needed) and prints the public `https://*.trycloudflare.com` URL. The URL
   is fed back into the app as `CORS_ORIGIN` / `FRONTEND_URL` / cookie settings.
7. **Health-checks** both services and prints a ready banner with the local and
   public URLs. `Ctrl+C` stops everything cleanly.

```text
╔════════════════════════════════════════════════════════════════════╗
║  SSAMS — Smart Student Attendance Management System                  ║
║  One-command PRODUCTION startup                                     ║
╚════════════════════════════════════════════════════════════════════╝
...
✅  SSAMS is running
    Local:    http://localhost:4000
    Public:   https://<id>.trycloudflare.com
    Press Ctrl+C to stop all services.
```

> The launcher supervises the processes: if the backend or AI service crashes it is
> restarted (with backoff, up to 5 times) so a transient failure does not take the
> whole app down.

---

## Prerequisites

- **Node.js 18.18+** (22 LTS recommended) and npm 9+.
- **Python 3.10+** for the AI service (a `.venv` is created automatically).
- **A PostgreSQL database.** Provide it via `DATABASE_URL` (managed Neon / Supabase /
  RDS, or your own). If you leave `DATABASE_URL` empty the launcher will try to start
  a **local PostgreSQL** for you via `scripts/db-local.sh` (needs PostgreSQL **or**
  Docker installed).
- **For face / liveness features** the AI service uses MediaPipe, which needs the
  system OpenGL library. On a headless Linux server install it once:
  `sudo apt-get install -y libgl1` (macOS/Windows desktop already have it).

---

## Configuration

All variables are optional — `scripts/start.js` ships safe defaults. Precedence is
**defaults < root `.env` < your shell environment**. Copy `.env.example` to `.env`
to keep settings between runs.

| Variable                 | Default (prod)        | Purpose                                                      |
| ------------------------ | --------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`           | — (required)          | Postgres connection string. Migrations run against it.        |
| `PORT`                   | `4000`                | Public port the app is served on (SPA + API).                |
| `JWT_ACCESS_SECRET`      | auto-generated        | Access-token signing secret (set a strong value in prod).    |
| `JWT_REFRESH_SECRET`     | auto-generated        | Refresh-token signing secret.                                |
| `COOKIE_SECURE`          | `true` (auto from URL)| Send httpOnly cookies over HTTPS only.                       |
| `CORS_ORIGIN`            | public + localhost    | Allowed browser origins (set automatically from the tunnel). |
| `AI_SERVICE_URL`         | `http://localhost:8000` | Internal URL the backend calls for CV tasks.               |
| `AI_SERVICE_PORT`         | `8000`                | Port the AI service listens on.                              |
| `SSAMS_SEED`             | `false`               | `true` to load demo Admin/Teacher/Student accounts.           |
| `SSAMS_LOCAL_DB`         | `0`                   | `1` to have the launcher boot a local Postgres when none set.|
| `TUNNEL_PROVIDER`        | `auto`                | `auto` \| `cloudflared` \| `ngrok`. `--no-tunnel` disables.  |

### Launcher flags

```bash
node scripts/start.js --help
  --dev          Run the dev stack in one terminal (Vite + tsx watch + uvicorn).
  --no-install   Skip dependency install / venv creation.
  --no-build     Skip production builds (use existing dist/).
  --no-tunnel    Do not open a public tunnel.
  --no-db        Skip database setup / migrations.
  --no-health    Skip waiting for health checks.
  --seed         Seed demo accounts on first run.
  --port=<n>     Public port (default 4000).
  --tunnel=<p>   Force tunnel provider.
```

---

## The public link (ngrok / Cloudflare)

The startup brings up a working public URL automatically:

- **cloudflared (default).** Uses a *quick tunnel* — no Cloudflare account or
  authtoken required. It prints a `https://<id>.trycloudflare.com` URL. If the
  binary is not installed, the launcher **auto-downloads it from GitHub releases**.
- **ngrok** is used as a fallback if you already have it installed and authed.

Because the tunnel proxies to the single backend port, the browser loads the SPA and
calls the API on the **same origin**, so auth cookies stay first-party and CORS is a
non-issue. Pass `--no-tunnel` (or set `TUNNEL_PROVIDER=ngrok`) to disable/change.

> Tip: for a stable, branded URL use a Cloudflare *named* tunnel or `ngrok` with an
> authtoken; the same `cloudflared`/`ngrok` binary is reused.

---

## Development mode (still one terminal)

If you prefer HMR while coding:

```bash
npm run dev        # one terminal: Vite dev + backend tsx watch + AI service
```

This runs the three services exactly as before, just with live reload, instead of
three separate terminals.

---

## Alternative: Docker Compose

A ready-made `docker-compose.yml` runs the full stack (Postgres + backend + AI service,
with an optional cloudflared sidecar) for a clean container deployment:

```bash
export JWT_ACCESS_SECRET=... JWT_REFRESH_SECRET=...
docker compose up --build                       # http://localhost:4000
docker compose --profile tunnel up --build       # also expose a public URL
```

The backend image builds the SPA into itself and serves it (no separate web server
needed). See `backend/Dockerfile`, `ai-service/Dockerfile`.

---

## Troubleshooting

| Symptom                                  | Fix                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL is required`                | Set a Postgres `DATABASE_URL`, or run `npm run db:local` first.      |
| Backend `/api/health` shows `database: down` | The DB is unreachable — check `DATABASE_URL` / that Postgres is up. |
| AI service shows `aiService: down`        | Install `libgl1` (headless Linux) and restart; check the `ai` logs. |
| Tunnel never prints a URL                | Network to the tunnel edge is blocked; app still works on localhost. |
| `prisma generate` fails                  | Needs internet to fetch the Prisma engine once; run on a connected host. |

---

## Why this is "production, not a demo"

- The **frontend is built and served by the backend** on one origin — there is no
  Vite dev server or reverse proxy in the path.
- Security middleware already in place (Helmet, CORS, compression, rate limiting,
  CSRF, httpOnly cookies) applies to the real deployment.
- The app talks to a **real PostgreSQL**; there is no mock data or localStorage
  persistence in the frontend.
- Processes are **supervised** (restart + clean shutdown) and **health-checked**.
- The public URL is a real, shareable HTTPS endpoint via Cloudflare/ngrok.
