# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
RUN apk add --no-cache openssl
RUN npm install -g pnpm@9.0.0

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/common/package.json packages/common/
COPY packages/db/package.json packages/db/
COPY packages/mailer/package.json packages/mailer/
COPY packages/billing/package.json packages/billing/
COPY apps/worker/package.json apps/worker/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @claw/worker... --filter @claw/api
COPY packages/db/prisma packages/db/prisma
RUN pnpm --filter @claw/db exec prisma generate --schema=prisma/schema.prisma

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/common/node_modules ./packages/common/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/mailer/node_modules ./packages/mailer/node_modules
COPY --from=deps /app/packages/billing/node_modules ./packages/billing/node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter @claw/common build
RUN pnpm --filter @claw/mailer build
RUN pnpm --filter @claw/billing build
RUN pnpm --filter @claw/db build
RUN pnpm --filter @claw/worker build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 worker

COPY --from=builder --chown=worker:nodejs /app/apps/worker/dist ./dist
COPY --from=builder --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=builder --chown=worker:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=worker:nodejs /app/packages ./packages

USER worker

ENV NODE_ENV=production NODE_PATH=/app/apps/worker/node_modules:/app/apps/api/node_modules

CMD ["node", "dist/apps/worker/src/main.js"]
