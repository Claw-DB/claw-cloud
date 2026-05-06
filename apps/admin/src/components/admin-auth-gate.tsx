'use client';

import * as React from 'react';
import { ADMIN_ACCESS_TOKEN_KEY, adminApi } from '../lib/admin-client';

type Props = {
  children: (token: string, refreshKey: number, onRefresh: () => void) => React.ReactNode;
};

export function AdminAuthGate({ children }: Props) {
  const [token, setToken] = React.useState<string>('');
  const [inputToken, setInputToken] = React.useState<string>('');
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [isValidating, setIsValidating] = React.useState(false);
  const [authError, setAuthError] = React.useState<string>('');

  React.useEffect(() => {
    const saved = localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY) ?? '';
    setInputToken(saved);
    if (!saved.trim()) {
      setToken('');
      return;
    }

    setIsValidating(true);
    setAuthError('');
    adminApi.getOverview(saved)
      .then(() => {
        setToken(saved);
      })
      .catch((error) => {
        setAuthError(error instanceof Error ? error.message : 'Invalid admin token');
        localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
        setToken('');
        setInputToken('');
      })
      .finally(() => setIsValidating(false));
  }, []);

  const saveToken = React.useCallback(async () => {
    const trimmed = inputToken.trim();
    if (!trimmed) return;

    setIsValidating(true);
    setAuthError('');
    try {
      await adminApi.getOverview(trimmed);
      localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, trimmed);
      setToken(trimmed);
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Invalid admin token');
      setToken('');
    } finally {
      setIsValidating(false);
    }
  }, [inputToken]);

  const clearToken = React.useCallback(() => {
    localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
    setToken('');
    setInputToken('');
    setAuthError('');
    setRefreshKey((prev) => prev + 1);
  }, []);

  if (!token) {
    return (
      <div className="min-h-[50vh] grid place-items-center p-6">
        <div className="w-full max-w-xl rounded-xl border border-[#1e2433] bg-[#0d1018] p-6 space-y-4">
          <h1 className="text-lg font-semibold text-[#e8eaf0]">Admin Access Required</h1>
          <p className="text-sm text-[#9aa3b8]">
            Paste a valid JWT access token for an admin account. This token is stored only in your browser for this admin origin.
          </p>
          {authError && (
            <p className="text-sm text-[#f56565]">{authError}</p>
          )}
          <textarea
            className="w-full h-36 rounded-md border border-[#1e2433] bg-[#131720] text-sm text-[#e8eaf0] p-3"
            placeholder="Paste admin access token"
            value={inputToken}
            onChange={(event) => setInputToken(event.target.value)}
          />
          <button
            type="button"
            onClick={saveToken}
            disabled={!inputToken.trim() || isValidating}
            className="px-4 py-2 rounded-md bg-[#6c8fff] text-white text-sm disabled:opacity-60"
          >
            {isValidating ? 'Validating...' : 'Save token'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="px-6 pt-4 pb-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setRefreshKey((prev) => prev + 1)}
          className="text-xs px-2.5 py-1 rounded-md border border-[#1e2433] text-[#9aa3b8] hover:text-[#e8eaf0]"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={clearToken}
          className="text-xs px-2.5 py-1 rounded-md border border-[#f56565] text-[#f56565] hover:bg-[#f565651a]"
        >
          Sign out token
        </button>
      </div>
      {children(token, refreshKey, () => setRefreshKey((prev) => prev + 1))}
    </div>
  );
}
