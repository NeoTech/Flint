# =============================================================================
# Flint Manager — Multi-stage Dockerfile
#
# Build context: manager/ directory (i.e. `docker compose build` with
# `context: .` pointing at manager/).
#
# Runtime volumes (NOT baked in):
#   - manager/.env              → /app/.env
#   - manager/manager.config.yaml → /app/manager.config.yaml
#   - Flint site directories    → mounted wherever the registry expects them
#
# Base image is oven/bun:1 (Debian, not Alpine) so that system tools such as
# `tar` are available on PATH — required by the dist-download endpoint which
# calls Bun.spawn(['tar', '-czf', ...]).
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — base
# Shared foundation used by subsequent stages.
# -----------------------------------------------------------------------------
FROM oven/bun:1 AS base

WORKDIR /app

# -----------------------------------------------------------------------------
# Stage 2 — install
# Copy only the lockfile and manifest first so that Docker can cache the
# dependency layer independently of source changes.
# -----------------------------------------------------------------------------
FROM base AS install

# bun.lock is the text lockfile format introduced in Bun >= 1.2
COPY package.json bun.lock ./

# Install production dependencies only; --frozen-lockfile ensures the install
# is fully reproducible and fails fast if bun.lock is out of date.
RUN bun install --frozen-lockfile --production

# -----------------------------------------------------------------------------
# Stage 3 — release
# Final image: lean, non-root, production-only.
# -----------------------------------------------------------------------------
FROM base AS release

ENV NODE_ENV=production

# Bring in the pre-built node_modules from the install stage.
COPY --from=install /app/node_modules ./node_modules

# Copy all manager source files with correct ownership.
# .env and manager.config.yaml are intentionally excluded — they are
# bind-mounted at runtime via docker-compose and must never be baked into
# the image.
COPY --chown=bun:bun server.ts       ./server.ts
COPY --chown=bun:bun package.json    ./package.json
COPY --chown=bun:bun bunfig.toml     ./bunfig.toml
COPY --chown=bun:bun tsconfig.json   ./tsconfig.json
COPY --chown=bun:bun src/            ./src/

# Run as the unprivileged `bun` user provided by the base image.
USER bun

# Flint Manager listens on 8080 by default (override with MANAGER_PORT env).
EXPOSE 8080

# Plain `bun server.ts` — no --hot or --watch in production.
ENTRYPOINT ["bun", "server.ts"]
