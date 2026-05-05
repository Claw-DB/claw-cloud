'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Button, Card, CardBody, CardHeader, CardTitle, Input } from '@/components/ui';
import { authApi } from '@/lib/api-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await authApi.forgotPassword(email);
      setMessage(result.message);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to send reset email');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
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

            {message ? <p className="text-sm text-success">{message}</p> : null}
            {error ? <p className="text-sm text-danger">{error}</p> : null}

            <Button className="w-full" isLoading={isSubmitting} type="submit">
              Send reset link
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
