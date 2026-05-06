// Typed API client for communicating with the claw-cloud NestJS API from the frontend
function resolveApiBase() {
  const envBase = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envBase) {
    return envBase.endsWith('/api/v1')
      ? envBase
      : `${envBase.replace(/\/$/, '')}/api/v1`;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:4000/api/v1';
  }

  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:4000/api/v1';
  }

  return 'https://api.clawdb.dev/api/v1';
}

const API_BASE = resolveApiBase();

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(`Unable to reach API at ${API_BASE}. Check NEXT_PUBLIC_API_URL and API server status.`);
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error((error as { message?: string }).message ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export type AuthTokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type AuthSuccess = {
  requiresTotp: false;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string | null;
    totpEnabled: boolean;
  };
  tokens: AuthTokenPair;
};

export type TotpChallenge = {
  requiresTotp: true;
  tempToken: string;
};

export type LoginResult = AuthSuccess | TotpChallenge;

export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    apiFetch<AuthSuccess>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    apiFetch<LoginResult>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  verifyTotp: (data: { tempToken: string; code: string }) =>
    apiFetch<AuthSuccess>('/auth/verify-totp', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  refresh: (refreshToken: string) =>
    apiFetch<AuthTokenPair>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (refreshToken: string) =>
    apiFetch<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  forgotPassword: (email: string) =>
    apiFetch<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    apiFetch<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  enableTotp: (token: string) =>
    apiFetch<{ secret: string; otpauthUrl: string | null }>('/auth/enable-totp', {
      method: 'POST',
      token,
    }),

  confirmTotp: (token: string, code: string) =>
    apiFetch<{ enabled: boolean }>('/auth/confirm-totp', {
      method: 'POST',
      token,
      body: JSON.stringify({ code }),
    }),

  disableTotp: (token: string, code: string) =>
    apiFetch<{ enabled: boolean }>('/auth/disable-totp', {
      method: 'POST',
      token,
      body: JSON.stringify({ code }),
    }),

  me: (token: string) =>
    apiFetch<{ id: string; email: string; name: string; avatarUrl?: string | null; totpEnabled: boolean }>('/auth/me', { token }),

  updateProfile: (token: string, data: { name: string }) =>
    apiFetch<{ id: string; email: string; name: string; avatarUrl?: string | null; totpEnabled: boolean }>('/auth/me', {
      method: 'PATCH',
      token,
      body: JSON.stringify(data),
    }),

  changePassword: (token: string, data: { currentPassword: string; newPassword: string }) =>
    apiFetch<{ message: string }>('/auth/change-password', {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    }),
};

// ── Workspace types & API ─────────────────────────────────────────────────────
export type Workspace = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  trialEndsAt: string | null;
  createdAt: string;
};

export type WorkspaceMember = {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
};

export type Invitation = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
};

