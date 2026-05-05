'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button, Card, CardBody, CardHeader, CardTitle, Input } from '@/components/ui';
import { authApi } from '@/lib/api-client';
import { setTokens } from '@/lib/auth';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await authApi.register({ name, email, password });
      setTokens(result.tokens.accessToken, result.tokens.refreshToken);
      // New users always go to onboarding to set up their workspace
      window.location.href = '/onboarding';
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Create your ClawDB account</CardTitle>
        </CardHeader>
        <CardBody>
          <form className="space-y-4" onSubmit={onSubmit}>
            <Input
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Full name"
              required
              value={name}
            />
            <Input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              required
              type="email"
              value={email}
            />
            <Input
              autoComplete="new-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password (8+ chars)"
              required
              type="password"
              value={password}
            />

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button className="w-full" isLoading={isSubmitting} type="submit">
              Create account
            </Button>

            <p className="text-xs text-ink-3">
              Already have an account?{' '}
              <Link href="/login" className="text-accent hover:underline">Sign in</Link>
            </p>
          </form>
        </CardBody>
      </Card>
    </main>
  );
}
