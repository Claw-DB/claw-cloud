## Claw Cloud Production Deployment Guide

This guide is a full, beginner-friendly, step-by-step runbook to deploy Claw Cloud in production with this topology:

- API + Worker + PostgreSQL + Redis + k3s on one AWS EC2 instance
- Frontend web app on Cloudflare Pages
- Admin app on Cloudflare Pages
- Domain: clawdb.dev
- API hostname: api.clawdb.dev
- Optional wildcard instances hostname: *.instances.clawdb.dev

If you follow each step in order, you will end with a live production deployment.

---

## 0. What You Need Before You Start

Create or confirm these accounts first:

1. AWS account with billing enabled
2. Cloudflare account with your clawdb.dev domain added
3. GitHub account and repository access to this codebase
4. Google Cloud Console access (for Google OAuth)
5. GitHub OAuth app access (for GitHub OAuth)
6. Resend account (for email delivery)
7. LemonSqueezy account (for paid plans)

Install these tools locally:

1. Node.js 20+
2. pnpm 9+
3. Docker Desktop
4. Git

---

## 1. Confirm Local Build and Tests Before Deploying

Run all checks locally from repository root:

```bash
pnpm install
pnpm --filter @claw/common type-check
pnpm --filter @claw/api type-check
pnpm --filter @claw/worker type-check
pnpm --filter @claw/web type-check
pnpm --filter @claw/admin type-check
pnpm --filter @claw/admin build
```

If any command fails, fix that first. Do not continue to production with broken builds.

---

## 2. Provision AWS EC2

### 2.1 Create the instance

In AWS Console:

1. Open EC2 > Instances > Launch instance
2. Name: claw-cloud-prod
3. AMI: Ubuntu Server 22.04 LTS
4. Instance type: t3.large (recommended minimum for production)
5. Key pair: create one and download the .pem file
6. Storage: 100 GB gp3 minimum
7. Security group inbound rules:
   - SSH (22) from your IP only
   - HTTP (80) from 0.0.0.0/0 (if not using Cloudflare tunnel)
   - HTTPS (443) from 0.0.0.0/0 (if terminating TLS on server)
   - API port 4000 only if you are not using Cloudflare tunnel

### 2.2 Connect by SSH

```bash
chmod 400 /path/to/your-key.pem
ssh -i /path/to/your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

---

## 3. Prepare the EC2 Host

Run all commands in this section on EC2.

### 3.1 Install system packages

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release git unzip jq
```

### 3.2 Install Docker Engine + Compose plugin

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

Log out and SSH in again after group change.

### 3.3 Install Node.js 20 and pnpm

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

corepack enable
corepack prepare pnpm@9 --activate
```

### 3.4 Install k3s

```bash
curl -sfL https://get.k3s.io | sh -s - --disable traefik --write-kubeconfig-mode 644
```

Verify:

```bash
sudo k3s kubectl get nodes
```

Expected: one node in Ready status.

---

## 4. Clone and Prepare Project on EC2

```bash
sudo mkdir -p /opt/claw-cloud
sudo chown -R ubuntu:ubuntu /opt/claw-cloud
cd /opt/claw-cloud
git clone https://github.com/YOUR_ORG/YOUR_REPO.git .
```

Create the production env file:

```bash
cp .env.example .env
```

If .env.example does not exist, create .env manually.

---

## 5. Fill Production Environment Variables

Edit /opt/claw-cloud/.env and set all required values.

Minimum required values:

```bash
NODE_ENV=production

# Public URLs
FRONTEND_URL=https://clawdb.dev
NEXT_PUBLIC_API_URL=https://api.clawdb.dev

# Auth
JWT_SECRET=REPLACE_WITH_LONG_RANDOM_SECRET

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://api.clawdb.dev/api/v1/auth/google/callback
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=https://api.clawdb.dev/api/v1/auth/github/callback

# Admin guard (required for /admin API)
ADMIN_EMAILS=you@yourcompany.com
# or ADMIN_EMAIL_DOMAIN=yourcompany.com

# Database / Redis
POSTGRES_USER=clawcloud
POSTGRES_PASSWORD=REPLACE_WITH_STRONG_PASSWORD
POSTGRES_DB=clawcloud
REDIS_PASSWORD=REPLACE_WITH_STRONG_PASSWORD

