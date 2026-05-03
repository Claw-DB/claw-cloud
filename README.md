# claw-cloud

Managed hosted platform for ClawDB built as a pnpm monorepo.

## Apps

- `apps/api`: NestJS control plane API.
- `apps/worker`: BullMQ workers for provisioning, billing, backups, replication, email, webhooks, and cleanup.
- `apps/web`: Customer dashboard (Next.js App Router).
- `apps/admin`: Internal platform operations dashboard (Next.js App Router).

## Packages

- `packages/common`: shared constants, DTO schemas, and types.
- `packages/db`: Prisma schema/client and seed logic.
- `packages/billing`: Stripe integration helpers.
- `packages/mailer`: Resend + Handlebars transactional email module.
- `packages/infra`: Terraform modules and Kubernetes manifest baselines.

## Local Development

1. Install dependencies:

```bash
pnpm install
```

2. Run type-checks:

```bash
pnpm --filter @claw/api type-check
pnpm --filter @claw/worker type-check
pnpm --filter @claw/web type-check
pnpm --filter @claw/admin type-check
```

3. Start apps:

```bash
pnpm --filter @claw/api dev
pnpm --filter @claw/worker dev
pnpm --filter @claw/web dev
pnpm --filter @claw/admin dev
```

## Infrastructure

- Terraform root: `packages/infra/terraform`.
- Kubernetes baseline manifests: `packages/infra/k8s`.
- CI/CD workflows: `.github/workflows`.

## Notes

- Queue names are shared through `@claw/common` constants.
- Worker runtime uses Nest standalone bootstrapping and graceful shutdown.
- Mail templates live in `packages/mailer/src/templates`.
