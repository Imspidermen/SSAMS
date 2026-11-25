#!/usr/bin/env node
'use strict';

/*
 * SSAMS one-command launcher.
 *
 *   npm start                -> production: build -> serve frontend + API from a
 *                               single backend port, run the AI service, and open
 *                               a public cloudflared/ngrok tunnel.
 *   npm run dev              -> one terminal for the whole dev stack (Vite dev +
 *                               backend tsx watch + AI service) instead of three.
 *   node scripts/start.js --help
 *
 * The app is production-real: the frontend is built and served by the Node
 * backend on one origin/port (no Vite dev server in front), and the processes
 * are supervised with automatic restart and clean Ctrl+C shutdown. PostgreSQL is
 * required via DATABASE_URL (managed Neon/Supabase/RDS) — or started locally via
 * `npm run db:local` / Docker when none is provided.
 */

const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');
const {
  color,
  log,
  loadDotEnv,
  generateSecret,
  npmBin,
  venvPython,
  hasBinary,
  spawnCmd,
  run,
  waitForHttp,
} = require('./common');
const { startTunnel } = require('./tunnel');

const ROOT = path.resolve(__dirname, '..');
const BE = path.join(ROOT, 'backend');
const FE = path.join(ROOT, 'frontend');
const AI = path.join(ROOT, 'ai-service');
const AI_VENV = path.join(AI, '.venv');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const help = args.includes('--help') || args.includes('-h');
if (help) {
  // eslint-disable-next-line no-console
  console.log(`
SSAMS launcher

Usage: node scripts/start.js [options]

Options:
  --dev            Run the dev stack in one terminal (Vite + tsx watch + uvicorn).
  --no-install     Skip dependency install / venv creation.
  --no-build       Skip production builds (use existing dist/).
  --no-tunnel      Do not open a public tunnel.
  --no-db          Skip database setup / migrations.
  --no-health      Skip waiting for health checks.
  --seed           Seed demo accounts into the database on first run.
  --port=<n>       Public port for the app (default 4000; dev uses 5173).
  --tunnel=<prov>  Force tunnel provider: auto | cloudflared | ngrok.
  --help           Show this help.

Environment: DATABASE_URL (required for production), JWT_ACCESS_SECRET,
JWT_REFRESH_SECRET, and any backend/ai-service vars (see .env.example).
`);
  process.exit(0);
}

const flags = {
  dev: args.includes('--dev'),
  install: !args.includes('--no-install'),
  build: !args.includes('--no-build'),
  // A public tunnel is useful for production, but delaying local live reload
  // to download/open one is surprising in development. Opt in with
  // `--tunnel=cloudflared` or `--tunnel=ngrok` when it is needed.
  tunnel: !args.includes('--no-tunnel') && (!args.includes('--dev') || args.some((arg) => arg.startsWith('--tunnel='))),
  db: !args.includes('--no-db'),
  health: !args.includes('--no-health'),
  seed: args.includes('--seed'),
};
let cliPort = null;
let tunnelProvider = 'auto';
for (const a of args) {
  if (a.startsWith('--port=')) cliPort = parseInt(a.split('=')[1], 10);
  if (a.startsWith('--tunnel=')) tunnelProvider = a.split('=')[1];
}

const isDev = flags.dev;
const NODE_ENV = isDev ? 'development' : 'production';

