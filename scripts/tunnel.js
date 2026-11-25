'use strict';

/*
 * Public-tunnel provider for the SSAMS launcher.
 *
 * Priority: cloudflared (no account / authtoken needed for quick tunnels) ->
 * ngrok (if already installed + authed). If neither binary is present we try to
 * auto-download cloudflared from GitHub releases (the only third-party host the
 * sandbox is allowed to reach) and fall back gracefully if the edge is
 * unreachable, so the app still runs on localhost.
 *
 * startTunnel({ port, provider, logger, timeout }) -> Promise<{ url, stop, provider } | null>
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { color, log, hasBinary, run } = require('./common');

const BIN_DIR = path.resolve(__dirname, 'bin');

function archForCloudflared() {
  const a = process.arch;
  if (a === 'x64') return 'amd64';
  if (a === 'arm64') return 'arm64';
  if (a === 'arm') return 'arm';
  return null;
}

function cloudflaredLocalPath() {
  return path.join(BIN_DIR, process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
}

async function downloadCloudflared(logger) {
  const arch = archForCloudflared();
  if (!arch) {
    logger('cloudflared is not available for this CPU architecture; skipping auto-download.');
    return null;
  }
  if (!hasBinary('curl')) {
    logger('curl is required to auto-download cloudflared but was not found.');
    return null;
  }
  const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}`;
  fs.mkdirSync(BIN_DIR, { recursive: true });
  const dest = cloudflaredLocalPath();
  logger(`Downloading cloudflared (${arch}) from GitHub releases...`);
  try {
    await run('curl', ['-fsSL', '-o', dest, url], { silent: false });
    fs.chmodSync(dest, 0o755);
    logger('cloudflared downloaded to scripts/bin/cloudflared');
    return dest;
  } catch (e) {
    logger(`Could not download cloudflared: ${e.message}`);
    return null;
  }
}

function resolveCloudflared() {
  const onPath = hasBinary('cloudflared');
  if (onPath) return onPath;
  if (fs.existsSync(cloudflaredLocalPath())) return cloudflaredLocalPath();
  return null;
}

function startCloudflared(bin, port, logger, timeout) {
  return new Promise((resolve) => {
    const child = spawn(bin, ['tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate', '--loglevel', 'info'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let resolved = false;
    const finish = (url) =>
      finishWith(url ? { url, child, provider: 'cloudflared', stop: () => kill(child) } : null);
    const finishWith = (result) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };
    const onData = (data) => {
      const s = data.toString();
      s.split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((l) => logger(l));
      const m = s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi);
      if (m && m[0]) finish(m[0]);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (e) => {
      logger(`cloudflared error: ${e.message}`);
      finishWith(null);
    });
    child.on('exit', (code) => {
      if (!resolved) {
        logger(`cloudflared exited (code ${code}).`);
        finishWith(null);
      }
    });
    setTimeout(() => {
      if (!resolved) {
        logger('Timed out waiting for a cloudflared tunnel URL (the cloudflared edge may be unreachable).');
        finishWith(null);
      }
    }, timeout);
  });
}

function startNgrok(bin, port, logger, timeout) {
  return new Promise((resolve) => {
    const child = spawn(bin, ['http', String(port), '--log', 'stdout'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let resolved = false;
    const finish = (url) =>
      finishWith(url ? { url, child, provider: 'ngrok', stop: () => kill(child) } : null);
    const finishWith = (result) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };
    const pipe = (stream) =>
      stream.on('data', (d) =>
        d
          .toString()
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .forEach((l) => logger(l)),
      );
    pipe(child.stdout);
    pipe(child.stderr);
    const start = Date.now();
    const poll = async () => {
      try {
        const res = await fetch('http://127.0.0.1:4040/api/tunnels');
        const j = await res.json();
        const tunnels = j.tunnels || [];
        const https = tunnels.find((x) => x.proto === 'https') || tunnels[0];
        if (https && https.public_url) {
          finish(https.public_url);
          return;
        }
      } catch (_) {
        /* ngrok api not ready */
      }
      if (Date.now() - start > timeout) {
        logger('Timed out waiting for an ngrok tunnel URL.');
        finishWith(null);
        return;
      }
      setTimeout(poll, 1000);
    };
    poll();
    child.on('error', (e) => {
      logger(`ngrok error: ${e.message}`);
      finishWith(null);
    });
    child.on('exit', (code) => {
      if (!resolved) {
        logger(`ngrok exited (code ${code}).`);
        finishWith(null);
      }
    });
  });
}

function kill(child) {
  try {
    child.kill('SIGTERM');
  } catch (_) {
    /* ignore */
  }
}

async function startTunnel({
  port,
  provider = 'auto',
  logger = (m) => log('tunnel', m, 'magenta'),
  timeout = 90000,
} = {}) {
  if (provider === 'auto' || provider === 'cloudflared') {
    let bin = resolveCloudflared();
    if (!bin && provider === 'auto') bin = await downloadCloudflared(logger);
    if (bin) {
      logger(`Starting cloudflared quick tunnel -> localhost:${port}`);
      const res = await startCloudflared(bin, port, logger, timeout);
      if (res) return res;
    }
  }
  if (provider === 'auto' || provider === 'ngrok') {
    const bin = hasBinary('ngrok');
    if (bin) {
      logger(`Starting ngrok tunnel -> localhost:${port}`);
      const res = await startNgrok(bin, port, logger, timeout);
      if (res) return res;
    }
  }
  logger('No public tunnel could be established. The app remains reachable on localhost.');
  return null;
}

module.exports = { startTunnel, resolveCloudflared, downloadCloudflared };

// Allow `node scripts/tunnel.js [port]` as a standalone command.
if (require.main === module) {
  const port = parseInt(process.argv[2] || process.env.PORT || '4000', 10);
  const tunnel = cloudflaredStandalone(port);
  tunnel.then((res) => {
    if (res) {
      // eslint-disable-next-line no-console
      console.log(color('green', `\nPublic URL: ${res.url}\n`));
    } else {
      // eslint-disable-next-line no-console
      console.log(color('yellow', '\nNo tunnel started. Exiting.\n'));
      process.exit(1);
    }
  });
}

function cloudflaredStandalone(port) {
  return startTunnel({ port, logger: (m) => log('tunnel', m, 'magenta') });
}
