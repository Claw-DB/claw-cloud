'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { authApi, workspaceApi, type Workspace } from '@/lib/api-client';
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  getSavedWorkspaceId,
  saveWorkspaceId,
} from '@/lib/auth';

export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  totpEnabled: boolean;
};

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: User) => void;
}

interface WorkspaceContextValue {
  workspace: Workspace | null;
  workspaceId: string | undefined;
  workspaces: Workspace[];
  setWorkspaceId: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
}

export const AuthContext = React.createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
  refreshUser: async () => {},
  setUser: () => {},
});

export const WorkspaceContext = React.createContext<WorkspaceContextValue>({
  workspace: null,
  workspaceId: undefined,
  workspaces: [],
  setWorkspaceId: () => {},
  refreshWorkspaces: async () => {},
});

export function useAuth() {
  return React.useContext(AuthContext);
}

export function useWorkspace() {
  return React.useContext(WorkspaceContext);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
    },
  },
});

async function loadUserAndWorkspaces(token: string) {
  const [me, wsList] = await Promise.all([
    authApi.me(token),
    workspaceApi.list(token),
  ]);
  return { me, wsList };
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [authLoading, setAuthLoading] = React.useState(true);
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceIdState] = React.useState<string | undefined>();

  const applyWorkspaces = React.useCallback((wsList: Workspace[]) => {
    setWorkspaces(wsList);
    if (wsList.length > 0) {
      const savedId = getSavedWorkspaceId();
      const found = wsList.find((w) => w.id === savedId);
      const activeId = found ? found.id : wsList[0].id;
      setWorkspaceIdState(activeId);
      saveWorkspaceId(activeId);
    }
  }, []);

  const bootstrap = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }

    try {
      const { me, wsList } = await loadUserAndWorkspaces(token);
      setUser(me);
      applyWorkspaces(wsList);
    } catch {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        setAuthLoading(false);
        return;
      }
      try {
        const tokens = await authApi.refresh(refreshToken);
        setTokens(tokens.accessToken, tokens.refreshToken);
        const { me, wsList } = await loadUserAndWorkspaces(tokens.accessToken);
        setUser(me);
        applyWorkspaces(wsList);
      } catch {
        clearTokens();
      }
    } finally {
      setAuthLoading(false);
    }
  }, [applyWorkspaces]);

  React.useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const logout = React.useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // ignore
      }
    }
    clearTokens();
    queryClient.clear();
    setUser(null);
    setWorkspaces([]);
    setWorkspaceIdState(undefined);
    window.location.href = '/login';
  }, []);

  const refreshUser = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const me = await authApi.me(token);
      setUser(me);
    } catch {
      // ignore
    }
  }, []);

  const refreshWorkspaces = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const wsList = await workspaceApi.list(token);
      applyWorkspaces(wsList);
    } catch {
      // ignore
    }
  }, [applyWorkspaces]);

  const setWorkspaceId = React.useCallback((id: string) => {
    setWorkspaceIdState(id);
    saveWorkspaceId(id);
    queryClient.invalidateQueries();
  }, []);

  const workspace = workspaces.find((w) => w.id === workspaceId) ?? null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ user, loading: authLoading, logout, refreshUser, setUser }}>
        <WorkspaceContext.Provider
          value={{ workspace, workspaceId, workspaces, setWorkspaceId, refreshWorkspaces }}
        >
          <Toaster theme="dark" position="top-right" richColors closeButton expand />
          {children}
        </WorkspaceContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