// ---------------------------------------------------------------------------
// Environment resolution: defaults < root .env < process.env
// ---------------------------------------------------------------------------
const defaults = {
  NODE_ENV,
  PORT: isDev ? 5173 : 4000,
  SERVE_FRONTEND: isDev ? 'false' : 'true',
  CORS_ORIGIN: '',
  FRONTEND_URL: '',
  AI_SERVICE_URL: 'http://localhost:8000',
  AI_SERVICE_PORT: '8000',
  AI_SERVICE_TIMEOUT_MS: '8000',
  APP_TIMEZONE: 'Asia/Kolkata',
  COOKIE_SECURE: isDev ? 'false' : 'true',
  COOKIE_DOMAIN: '',
  LOG_LEVEL: 'info',
  LOGIN_RATE_LIMIT_MAX: '8',
  LOGIN_RATE_LIMIT_WINDOW_MINUTES: '15',
  ATTENDANCE_RATE_LIMIT_MAX: '20',
  ATTENDANCE_RATE_LIMIT_WINDOW_MINUTES: '10',
  ATTENDANCE_DEFAULT_RADIUS: '100',
  MIN_ATTENDANCE_PERCENTAGE: '75',
  FACE_MATCH_THRESHOLD: '0.62',
  VERIFICATION_SESSION_TTL_MINUTES: '5',
  MAX_VERIFICATION_ATTEMPTS: '3',
  SSAMS_SEED: flags.seed ? 'true' : 'false',
  TUNNEL_PROVIDER: 'auto',
};

const fileEnv = loadDotEnv(path.join(ROOT, '.env'));
const merged = { ...defaults, ...fileEnv, ...process.env };
for (const [k, v] of Object.entries(merged)) {
  if (v === undefined) continue;
  process.env[k] = String(v);
}
process.env.NODE_ENV = NODE_ENV;

// Dev mode has two listeners: Vite is public on 5173 while the API stays on
// 4000 (the target configured in frontend/vite.config.ts). Production has one.
const PORT = isDev
  ? (cliPort || Number(process.env.SSAMS_DEV_PORT) || 5173)
  : (cliPort || Number(process.env.PORT) || 4000);
const BACKEND_PORT = isDev ? Number(process.env.BACKEND_PORT || 4000) : PORT;
process.env.PORT = String(BACKEND_PORT);
const FE_PORT = isDev ? PORT : BACKEND_PORT;
const AI_PORT = Number(process.env.AI_SERVICE_PORT || 8000);
process.env.AI_SERVICE_PORT = String(AI_PORT);

// Auto-generate signing secrets if the operator did not supply them.
if (!process.env.JWT_ACCESS_SECRET) process.env.JWT_ACCESS_SECRET = generateSecret();
if (!process.env.JWT_REFRESH_SECRET) process.env.JWT_REFRESH_SECRET = generateSecret();

const tunnelTargetPort = isDev ? FE_PORT : PORT;

// ---------------------------------------------------------------------------
// Process supervision
// ---------------------------------------------------------------------------
const children = [];
let shuttingDown = false;
let tunnelRef = null;

function registerChild(name, child, opts) {
  const entry = { name, child, opts: opts || {} };
  children.push(entry);
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    log(name, `process exited (code ${code ?? ''}${signal ? ` ${signal}` : ''})`, 'red');
    const restarts = entry.opts.restarts || 0;
    const max = entry.opts.maxRestarts ?? 5;
    if (opts && opts.spawn && restarts < max) {
      const delay = entry.opts.backoff ?? 2000;
      log(name, `restarting in ${delay}ms (attempt ${restarts + 1}/${max})`, 'yellow');
      const t = setTimeout(() => {
        if (shuttingDown) return;
        const fresh = entry.opts.spawn();
        entry.opts.restarts = restarts + 1;
        registerChild(name, fresh, entry.opts);
      }, delay);
      if (t.unref) t.unref();
    } else if (opts && opts.spawn) {
      log(name, 'exceeded maximum restarts; leaving stopped.', 'red');
    }
  });
}

// Use the project's npm scripts (npm run <script>) rather than `npm exec`, which
// is unreliable on Windows (it can throw `spawn EINVAL`). These scripts already
// exist in each package.json and work in the user's normal workflow.
function npmRun(dir, script) {
  return run(npmBin(), ['--prefix', dir, 'run', script], { cwd: ROOT });
}

function spawnBackend() {
  if (isDev) {
    return spawnCmd('backend', npmBin(), ['--prefix', BE, 'run', 'dev'], {
      cwd: ROOT,
      color: 'green',
      env: process.env,
    });
  }
  return spawnCmd('backend', process.execPath, ['dist/server.js'], {
    cwd: BE,
    color: 'green',
    env: process.env,
  });
}

