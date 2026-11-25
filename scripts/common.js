'use strict';

/*
 * Shared helpers for the SSAMS one-command launcher.
 * Pure Node, no third-party dependencies, works on Linux / macOS / Windows.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
};

function color(name, str) {
  if (process.env.NO_COLOR) return String(str);
  return (COLORS[name] || '') + str + COLORS.reset;
}

function timestamp() {
  return new Date().toISOString().substring(11, 19);
}

function log(prefix, msg, colorName = 'cyan') {
  const ts = color('gray', timestamp());
  const tag = color(colorName, `[${prefix}]`.padEnd(10));
  const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
  process.stdout.write(`${ts} ${tag} ${text}\n`);
}

/** Parse a simple .env file (KEY=VALUE, # comments, optional quotes). */
function loadDotEnv(file) {
  const out = {};
  if (!file || !fs.existsSync(file)) return out;
  const text = fs.readFileSync(file, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    out[key] = val;
  }
  return out;
}

function generateSecret(bytes = 48) {
  // eslint-disable-next-line global-require
  const crypto = require('crypto');
  return crypto.randomBytes(bytes).toString('hex');
}

function npmBin() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function venvPython(venvDir) {
  if (process.platform === 'win32') return path.join(venvDir, 'Scripts', 'python.exe');
  return path.join(venvDir, 'bin', 'python');
}

/** Locate an executable on PATH (handles Windows extensions). */
function hasBinary(cmd) {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      const p = path.join(dir, cmd + ext);
      try {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
      } catch (_) {
        /* ignore */
      }
    }
  }
  return null;
}

// On Windows, invoking npm / *.cmd binaries is far more reliable through the
// system shell. We also sanitise the environment so that no non-string value can
// trigger a low-level `spawn EINVAL` (a common Windows failure mode).
const USE_SHELL = process.platform === 'win32';

function cleanEnv(env) {
  const base = env && typeof env === 'object' ? env : process.env;
  const out = {};
  for (const key of Object.keys(base)) {
    const v = base[key];
    if (v === undefined || v === null) continue;
    out[key] = typeof v === 'string' ? v : String(v);
  }
  return out;
}

/**
 * Spawn a child process and stream its output to the parent console with a
 * colored [name] prefix. Returns the ChildProcess.
 */
function spawnCmd(name, cmd, args, opts = {}) {
  const colorName = opts.color || 'white';
  const child = spawn(cmd, args, {
    cwd: opts.cwd,
    env: cleanEnv(opts.env),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: USE_SHELL,
  });
  const prefix = color(colorName, `[${name}]`);
  const relay = (stream, isErr) => {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk.toString();
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (line.length === 0) return;
        const c = isErr ? color('red', line) : line;
        process.stdout.write(`${prefix} ${c}\n`);
      }
    });
    stream.on('end', () => {
      if (buf) process.stdout.write(`${prefix} ${isErr ? color('red', buf) : buf}\n`);
    });
  };
  relay(child.stdout, false);
  relay(child.stderr, true);
  return child;
}

/** Run a command to completion. Resolves with exit code (0) or rejects. */
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: cleanEnv(opts.env),
      stdio: opts.silent ? 'ignore' : 'inherit',
      shell: USE_SHELL,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0 || opts.ignoreErrors) resolve(code);
      else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

/** Poll an HTTP(S) endpoint until it succeeds or times out. Returns the JSON (or null). */
async function waitForHttp(url, { timeout = 60000, interval = 1000, validate } = {}) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), Math.min(interval, 5000));
      const res = await fetch(url, { signal: ac.signal });
      clearTimeout(t);
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch (_) {
        /* not json */
      }
      const ok = res.ok && (!validate || validate({ status: res.status, json, text }));
      if (ok) return json;
    } catch (_) {
      /* not up yet */
    }
    if (Date.now() - start > timeout) return null;
    await new Promise((r) => setTimeout(r, interval));
  }
}

module.exports = {
  COLORS,
  color,
  timestamp,
  log,
  loadDotEnv,
  generateSecret,
  npmBin,
  venvPython,
  hasBinary,
  spawnCmd,
  run,
  waitForHttp,
};
