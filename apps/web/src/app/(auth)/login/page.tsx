'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { Button, Card, CardBody, CardHeader, CardTitle, Input, buttonVariants } from '@/components/ui';
import { authApi, workspaceApi } from '@/lib/api-client';
import { setTokens } from '@/lib/auth';
import { cn } from '@/lib/utils';

const rawApiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const oauthBase = rawApiBase.endsWith('/api/v1')
  ? rawApiBase
  : `${rawApiBase.replace(/\/$/, '')}/api/v1`;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const oauthUrls = useMemo(() => ({
    github: `${oauthBase}/auth/github`,
    google: `${oauthBase}/auth/google`,
  }), []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await authApi.login({ email, password });

      if (result.requiresTotp) {
        localStorage.setItem('claw_totp_temp_token', result.tempToken);
        router.push('/verify-totp');
        return;
      }

      setTokens(result.tokens.accessToken, result.tokens.refreshToken);

      const workspaces = await workspaceApi.list(result.tokens.accessToken);
      // Force a full navigation so app providers rehydrate with fresh tokens.
      window.location.href = workspaces.length === 0 ? '/onboarding' : '/dashboard';
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to sign in');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign in to ClawDB</CardTitle>
        </CardHeader>
        <CardBody>
          <form className="space-y-4" onSubmit={onSubmit}>
            <Input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              required
              type="email"
              value={email}
            />
            <Input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              required
              type="password"
              value={password}
            />

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button className="w-full" isLoading={isSubmitting} type="submit">
              Sign in
            </Button>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <a className={cn(buttonVariants({ variant: 'outline' }), 'w-full')} href={oauthUrls.github}>
                GitHub
              </a>
              <a className={cn(buttonVariants({ variant: 'outline' }), 'w-full')} href={oauthUrls.google}>
                Google
              </a>
            </div>

            <div className="flex items-center justify-between pt-1 text-xs text-ink-3">
              <Link href="/forgot-password">Forgot password?</Link>
              <Link href="/signup">Create account</Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </main>
  );
}
