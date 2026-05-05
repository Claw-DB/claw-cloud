'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Key, Trash2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { DashboardLayout, Topbar, PageWrapper } from '@/components/layout';
import {
  Button, Badge, Card, CardBody, CardHeader, CardTitle,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  Input, Select, CodeSnippet,
} from '@/components/ui';
import { apiKeyApi, type ApiKeyRecord } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { useAuth, useWorkspace } from '@/app/providers';
import { cn } from '@/lib/utils';

const ALL_SCOPES = ['read:memory', 'write:memory', 'manage:branches', 'manage:sync', 'admin'];

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtRelative(iso: string | null) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Create Key Dialog ──────────────────────────────────────────────────────────
function CreateKeyDialog({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const { workspaceId } = useWorkspace();
  const token = getAccessToken() ?? '';
  const [name, setName] = React.useState('');
  const [scopes, setScopes] = React.useState<string[]>(['read:memory', 'write:memory']);
  const [expiry, setExpiry] = React.useState('never');
  const [rawKey, setRawKey] = React.useState<string | null>(null);

  const toggleScope = (scope: string) =>
    setScopes((prev) => prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]);

  const mutation = useMutation({
    mutationFn: () =>
      apiKeyApi.create(token, workspaceId!, {
        name: name.trim(),
        scopes,
        ...(expiry !== 'never' ? { expiresIn: expiry } : {}),
      }),
    onSuccess: ({ rawKey: key }) => {
      setRawKey(key);
      onCreated();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleClose = () => {
    setName('');
    setScopes(['read:memory', 'write:memory']);
    setExpiry('never');
    setRawKey(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rawKey ? 'API key created' : 'Create API key'}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {rawKey ? (
            <div className="space-y-4">
              <p className="text-sm text-ink-2">
                Copy your key now — you won&apos;t be able to see it again.
              </p>
              <CodeSnippet code={rawKey} language="bash" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Key name</label>
                <Input
                  placeholder="e.g. Production"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Scopes</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_SCOPES.map((scope) => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => toggleScope(scope)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-mono border transition-colors',
                        scopes.includes(scope)
                          ? 'bg-accent/15 border-accent/40 text-accent'
                          : 'bg-bg-2 border-border text-ink-3 hover:text-ink',
                      )}
                    >
                      {scope}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Expiration</label>
                <Select value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                  <option value="never">No expiration</option>
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                  <option value="90d">90 days</option>
                  <option value="365d">1 year</option>
                </Select>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          {rawKey ? (
            <Button onClick={handleClose} className="w-full">Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={!name.trim() || scopes.length === 0 || mutation.isPending}
                isLoading={mutation.isPending}
              >
                Create key
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Revoke Confirmation Dialog ─────────────────────────────────────────────────
function RevokeDialog({ apiKey, onClose, onRevoked }: {
  apiKey: ApiKeyRecord | null; onClose: () => void; onRevoked: () => void;
}) {
  const { workspaceId } = useWorkspace();
  const token = getAccessToken() ?? '';

  const mutation = useMutation({
    mutationFn: () => apiKeyApi.revoke(token, workspaceId!, apiKey!.id),
    onSuccess: () => {
      toast.success(`Key "${apiKey?.name}" revoked`);
      onRevoked();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={!!apiKey} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Revoke API key</DialogTitle></DialogHeader>
        <DialogBody>
          <p className="text-sm text-ink-2">
            Revoking <strong className="text-ink">{apiKey?.name}</strong> will immediately
            invalidate it. Any services using this key will stop working.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => mutation.mutate()}
            isLoading={mutation.isPending}
            disabled={mutation.isPending}
          >
            Revoke key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ApiKeysPage() {
  const { workspaceId } = useWorkspace();
  const { user, loading } = useAuth();
  const token = getAccessToken() ?? '';
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [revokeTarget, setRevokeTarget] = React.useState<ApiKeyRecord | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['api-keys', workspaceId] });

  const { data: keys = [], isLoading, isError } = useQuery({
    queryKey: ['api-keys', workspaceId],
    queryFn: () => apiKeyApi.list(token, workspaceId!),
    enabled: !loading && !!user && !!workspaceId && !!token,
    retry: 2,
  });

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  return (
    <DashboardLayout>
      <Topbar
        title="API Keys"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            New key
          </Button>
        }
      />
      <PageWrapper>
        <div className="space-y-6">
          {isLoading && (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-ink-3" />
            </div>
          )}

          {isError && (
            <div className="flex items-center gap-2 py-8 text-sm text-danger">
              <AlertCircle className="w-4 h-4" /> Failed to load API keys.
            </div>
          )}

          {!isLoading && !isError && (
            <>
              {/* Active keys */}
              <Card>
                <CardHeader>
                  <CardTitle>Active keys ({activeKeys.length})</CardTitle>
                </CardHeader>
                {activeKeys.length === 0 ? (
                  <CardBody>
                    <p className="text-sm text-ink-3">No active keys. Create one to get started.</p>
                  </CardBody>
                ) : (
                  <CardBody className="p-0">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          {['Name', 'Prefix', 'Scopes', 'Last used', 'Expires', ''].map((h, i) => (
                            <th key={i} className="px-5 py-3 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeKeys.map((key) => (
                          <tr key={key.id} className="border-b border-border last:border-0 hover:bg-bg-2 transition-colors">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <Key className="w-3.5 h-3.5 text-accent" />
                                <span className="text-sm font-medium text-ink">{key.name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <span className="font-mono text-xs text-ink-2">{key.keyPrefix}••••</span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-wrap gap-1">
                                {key.scopes.map((s) => (
                                  <Badge key={s} variant="neutral">{s}</Badge>
                                ))}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm text-ink-3">{fmtRelative(key.lastUsedAt)}</td>
                            <td className="px-5 py-4 text-sm text-ink-3">{fmtDate(key.expiresAt)}</td>
                            <td className="px-5 py-4 text-right">
                              <button
                                onClick={() => setRevokeTarget(key)}
                                className="p-1.5 rounded hover:bg-bg-3 text-ink-3 hover:text-danger transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardBody>
                )}
              </Card>

              {/* Revoked keys */}
              {revokedKeys.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Revoked keys</CardTitle></CardHeader>
                  <CardBody className="p-0">
                    <table className="w-full">
                      <tbody>
                        {revokedKeys.map((key) => (
                          <tr key={key.id} className="border-b border-border last:border-0 opacity-50">
                            <td className="px-5 py-4">
                              <span className="text-sm text-ink line-through">{key.name}</span>
                            </td>
                            <td className="px-5 py-4">
                              <span className="font-mono text-xs text-ink-3">{key.keyPrefix}••••</span>
                            </td>
                            <td className="px-5 py-4 text-sm text-ink-3">
                              Revoked {fmtDate(key.revokedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardBody>
                </Card>
              )}
            </>
          )}

          {/* Usage info */}
          <Card>
            <CardBody>
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-md bg-accent/10">
                  <RefreshCw className="w-5 h-5 text-accent" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-ink">Using API keys</div>
                  <p className="text-sm text-ink-3">
                    Pass your key as a Bearer token in the{' '}
                    <code className="text-xs text-accent">Authorization</code> header.
                    Keys are never stored in plaintext.
                  </p>
                  <CodeSnippet
                    code={`curl https://api.clawdb.dev/v1/memory \\\n  -H "Authorization: Bearer ck_live_..."`}
                    language="bash"
                    className="mt-3"
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </PageWrapper>

      <CreateKeyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={invalidate}
      />
      <RevokeDialog
        apiKey={revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onRevoked={invalidate}
      />
    </DashboardLayout>
  );
}
