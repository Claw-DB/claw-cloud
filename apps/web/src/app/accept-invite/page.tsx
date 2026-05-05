'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, CardTitle } from '@/components/ui';
import { workspaceApi } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';

type InviteInfo = {
  email: string;
  role: string;
  workspaceName: string;
  inviterName: string;
  expiresAt: string;
};

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = useMemo(() => searchParams.get('token') ?? '', [searchParams]);

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // Load invitation details
  useEffect(() => {
    if (!inviteToken) {
      setLoadError('Invalid or missing invitation token.');
      return;
    }
    workspaceApi
      .getInvitation(inviteToken)
      .then((data) => setInfo(data))
      .catch((err: Error) => setLoadError(err.message ?? 'Invitation not found or has expired.'));
  }, [inviteToken]);

  const handleAccept = async () => {
    setAccepting(true);
    setAcceptError(null);
    try {
      await workspaceApi.acceptInvitation(inviteToken);
      setAccepted(true);

      // If already logged in, go straight to dashboard; otherwise send to login
      const token = getAccessToken();
      setTimeout(() => {
        if (token) {
          window.location.href = '/dashboard';
        } else {
          router.replace(`/login?redirected=invite`);
        }
      }, 2000);
    } catch (err: unknown) {
      setAcceptError(err instanceof Error ? err.message : 'Failed to accept invitation.');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Workspace Invitation</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {/* Loading */}
          {!info && !loadError && (
            <div className="flex items-center gap-3 text-sm text-ink-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading invitation…
            </div>
          )}

          {/* Load error */}
          {loadError && (
            <div className="flex items-start gap-3 text-sm">
              <XCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-ink">Invitation unavailable</p>
                <p className="text-ink-3">{loadError}</p>
              </div>
            </div>
          )}

          {/* Accepted state */}
          {accepted && (
            <div className="flex items-start gap-3 text-sm">
              <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-ink">You joined {info?.workspaceName}!</p>
                <p className="text-ink-3">Redirecting you now…</p>
              </div>
            </div>
          )}

          {/* Invitation details */}
          {info && !accepted && (
            <>
              <div className="rounded-lg border border-border bg-bg-2 p-4 space-y-1.5">
                <p className="text-sm text-ink-3">
                  <span className="font-medium text-ink">{info.inviterName}</span> invited you to join
                </p>
                <p className="text-xl font-semibold text-ink">{info.workspaceName}</p>
                <p className="text-xs text-ink-3">
                  Role: <span className="capitalize font-medium text-ink">{info.role.toLowerCase()}</span>
                  {' · '}Expires {new Date(info.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              {acceptError && (
                <p className="text-sm text-danger">{acceptError}</p>
              )}

              <Button
                className="w-full"
                onClick={handleAccept}
                isLoading={accepting}
                disabled={accepting}
              >
                Accept invitation
              </Button>

              <p className="text-xs text-center text-ink-3">
                Not expecting this?{' '}
                <button
                  onClick={() => router.replace('/')}
                  className="text-accent hover:underline"
                >
                  Ignore it
                </button>
              </p>
            </>
          )}
        </CardBody>
      </Card>
    </main>
  );
}
