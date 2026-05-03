# Pricing

## Plans

- Free: single instance, baseline limits for development.
- Starter: small team workloads with moderate throughput.
- Pro: production workloads with higher scale limits.
- Enterprise: negotiated limits, SCIM/SSO, and premium support.

## Metered Usage

Usage billing is composed of:

- compute minutes
- storage GB-hours
- memory operations
- vector operations
- sync operations
- bandwidth GB
- reflect jobs

See `USAGE_RATES_USD` in `packages/common/src/constants/index.ts` for rate configuration.
