# Security Policy

## Reporting Vulnerabilities

Please report vulnerabilities privately to security@clawdb.dev.
Do not create public GitHub issues for security findings.

## Response Targets

- Acknowledgement: within 2 business days
- Initial triage: within 5 business days
- Mitigation plan: within 10 business days

## Security Controls

- API key hashing and rotation grace period support
- JWT and tenant/workspace guards across API routes
- Webhook signatures (HMAC-SHA256)
- Audit log entries with signature verification support
- Kubernetes network policy baselines for tenant isolation
