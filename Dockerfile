# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

RUN addgroup -S observatory && adduser -S observatory -G observatory

# Copy build output, startup scripts, and migration source
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/start.mjs ./start.mjs
COPY --from=builder /app/scripts/run-migrations.mjs ./scripts/run-migrations.mjs
COPY --from=builder /app/package*.json ./

# Install production dependencies only (includes better-sqlite3 native module)
RUN npm ci --omit=dev

# Create data directory with correct ownership
RUN mkdir -p /data && chown observatory:observatory /data

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV PORT=3000

EXPOSE 3000
VOLUME ["/data"]

USER observatory

# Startup: ensures dirs exist, runs migrations, then serves
CMD ["node", "start.mjs"]
