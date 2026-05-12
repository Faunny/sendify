# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Sendify — Next.js production image
# Multi-stage build using Next.js's `output: "standalone"` (see next.config.mjs).
# Final image is ~250MB and runs as non-root on a minimal Node 22 alpine base.
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=22.22.2-alpine3.20

# ── Stage 1: install deps (cached layer) ────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

# ── Stage 2: Prisma client + Next.js build ──────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# ── Stage 3: runtime (minimal) ──────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl tini
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user for runtime
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy the standalone output + static assets + public dir
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Prisma client + engine binary (needed at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000

# tini is PID 1 — forwards SIGTERM/SIGINT properly so ECS rolling deploys are graceful.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
