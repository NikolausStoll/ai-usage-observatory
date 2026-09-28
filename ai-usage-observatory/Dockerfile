# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# su-exec lets the entrypoint drop from root to a non-root user after fixing
# bind-mount ownership (required for Home Assistant / host bind mounts).
RUN apk add --no-cache su-exec \
 && addgroup -S observatory \
 && adduser -S observatory -G observatory

# Copy build output, startup scripts, and migration source
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/start.mjs ./start.mjs
COPY --from=builder /app/entrypoint.mjs ./entrypoint.mjs
COPY --from=builder /app/scripts/run-migrations.mjs ./scripts/run-migrations.mjs
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh

# Install production dependencies only (includes better-sqlite3 native module)
RUN npm ci --omit=dev \
 && chmod +x /app/entrypoint.sh

# Pre-create data directory (overridden by bind mounts; entrypoint re-chowns)
RUN mkdir -p /data && chown observatory:observatory /data

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV DB_PATH=/data/observatory.sqlite
ENV PORT=8096

EXPOSE 8096
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8096/health || exit 1

# Entrypoint runs as root, fixes /data ownership, then drops to observatory
ENTRYPOINT ["/app/entrypoint.sh"]
