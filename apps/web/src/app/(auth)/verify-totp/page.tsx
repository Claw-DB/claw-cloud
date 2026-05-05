'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Button, Card, CardBody, CardHeader, CardTitle, Input } from '@/components/ui';
import { authApi } from '@/lib/api-client';

export default function VerifyTotpPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const tempToken = localStorage.getItem('claw_totp_temp_token');
    if (!tempToken) {
      router.replace('/login');
    }
  }, [router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const tempToken = localStorage.getItem('claw_totp_temp_token');
      if (!tempToken) {
        throw new Error('Missing TOTP challenge. Please sign in again.');
      }

      const result = await authApi.verifyTotp({ tempToken, code });
      localStorage.setItem('claw_access_token', result.tokens.accessToken);
      localStorage.setItem('claw_refresh_token', result.tokens.refreshToken);
      localStorage.removeItem('claw_totp_temp_token');
      router.push('/dashboard');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to verify code');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Two-factor verification</CardTitle>
        </CardHeader>
        <CardBody>
          <form className="space-y-4" onSubmit={onSubmit}>
            <Input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              pattern="[0-9]{6}"
              placeholder="123456"
              required
              value={code}
            />

            {error ? <p className="text-sm text-danger">{error}</p> : null}

            <Button className="w-full" isLoading={isSubmitting} type="submit">
              Verify code
            </Button>
          </form>
        </CardBody>
      </Card>
    </main>
  );
}
