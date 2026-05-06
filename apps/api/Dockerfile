# syntax=docker/dockerfile:1.7
# ── Base ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable pnpm

# ── Deps ────────────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/common/package.json packages/common/
COPY packages/db/package.json packages/db/
COPY packages/mailer/package.json packages/mailer/
COPY packages/billing/package.json packages/billing/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @claw/api...

# ── Builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm exec prisma generate --schema=packages/db/prisma/schema.prisma
RUN pnpm --filter @claw/api build

# ── Runner ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages

USER nestjs

EXPOSE 4000
ENV NODE_ENV=production PORT=4000

CMD ["node", "dist/main.js"]
