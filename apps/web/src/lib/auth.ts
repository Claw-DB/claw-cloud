const ACCESS_TOKEN_KEY = 'claw_access_token';
const REFRESH_TOKEN_KEY = 'claw_refresh_token';
const WORKSPACE_KEY = 'claw_workspace_id';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(WORKSPACE_KEY);
}

export function getSavedWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(WORKSPACE_KEY);
}

export function saveWorkspaceId(id: string): void {
  localStorage.setItem(WORKSPACE_KEY, id);
}
