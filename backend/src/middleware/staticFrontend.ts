import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { env } from '../config/env';

/**
 * Serves the built frontend SPA from the backend in production, so the whole
 * application is exposed on a single origin/port — no separate Vite dev server
 * and no reverse proxy in front. API routes (/api/*) are mounted *before* this
 * middleware in app.ts, so they always take precedence.
 *
 * Controlled by SERVE_FRONTEND (default true in production). When disabled, or
 * when the build output is missing, this is a no-op and the backend keeps
 * behaving as a pure JSON API (its original behaviour).
 */
export function staticFrontend(enabled: boolean = env.SERVE_FRONTEND) {
  const router = express.Router();

  if (!enabled) return router;

  // frontend/dist sits three levels up from backend/src/middleware (this file):
  // backend/src/middleware -> backend/src -> backend -> <root>/frontend/dist.
  // The compiled layout (backend/dist/middleware) keeps the same relative depth.
  const frontendDist = path.resolve(__dirname, '..', '..', '..', 'frontend', 'dist');

  if (!fs.existsSync(frontendDist)) {
    // Not fatal: the API keeps working. The launcher always builds the
    // frontend first, so this only happens when the backend is started
    // directly without a production build.
    // eslint-disable-next-line no-console
    console.warn(
      `[static] SERVE_FRONTEND is enabled but ${frontendDist} was not found. ` +
        `Build the frontend (npm run build) or start via the project launcher.`,
    );
    return router;
  }

  const indexHtml = path.join(frontendDist, 'index.html');

  // Hashed assets get long, immutable caching. index.html is served by the SPA
  // fallback below with no-cache so deploys are picked up immediately.
  router.use(
    express.static(frontendDist, {
      index: false,
      maxAge: '1h',
      immutable: true,
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );

  // SPA fallback: any HTML GET that is not an API route and not an existing
  // file receives the app shell. Everything else falls through to the 404
  // handler (so unknown /api routes still return JSON 404s).
  router.get('*', (req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api')) return next();
    const accept = req.headers.accept || '';
    if (!accept.includes('text/html')) return next();
    // Always revalidate the shell so a fresh deploy is picked up immediately.
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });

  return router;
}
