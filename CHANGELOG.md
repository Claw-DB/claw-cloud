# Changelog

## Unreleased

### Added

- Worker runtime rebuilt as a Nest standalone bootstrap with graceful shutdown.
- Structured BullMQ queue definitions for provision, billing, backup, replication, email, webhook, and cleanup queues.
- Resend + Handlebars mailer package with template-driven send API and text fallback.
- Customer web dashboard shell and route content for dashboard, instances, billing, settings, API explorer, team, and auth pages.
- Internal admin dashboard shell and pages for overview, tenants, instances, and incidents.
- Terraform baseline for AWS + Cloudflare modules.
- Kubernetes baseline manifests for platform namespace/RBAC, tenant network policy, and monitoring alerts.
- GitHub Actions workflows for CI and deployment scaffolding.