# API service connection URLs
DATABASE_URL=postgresql://clawcloud:REPLACE_WITH_STRONG_PASSWORD@postgres:5432/clawcloud
REDIS_URL=redis://:REPLACE_WITH_STRONG_PASSWORD@redis:6379

# Email
RESEND_API_KEY=re_xxx

# Billing
LEMONSQUEEZY_API_KEY=...
LEMONSQUEEZY_WEBHOOK_SECRET=...
LEMONSQUEEZY_STARTER_VARIANT_ID=...
LEMONSQUEEZY_PRO_VARIANT_ID=...

# Kubernetes for dynamic instances
KUBE_API_SERVER=https://127.0.0.1:6443
KUBECONFIG=/k3s/k3s.yaml
KUBE_SKIP_TLS_VERIFY=true
```

Important:

1. Use strong random passwords/secrets.
2. Never commit .env to git.
3. Keep callback URLs exactly as shown.

---

## 6. Create Production Compose File

Create /opt/claw-cloud/docker-compose.prod.yml.

Use this baseline:

```yaml
name: claw-cloud-prod

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --save 60 1 --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10

  api:
    image: ghcr.io/YOUR_ORG/claw-cloud-api:latest
    restart: unless-stopped
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
    ports:
      - "4000:4000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - /etc/rancher/k3s/k3s.yaml:/k3s/k3s.yaml:ro

  worker:
    image: ghcr.io/YOUR_ORG/claw-cloud-worker:latest
    restart: unless-stopped
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - /etc/rancher/k3s/k3s.yaml:/k3s/k3s.yaml:ro

volumes:
  postgres_data:
  redis_data:
```

Note: if containers cannot reach KUBE_API_SERVER at 127.0.0.1, switch API and worker to host networking or point KUBE_API_SERVER to host IP.

---

## 7. Build and Push Production Images

You can build on GitHub Actions (recommended) or directly on EC2.

### 7.1 Recommended: build in GitHub Actions

1. Create GHCR package permissions for repo
2. Add repository secrets:
   - EC2_HOST
   - EC2_SSH_KEY
3. Use CI workflow to build/push:

```bash
docker build -f apps/api/Dockerfile -t ghcr.io/YOUR_ORG/claw-cloud-api:latest .
docker build -f apps/worker/Dockerfile -t ghcr.io/YOUR_ORG/claw-cloud-worker:latest .
```

4. Push both images to GHCR

### 7.2 If building directly on EC2

```bash
cd /opt/claw-cloud
docker build -f apps/api/Dockerfile -t claw-cloud-api:local .
docker build -f apps/worker/Dockerfile -t claw-cloud-worker:local .
```

Then update compose image names accordingly.

---

## 8. Start Database and Redis First

```bash
cd /opt/claw-cloud
docker compose -f docker-compose.prod.yml up -d postgres redis
docker compose -f docker-compose.prod.yml ps
```

Wait until both are healthy.

---

## 9. Run Prisma Migrations in Production

Run against production database before starting API:

```bash
cd /opt/claw-cloud
pnpm install
pnpm --filter @claw/db prisma migrate deploy
```

If pnpm is not available on server image, run migration using a one-shot container with source mounted.

---

## 10. Start API and Worker

```bash
cd /opt/claw-cloud
docker compose -f docker-compose.prod.yml up -d api worker
docker compose -f docker-compose.prod.yml ps
```

Check logs:

```bash
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f worker
```

Do not continue until both are stable.

---

## 11. Configure Cloudflare DNS

In Cloudflare DNS for clawdb.dev:

1. A record:
   - Name: @
   - Value: EC2 public IP
   - Proxy: Proxied

2. A record:
   - Name: api
   - Value: EC2 public IP
   - Proxy: Proxied

3. CNAME record:
   - Name: admin
   - Value: (Cloudflare Pages subdomain for admin)
   - Proxy: Proxied

4. Optional wildcard for instance ingress:
   - A record: *.instances -> EC2 public IP
   - Proxy: Proxied

---

## 12. Deploy Web App to Cloudflare Pages

Create a new Cloudflare Pages project for web app.

Project settings:

1. Root directory: apps/web
2. Build command: pnpm --filter @claw/web build
3. Build output:
   - If static export is configured: out
   - Otherwise use Cloudflare Next adapter flow
4. Environment variables:
   - NEXT_PUBLIC_API_URL=https://api.clawdb.dev

After deploy, attach custom domain:

1. clawdb.dev
2. www.clawdb.dev (optional)

---

## 13. Deploy Admin App to Cloudflare Pages

Create a second Pages project for admin app.

Project settings:

1. Root directory: apps/admin
2. Build command: pnpm --filter @claw/admin build
3. Build output: .next or static output depending on adapter
4. Environment variables:
   - NEXT_PUBLIC_API_URL=https://api.clawdb.dev

Attach custom domain: admin.clawdb.dev

---

## 14. Configure OAuth Providers

### 14.1 Google OAuth

In Google Cloud Console OAuth client settings:

1. Authorized JavaScript origins:
   - https://clawdb.dev
2. Authorized redirect URI:
   - https://api.clawdb.dev/api/v1/auth/google/callback

### 14.2 GitHub OAuth

In GitHub OAuth App settings:

1. Homepage URL:
   - https://clawdb.dev
2. Authorization callback URL:
   - https://api.clawdb.dev/api/v1/auth/github/callback

---

## 15. Secure the API Endpoint (Recommended)

Use Cloudflare Tunnel so port 4000 is not public.

### 15.1 Install cloudflared on EC2

```bash
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

