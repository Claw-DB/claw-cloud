// Typed API client for communicating with the claw-cloud NestJS API from the frontend
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error((error as { message?: string }).message ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    apiFetch<{ token: string }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    apiFetch<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  me: (token: string) =>
    apiFetch<{ id: string; email: string; name: string }>('/auth/me', { token }),
};