function spawnFrontendDev() {
  return spawnCmd('frontend', npmBin(), ['--prefix', FE, 'run', 'dev'], {
    cwd: ROOT,
    color: 'cyan',
    // Vite reads PORT from the inherited environment before its .env file.
    // Keep it separate from the API listener in development.
    env: { ...process.env, PORT: String(FE_PORT) },
  });
}

function spawnAI() {
  const py = venvPython(AI_VENV);
  const pyArgs = ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', String(AI_PORT)];
  if (isDev) pyArgs.push('--reload');
  return spawnCmd('ai', py, pyArgs, { cwd: AI, color: 'yellow', env: process.env });
}

// ---------------------------------------------------------------------------
// Bootstrap steps
// ---------------------------------------------------------------------------
async function bootstrap() {
  banner();

  if (flags.install) {
    await installDeps();
  }

  log('setup', 'Generating Prisma client...', 'blue');
  await npmRun(BE, 'prisma:generate').catch((e) => {
    throw new Error(`prisma generate failed: ${e.message}`);
  });

  if (flags.db) {
    await setupDatabase();
  }

  if (!isDev && flags.build) {
    log('build', 'Building backend (production)...', 'blue');
    await run(npmBin(), ['--prefix', BE, 'run', 'build'], { cwd: ROOT });
    log('build', 'Building frontend (production)...', 'blue');
    await run(npmBin(), ['--prefix', FE, 'run', 'build'], { cwd: ROOT });
    log('build', 'Build complete.', 'green');
  }

  // Start the tunnel first so we know the public origin before the backend boots
  // (used for CORS_ORIGIN / FRONTEND_URL / cookie security).
  if (flags.tunnel) {
    log('tunnel', 'Establishing public tunnel...', 'magenta');
    tunnelRef = await startTunnel({
      port: tunnelTargetPort,
      provider: process.env.TUNNEL_PROVIDER || tunnelProvider,
      logger: (m) => log('tunnel', m, 'magenta'),
      timeout: 90000,
    });
  }
  applyPublicOrigin(tunnelRef ? tunnelRef.url : null);

  await startServices();
}

async function installDeps() {
  log('setup', 'Installing dependencies (idempotent)...', 'blue');
  if (!fs.existsSync(path.join(BE, 'node_modules'))) {
    log('setup', 'Installing backend dependencies...', 'blue');
    await run(npmBin(), ['--prefix', BE, 'install'], { cwd: ROOT });
  }
  if (!fs.existsSync(path.join(FE, 'node_modules'))) {
    log('setup', 'Installing frontend dependencies...', 'blue');
    await run(npmBin(), ['--prefix', FE, 'install'], { cwd: ROOT });
  }
  if (!fs.existsSync(venvPython(AI_VENV))) {
    log('setup', 'Creating Python virtualenv for the AI service...', 'blue');
    fs.mkdirSync(AI, { recursive: true });
    await run(process.platform === 'win32' ? 'python' : 'python3', ['-m', 'venv', AI_VENV], { cwd: AI });
    const py = venvPython(AI_VENV);
    await run(py, ['-m', 'pip', 'install', '--upgrade', 'pip'], { cwd: AI });
    await run(py, ['-m', 'pip', 'install', '-r', 'requirements.txt'], { cwd: AI });
  }
}