### 15.2 Create tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create claw-cloud
cloudflared tunnel route dns claw-cloud api.clawdb.dev
```

Create ~/.cloudflared/config.yml:

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/ubuntu/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: api.clawdb.dev
    service: http://localhost:4000
  - service: http_status:404
```

Enable service:

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

After this, remove inbound 4000 from EC2 security group.

---

## 16. Configure Kubernetes Ingress for Tenant Instances (Optional Advanced)

If tenant instances must be externally reachable:

1. Install ingress-nginx in k3s
2. Configure wildcard DNS
3. Ensure instance Ingress objects point to hostnames under *.instances.clawdb.dev

Install ingress-nginx:

```bash
sudo k3s kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/baremetal/deploy.yaml
sudo k3s kubectl get pods -n ingress-nginx
```

---

## 17. Smoke Test Production End-to-End

Run these checks in order:

1. API health endpoint (if available) returns 200
2. Open clawdb.dev and verify login page loads
3. Sign up/sign in works
4. Google OAuth and GitHub OAuth both complete successfully
5. New user redirects to onboarding
6. Create workspace succeeds
7. Create NANO instance succeeds on FREE plan
8. Invite member email goes to invited address
9. Password reset email is delivered
10. Reset password redirects user to login page
11. Admin panel at admin.clawdb.dev loads
12. Admin overview, tenants, instances, incidents load real data with token

---

## 18. Enable Backups and Monitoring

Minimum production checks:

1. Nightly PostgreSQL dump to S3
2. Persistent volume snapshots for k3s host disks
3. Container restart policies enabled
4. Alerting for API 5xx rate, worker queue lag, failed webhooks
5. Log retention policy documented

---

## 19. CI/CD Deployment Workflow

Use one pipeline for build and deploy:

1. On push to main:
   - Run type-checks
   - Build API/worker images
   - Push to GHCR
2. SSH into EC2:
   - Pull latest images
   - Run prisma migrate deploy
   - Restart compose services
3. Deploy web/admin to Cloudflare Pages
4. Run smoke checks

---

## 20. Rollback Procedure

If a deploy fails:

1. Revert to previous image tags in docker-compose.prod.yml
2. Run:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

3. Verify API and worker logs
4. If migration caused issue, restore from backup

---

## 21. Admin App Authentication Notes

Admin pages now use real /admin API endpoints and require a valid JWT for an admin user.

To access admin pages:

1. Login as an admin user in the main web app
2. Copy access token from your auth flow
3. Open admin.clawdb.dev
4. Paste token in the admin token prompt

Server-side access control still enforces:

- ADMIN_EMAILS list
- or ADMIN_EMAIL_DOMAIN

Even with a token, non-admin users are blocked by API guard.

---

## 22. Known Production Checklist

Before launch day, confirm all are true:

1. OAuth callback URLs use api.clawdb.dev and include /api/v1
2. FRONTEND_URL is https://clawdb.dev
3. NEXT_PUBLIC_API_URL is https://api.clawdb.dev
4. Admin guard env vars are set
5. LemonSqueezy STARTER variant ID is configured
6. Database backups are automated and tested
7. API and worker logs are monitored
8. Cloudflare DNS records are proxied correctly
9. CI/CD rollback path is tested
10. At least one full user signup-to-instance flow works in production
