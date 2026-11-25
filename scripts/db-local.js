#!/usr/bin/env node
'use strict';

// Native Windows companion for db-local.sh. PostgreSQL's Windows installer does
// not add its tools to PATH, and `bash` may be a WSL shim with no distribution.
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
let pgBin = process.env.SSAMS_PG_BIN;
let port = Number(process.env.SSAMS_LOCAL_DB_PORT || 5432);
// Never leave the launcher waiting indefinitely when another program has a
// socket open but is not a functioning PostgreSQL server.
process.env.PGCONNECT_TIMEOUT = process.env.PGCONNECT_TIMEOUT || '5';
// Allow an alternate local cluster when an old PostgreSQL process is still
// holding the default one (for example after a Windows crash).  Keeping this
// configurable lets the launcher recover without touching the old data.
const dataDir = path.resolve(root, process.env.SSAMS_LOCAL_DB_DATA_DIR || path.join('.ssams', 'pgdata'));
const logFile = path.join(root, '.ssams', `pg-${port}.log`);
const exe = (name) => path.join(pgBin || '', `${name}.exe`);

function findWindowsPostgresBin() {
  const installRoot = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PostgreSQL');
  if (!fs.existsSync(installRoot)) return null;
  return fs
    .readdirSync(installRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    .map((version) => path.join(installRoot, version, 'bin'))
    .find((bin) => fs.existsSync(path.join(bin, 'pg_ctl.exe'))) || null;
}

function run(command, args, { silent = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: silent ? 'ignore' : 'inherit', shell: false });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(command)} exited with code ${code}`))));
  });
}

function ready() {
  return new Promise((resolve) => {
    const probe = spawn(exe('pg_isready'), ['-h', '127.0.0.1', '-p', String(port), '-t', '2'], {
      cwd: root,
      stdio: 'ignore',
      shell: false,
    });
    probe.once('error', () => resolve(false));
    probe.once('exit', (code) => resolve(code === 0));
  });
}

function portOpen(candidate) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port: candidate });
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(500, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

async function waitForReady() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`PostgreSQL did not accept connections on port ${port}`);
}

async function up() {
  if (!pgBin || !fs.existsSync(exe('pg_ctl'))) throw new Error('SSAMS_PG_BIN must point to a PostgreSQL bin directory');
  fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
    console.log(`Initialising PostgreSQL data directory at ${path.relative(root, dataDir)}...`);
    await run(exe('initdb'), ['-D', dataDir, '-U', 'postgres', '--auth=trust']);
  }
  if (!(await ready())) {
    console.log(`Starting PostgreSQL on port ${port}...`);
    await run(exe('pg_ctl'), ['-D', dataDir, '-o', `-p ${port} -c listen_addresses=127.0.0.1`, '-l', logFile, 'start']);
    await waitForReady();
  }
  const base = ['-w', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres'];
  await run(exe('psql'), [...base, '-v', 'ON_ERROR_STOP=1', '-c', "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ssams') THEN CREATE ROLE ssams LOGIN PASSWORD 'ssams' SUPERUSER; END IF; END $$;"]);
  try {
    await run(exe('psql'), [...base, '-tAc', "SELECT 1 FROM pg_database WHERE datname = 'ssams'"], { silent: true });
    // CREATE DATABASE is idempotent only after the existence query above. Let
    // an existing database continue without treating startup as a failure.
    const check = spawn(exe('psql'), [...base, '-tAc', "SELECT 1 FROM pg_database WHERE datname = 'ssams'"], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] });
    let output = '';
    check.stdout.on('data', (chunk) => { output += chunk; });
    await new Promise((resolve, reject) => check.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('Unable to query local databases')))));
    if (!output.trim()) await run(exe('psql'), [...base, '-v', 'ON_ERROR_STOP=1', '-c', 'CREATE DATABASE ssams OWNER ssams;']);
  } catch (error) {
    throw new Error(`Could not create the local ssams database: ${error.message}`);
  }
  console.log(`DATABASE_URL=postgresql://ssams:ssams@localhost:${port}/ssams?schema=public`);
}

async function down() {
  if (pgBin && fs.existsSync(path.join(dataDir, 'PG_VERSION'))) await run(exe('pg_ctl'), ['-D', dataDir, 'stop']);
}

(async () => {
  // Keep the existing shell implementation on Unix-like systems. This native
  // path exists solely for Windows, where `bash` can be an unconfigured WSL
  // shim and PostgreSQL is often absent from PATH.
  if (process.platform !== 'win32') {
    const child = spawnSync('bash', [path.join(__dirname, 'db-local.sh'), process.argv[2] || 'up'], { cwd: root, stdio: 'inherit' });
    process.exit(child.status ?? 1);
  }
  pgBin = pgBin || findWindowsPostgresBin();
  if (!process.env.SSAMS_LOCAL_DB_PORT && await portOpen(5432)) port = 5433;
  if (process.argv[2] === 'down') await down();
  else await up();
})().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