async function setupDatabase() {
  if (!process.env.DATABASE_URL) {
    const localPostgresBin = findLocalPostgresBin();
    const canLocal =
      process.env.SSAMS_LOCAL_DB === '1' ||
      hasBinary('docker') ||
      Boolean(localPostgresBin) ||
      (process.platform !== 'win32' && (hasBinary('initdb') || hasBinary('pg_ctl')));
    if (!canLocal) {
      log('db', 'DATABASE_URL is not set. Provide a managed Postgres (Neon/Supabase/RDS)', 'red');
      log('db', 'or run `npm run db:local` (needs Postgres/Docker) before starting.', 'red');
      process.exit(1);
    }
    if (localPostgresBin) process.env.SSAMS_PG_BIN = localPostgresBin;
    // A Windows PostgreSQL installer commonly starts its own service on 5432.
    // Keep SSAMS isolated when that port is already in use unless the operator
    // explicitly chose a port.
    if (localPostgresBin && !process.env.SSAMS_LOCAL_DB_PORT && await isTcpPortOpen(5432)) {
      process.env.SSAMS_LOCAL_DB_PORT = '5433';
      log('db', 'Port 5432 is already in use; using local PostgreSQL port 5433.', 'yellow');
    }
    process.env.DATABASE_URL = `postgresql://ssams:ssams@localhost:${process.env.SSAMS_LOCAL_DB_PORT || 5432}/ssams?schema=public`;
    log('db', `No DATABASE_URL — starting local PostgreSQL (${process.env.DATABASE_URL})`, 'yellow');
    try {
      if (process.platform === 'win32' && localPostgresBin) {
        // `run` uses cmd.exe on Windows; invoking the PATH-resolved `node`
        // avoids cmd splitting a `process.execPath` such as Program Files\\nodejs.
        await run('node', [path.join(__dirname, 'db-local.js'), 'up'], { cwd: ROOT, env: process.env });
      } else {
        await run('bash', [path.join(__dirname, 'db-local.sh'), 'up'], { cwd: ROOT, env: process.env });
      }
    } catch (e) {
      log('db', `Local PostgreSQL failed to start: ${e.message}`, 'red');
      log('db', 'Set DATABASE_URL to a reachable Postgres and re-run.', 'red');
      process.exit(1);
    }
  }

  log('db', 'Applying database migrations...', 'blue');
  let applied = false;
  for (let i = 0; i < 6; i += 1) {
    try {
      await npmRun(BE, 'prisma:migrate:deploy');
      applied = true;
      break;
    } catch (e) {
      log('db', `migration attempt ${i + 1} failed, retrying...`, 'yellow');
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  if (!applied) {
    log('db', 'Could not apply migrations; the backend will report the DB as down.', 'red');
  }

  if (process.env.SSAMS_SEED === 'true') {
    log('db', 'Seeding demo accounts...', 'blue');
    await npmRun(BE, 'db:seed').catch((e) => log('db', `seed skipped: ${e.message}`, 'yellow'));
  }
}

/**
 * Locate a standard Windows PostgreSQL installation even when its bin folder
 * was not added to PATH by the installer. Linux/macOS are handled by the shell
 * helper and the normal PATH lookup above.
 */
function findLocalPostgresBin() {
  if (process.env.SSAMS_PG_BIN && fs.existsSync(path.join(process.env.SSAMS_PG_BIN, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl'))) {
    return process.env.SSAMS_PG_BIN;
  }
  if (hasBinary('pg_ctl')) return null;
  if (process.platform !== 'win32') return null;

  const installRoot = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PostgreSQL');
  if (!fs.existsSync(installRoot)) return null;

  const versions = fs
    .readdirSync(installRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return versions
    .map((version) => path.join(installRoot, version, 'bin'))
    .find((bin) => fs.existsSync(path.join(bin, 'pg_ctl.exe'))) || null;
}

function isTcpPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(500, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

function applyPublicOrigin(publicUrl) {
  if (!publicUrl) {
    const local = `http://localhost:${FE_PORT}`;
    process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || local;
    process.env.FRONTEND_URL = process.env.FRONTEND_URL || local;
    process.env.COOKIE_SECURE = process.env.COOKIE_SECURE || 'false';
    return;
  }
  const origin = publicUrl.replace(/\/$/, '');
  const localOrigin = `http://localhost:${FE_PORT}`;
  const origins = Array.from(new Set([origin, localOrigin]));
  process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || origins.join(',');
  process.env.FRONTEND_URL = process.env.FRONTEND_URL || origin;
  process.env.PUBLIC_URL = origin;
  process.env.COOKIE_SECURE = process.env.COOKIE_SECURE || (origin.startsWith('https') ? 'true' : 'false');
}

async function startServices() {
  if (isDev) {
    registerChild('frontend', spawnFrontendDev(), { spawn: spawnFrontendDev, maxRestarts: 5, backoff: 2000 });
  }
  registerChild('backend', spawnBackend(), { spawn: spawnBackend, maxRestarts: 5, backoff: 2000 });
  registerChild('ai', spawnAI(), { spawn: spawnAI, maxRestarts: 5, backoff: 2000 });

  if (flags.health) {
    await healthCheck();
  }

  const localUrl = `http://localhost:${FE_PORT}`;
  printReady({ localUrl, publicUrl: tunnelRef ? tunnelRef.url : null });
}

async function healthCheck() {
  const beUrl = `http://localhost:${BACKEND_PORT}/api/health`;
  log('health', `Waiting for backend on :${BACKEND_PORT} ...`, 'blue');
  const be = await waitForHttp(beUrl, {
    timeout: 60000,
    validate: (r) => r.json && r.json.status === 'ok',
  });
  if (!be) {
    log('health', 'backend did not report healthy in time (check logs above).', 'red');
  } else {
    const deps = be.dependencies || {};
    const ok = deps.database === 'ok' && deps.aiService === 'ok';
    log(
      'health',
      `backend healthy — database: ${deps.database || '?'}, ai-service: ${deps.aiService || '?'}`,
      ok ? 'green' : 'yellow',
    );
  }

  log('health', `Waiting for AI service on :${AI_PORT} ...`, 'blue');
  const ai = await waitForHttp(`http://localhost:${AI_PORT}/health`, {
    timeout: 30000,
    validate: (r) => r.json && r.json.status === 'ok',
  });
  if (!ai) log('health', 'AI service not healthy yet (continuing).', 'yellow');
  else log('health', 'AI service healthy.', 'green');
}

function banner() {
  // eslint-disable-next-line no-console
  console.log(
    color(
      'cyan',
      `\n╔══════════════════════════════════════════════════════════════╗\n` +
        `║  SSAMS — Smart Student Attendance Management System          ║\n` +
        `║  One-command ${isDev ? 'DEVELOPMENT' : 'PRODUCTION '} startup                            ║\n` +
        `╚══════════════════════════════════════════════════════════════╝`,
    ),
  );
}

function printReady({ localUrl, publicUrl }) {
  // eslint-disable-next-line no-console
  console.log('\n' + color('green', '✅  SSAMS is running'));
  // eslint-disable-next-line no-console
  console.log(color('bold', `    Local:    ${localUrl}`));
  if (publicUrl) {
    // eslint-disable-next-line no-console
    console.log(color('bold', `    Public:   ${publicUrl}`));
  } else {
    // eslint-disable-next-line no-console
    console.log(color('gray', '    Public:   (no tunnel — pass --tunnel=cloudflared, or set up ngrok)'));
  }
  // eslint-disable-next-line no-console
  console.log(color('gray', '    Press Ctrl+C to stop all services.\n'));
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('shutdown', 'Stopping all services...', 'red');
  for (const c of children) {
    try {
      c.child.kill('SIGTERM');
    } catch (_) {
      /* ignore */
    }
  }
  if (tunnelRef && tunnelRef.stop) {
    try {
      tunnelRef.stop();
    } catch (_) {
      /* ignore */
    }
  }
  const t = setTimeout(() => process.exit(code), 4000);
  if (t.unref) t.unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('unhandledRejection', (e) => {
  log('fatal', `Unhandled rejection: ${e && e.message ? e.message : e}`, 'red');
});

bootstrap().catch((e) => {
  log('fatal', e && e.message ? e.message : String(e), 'red');
  process.exit(1);
});
