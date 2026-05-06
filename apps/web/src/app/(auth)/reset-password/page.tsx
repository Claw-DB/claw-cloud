'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { Button, Card, CardBody, CardHeader, CardTitle, Input } from '@/components/ui';
import { authApi } from '@/lib/api-client';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams]);

  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setError('Reset token is missing or invalid.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await authApi.resetPassword(token, password);
      setMessage('Password updated! Redirecting to sign in…');
      setTimeout(() => router.replace('/login'), 2000);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Create a new password</CardTitle>
        </CardHeader>
        <CardBody>
          <form className="space-y-4" onSubmit={onSubmit}>
            <Input
              autoComplete="new-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
              required
              type="password"
              value={password}
            />

            {message ? <p className="text-sm text-success">{message}</p> : null}
            {error ? <p className="text-sm text-danger">{error}</p> : null}

            <Button className="w-full" isLoading={isSubmitting} type="submit">
              Update password
            </Button>

            <p className="text-xs text-ink-3">
              Back to <Link href="/login">Sign in</Link>
            </p>
          </form>
        </CardBody>
      </Card>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={(
      <main className="mx-auto flex min-h-[80vh] w-full max-w-md items-center justify-center px-4 text-sm text-ink-3">
        Loading reset form...
      </main>
    )}
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
