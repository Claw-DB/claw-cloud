export const ADMIN_ACCESS_TOKEN_KEY = 'claw_admin_access_token';

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

export async function adminFetch<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });
  } catch {
    throw new Error(`Unable to reach API at ${API_BASE}. Check NEXT_PUBLIC_API_URL and API server status.`);
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? `Request failed (${res.status})`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export type AdminOverview = {
  totals: {
    workspaces: number;
    activeWorkspaces: number;
    instances: number;
    runningInstances: number;
  };
  health: {
    failedWebhookDeliveries: number;
    pastDueSubscriptions: number;
    laggingReplicationLinks: number;
    brokenReplicationLinks: number;
  };
  generatedAt: string;
};

export type AdminFlags = {
  suspendedWorkspaces: number;
  pastDueSubscriptions: number;
  laggingLinks: number;
  brokenLinks: number;
  generatedAt: string;
};

export type AdminWorkspaceRow = {
  id: string;
  slug: string;
  name: string;
  plan: 'FREE' | 'STARTER' | 'BASIC' | 'PRO' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: string;
  owner: { id: string; email: string; name: string };
  _count: { members: number; instances: number };
};

export type AdminWorkspaceList = {
  data: AdminWorkspaceRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type AdminInstanceRow = {
  id: string;
  name: string;
  slug: string;
  region: 'US_EAST' | 'US_WEST' | 'EU_WEST' | 'EU_CENTRAL' | 'APAC_EAST';
  status: 'PROVISIONING' | 'RUNNING' | 'SCALING' | 'PAUSED' | 'TERMINATING' | 'TERMINATED' | 'ERROR';
  tier: 'NANO' | 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'XL';
  cpuMillicores: number;
  memoryMb: number;
  storageGb: number;
  updatedAt: string;
  workspace: { id: string; slug: string; name: string; plan: string };
};

export type AdminInstanceList = {
  data: AdminInstanceRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type AdminIncidentRow = {
  id: string;
  severity: 'warning' | 'critical';
  type: 'webhook_delivery_failed' | 'subscription_past_due' | 'replication_health';
  title: string;
  workspace: { id: string; slug: string | null; name: string | null };
  details: Record<string, unknown>;
  occurredAt: string;
};

export type AdminIncidentList = {
  data: AdminIncidentRow[];
  counts: { warning: number; critical: number };
  generatedAt: string;
};

function query(params?: Record<string, string | number | undefined>): string {
  if (!params) return '';
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    qs.set(key, String(value));
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export const adminApi = {
  getOverview: (token: string) => adminFetch<AdminOverview>('/admin/overview', token),

  getFlags: (token: string) => adminFetch<AdminFlags>('/admin/flags', token),

  listWorkspaces: (
    token: string,
    params?: { search?: string; status?: string; plan?: string; page?: number; limit?: number },
  ) => adminFetch<AdminWorkspaceList>(`/admin/workspaces${query(params)}`, token),

  listInstances: (
    token: string,
    params?: { status?: string; region?: string; page?: number; limit?: number },
  ) => adminFetch<AdminInstanceList>(`/admin/instances${query(params)}`, token),

  listIncidents: (token: string, limit = 50) =>
    adminFetch<AdminIncidentList>(`/admin/incidents${query({ limit })}`, token),

  suspendWorkspace: (token: string, workspaceId: string) =>
    adminFetch<{ id: string; status: 'SUSPENDED' }>(`/admin/workspaces/${workspaceId}/suspend`, token, {
      method: 'POST',
    }),

  reactivateWorkspace: (token: string, workspaceId: string) =>
    adminFetch<{ id: string; status: 'ACTIVE' }>(`/admin/workspaces/${workspaceId}/reactivate`, token, {
      method: 'POST',
    }),
};
