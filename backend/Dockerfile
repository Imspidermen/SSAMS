# ---------------------------------------------------------------------------
# SSAMS backend — multi-stage production image.
# Builds the TypeScript server, generates the Prisma client, and serves the
# frontend SPA from the same origin/port (SERVE_FRONTEND=true).
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV SERVE_FRONTEND=true
ENV PORT=4000

# Prisma client lives in node_modules; copy the full install plus build output.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package*.json ./

EXPOSE 4000
# Apply migrations, then start. DATABASE_URL must be provided at runtime.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
