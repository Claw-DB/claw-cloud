'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { workspaceApi } from '@/lib/api-client';

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const finalizeOAuth = async () => {
      const accessToken = searchParams.get('token');
      const refreshToken = searchParams.get('refresh');

      if (!accessToken || !refreshToken) {
        router.replace('/login');
        return;
      }

      localStorage.setItem('claw_access_token', accessToken);
      localStorage.setItem('claw_refresh_token', refreshToken);

      try {
        const workspaces = await workspaceApi.list(accessToken);
        router.replace(workspaces.length === 0 ? '/onboarding' : '/dashboard');
      } catch {
        router.replace('/dashboard');
      }
    };

    void finalizeOAuth();
  }, [router, searchParams]);

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md items-center justify-center px-4 text-sm text-ink-3">
      Completing sign in...
    </main>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={(
      <main className="mx-auto flex min-h-[80vh] w-full max-w-md items-center justify-center px-4 text-sm text-ink-3">
        Completing sign in...
      </main>
    )}
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