export const workspaceApi = {
  create: (token: string, data: { name: string; slug: string }) =>
    apiFetch<Workspace>('/workspaces', {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    }),

  list: (token: string) =>
    apiFetch<Workspace[]>('/workspaces', { token }),

  get: (token: string, wsId: string) =>
    apiFetch<Workspace>(`/workspaces/${wsId}`, { token }),

  update: (token: string, wsId: string, data: { name?: string }) =>
    apiFetch<Workspace>(`/workspaces/${wsId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(data),
    }),

  delete: (token: string, wsId: string) =>
    apiFetch<void>(`/workspaces/${wsId}`, { method: 'DELETE', token }),

  listMembers: (token: string, wsId: string) =>
    apiFetch<WorkspaceMember[]>(`/workspaces/${wsId}/members`, { token }),

  invite: (token: string, wsId: string, data: { email: string; role: string }) =>
    apiFetch<Invitation>(`/workspaces/${wsId}/members/invite`, {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    }),

  removeMember: (token: string, wsId: string, memberId: string) =>
    apiFetch<void>(`/workspaces/${wsId}/members/${memberId}`, {
      method: 'DELETE',
      token,
    }),

  updateMemberRole: (token: string, wsId: string, memberId: string, role: string) =>
    apiFetch<WorkspaceMember>(`/workspaces/${wsId}/members/${memberId}/role`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ role }),
    }),

  getInvitation: (inviteToken: string) =>
    apiFetch<{ id: string; email: string; role: string; workspaceName: string; inviterName: string; expiresAt: string }>(
      `/workspaces/invitations/${inviteToken}`,
    ),

  acceptInvitation: (inviteToken: string) =>
    apiFetch<{ id: string; workspaceId: string; role: string }>(`/workspaces/invitations/${inviteToken}/accept`, {
      method: 'POST',
    }),
};

// ── Instance types & API ──────────────────────────────────────────────────────
export type Instance = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  region: string;
  tier: string;
  status: string;
  version: string;
  endpoint: string | null;
  cpuMillicores: number;
  memoryMb: number;
  storageGb: number;
  createdAt: string;
};

export const instanceApi = {
  create: (
    token: string,
    wsId: string,
    data: { name: string; region: string; tier: string; version: string },
  ) =>
    apiFetch<Instance>(`/workspaces/${wsId}/instances`, {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    }),

  list: (token: string, wsId: string) =>
    apiFetch<Instance[]>(`/workspaces/${wsId}/instances`, { token }),

  get: (token: string, wsId: string, instanceId: string) =>
    apiFetch<Instance>(`/workspaces/${wsId}/instances/${instanceId}`, { token }),

  pause: (token: string, wsId: string, instanceId: string) =>
    apiFetch<Instance>(`/workspaces/${wsId}/instances/${instanceId}/pause`, {
      method: 'POST',
      token,
    }),

  resume: (token: string, wsId: string, instanceId: string) =>
    apiFetch<Instance>(`/workspaces/${wsId}/instances/${instanceId}/resume`, {
      method: 'POST',
      token,
    }),

  delete: (token: string, wsId: string, instanceId: string) =>
    apiFetch<void>(`/workspaces/${wsId}/instances/${instanceId}`, {
      method: 'DELETE',
      token,
    }),
};

// ── API Key types & API ───────────────────────────────────────────────────────
export type ApiKeyRecord = {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
};

export type ApiKeyCreated = {
  apiKey: ApiKeyRecord;
  rawKey: string;
};

export const apiKeyApi = {
  create: (
    token: string,
    wsId: string,
    data: { name: string; scopes: string[]; expiresIn?: string },
  ) =>
    apiFetch<ApiKeyCreated>(`/workspaces/${wsId}/api-keys`, {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    }),

  list: (token: string, wsId: string) =>
    apiFetch<ApiKeyRecord[]>(`/workspaces/${wsId}/api-keys`, { token }),

  revoke: (token: string, wsId: string, keyId: string) =>
    apiFetch<void>(`/workspaces/${wsId}/api-keys/${keyId}`, {
      method: 'DELETE',
      token,
    }),
};

// ── Usage types & API ─────────────────────────────────────────────────────────
export type UsageSummary = {
  memoryOps: number;
  syncRounds: number;
  storageGb: number;
  storageGbHours: number;
  bandwidthGb: number;
  periodStart: string;
  periodEnd: string;
};

export const usageApi = {
  summary: (token: string, wsId: string) =>
    apiFetch<UsageSummary>(`/billing/usage/${wsId}`, { token }),
};

// ── Billing types & API ───────────────────────────────────────────────────────
export type Invoice = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  pdfUrl: string | null;
  createdAt: string;
};

type InvoiceApi = {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  pdfUrl: string | null;
  createdAt: string;
};

function mapInvoice(invoice: InvoiceApi): Invoice {
  return {
    id: invoice.id,
    amount: invoice.amountCents,
    currency: invoice.currency,
    status: invoice.status,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    pdfUrl: invoice.pdfUrl,
    createdAt: invoice.createdAt,
  };
}

export type BillingInfo = {
  plan: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  invoices: Invoice[];
};

export const billingApi = {
  getInfo: async (token: string, wsId: string) => {
    const [subscription, invoices] = await Promise.all([
      apiFetch<{
        status: string;
        currentPeriodEnd: string | null;
      } | null>(`/billing/subscription/${wsId}`, { token }).catch(() => null),
      apiFetch<InvoiceApi[]>(`/billing/invoices/${wsId}`, { token }).catch(() => []),
    ]);

    return {
      plan: 'FREE',
      status: subscription?.status ?? 'TRIALING',
      trialEndsAt: null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      invoices: invoices.map(mapInvoice),
    } satisfies BillingInfo;
  },

  createCheckout: (token: string, wsId: string, data: { plan: string; successUrl: string; cancelUrl: string }) =>
    apiFetch<{ url: string }>(`/billing/checkout`, {
      method: 'POST',
      token,
      body: JSON.stringify({ ...data, workspaceId: wsId }),
    }),

  openPortal: (token: string, wsId: string, data: { returnUrl: string }) =>
    apiFetch<{ url: string }>(`/billing/portal`, {
      method: 'POST',
      token,
      body: JSON.stringify({ ...data, workspaceId: wsId }),
    }),

  listInvoices: (token: string, wsId: string) =>
    apiFetch<InvoiceApi[]>(`/billing/invoices/${wsId}`, { token }).then((invoices) =>
      invoices.map(mapInvoice),
    ),
};

export type ReplicationLink = {
  id: string;
  sourceInstanceId: string;
  targetInstanceId: string;
  status: string;
  region: string;
  lagMs: number | null;
  lastSyncAt: string | null;
  createdAt: string;
  sourceInstance?: { id: string; name: string; status: string };
  targetInstance?: { id: string; name: string; status: string };
};

export type Webhook = {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
};

export const replicationApi = {
  list: (token: string, wsId: string) =>
    apiFetch<ReplicationLink[]>(`/workspaces/${wsId}/replication/links`, { token }),

  create: (token: string, wsId: string, data: { sourceInstanceId: string; targetInstanceId: string }) =>
    apiFetch<ReplicationLink>(`/workspaces/${wsId}/replication/links`, {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    }),

  pause: (token: string, wsId: string, linkId: string) =>
    apiFetch<ReplicationLink>(`/workspaces/${wsId}/replication/links/${linkId}/pause`, {
      method: 'POST',
      token,
    }),

  resume: (token: string, wsId: string, linkId: string) =>
    apiFetch<ReplicationLink>(`/workspaces/${wsId}/replication/links/${linkId}/resume`, {
      method: 'POST',
      token,
    }),

  delete: (token: string, wsId: string, linkId: string) =>
    apiFetch<void>(`/workspaces/${wsId}/replication/links/${linkId}`, {
      method: 'DELETE',
      token,
    }),
};

export const webhooksApi = {
  list: (token: string, wsId: string) =>
    apiFetch<Webhook[]>(`/workspaces/${wsId}/webhooks`, { token }),

  create: (token: string, wsId: string, data: { url: string; events: string[]; enabled: boolean }) =>
    apiFetch<Webhook & { secret?: string }>(`/workspaces/${wsId}/webhooks`, {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    }),

  update: (token: string, wsId: string, webhookId: string, data: { url?: string; events?: string[]; enabled?: boolean }) =>
    apiFetch<Webhook>(`/workspaces/${wsId}/webhooks/${webhookId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(data),
    }),

  delete: (token: string, wsId: string, webhookId: string) =>
    apiFetch<void>(`/workspaces/${wsId}/webhooks/${webhookId}`, {
      method: 'DELETE',
      token,
    }),

  rotateSecret: (token: string, wsId: string, webhookId: string) =>
    apiFetch<{ secret: string }>(`/workspaces/${wsId}/webhooks/${webhookId}/rotate-secret`, {
      method: 'POST',
      token,
    }),
};
