# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/common/package.json packages/common/
COPY apps/admin/package.json apps/admin/
RUN pnpm install --frozen-lockfile --filter @claw/admin...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @claw/admin build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/admin/public ./public 2>/dev/null || true
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next-build/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next-build/static ./.next/static

USER nextjs
EXPOSE 3001
CMD ["node", "server.js"]
