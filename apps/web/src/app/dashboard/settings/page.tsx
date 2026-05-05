'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { User, Shield, Bell, AlertTriangle, Smartphone, Trash2, Loader2 } from 'lucide-react';
import { DashboardLayout, Topbar, PageWrapper } from '@/components/layout';
import {
  Button, Badge, Card, CardBody, CardHeader, CardTitle,
  Input, Toggle,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from '@/components/ui';
import { authApi, workspaceApi } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { useAuth, useWorkspace } from '@/app/providers';
import { cn } from '@/lib/utils';

type Tab = 'profile' | 'security' | 'notifications' | 'danger';

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'profile',       label: 'Profile',       icon: <User className="w-4 h-4" /> },
  { id: 'security',      label: 'Security',       icon: <Shield className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notifications',  icon: <Bell className="w-4 h-4" /> },
  { id: 'danger',        label: 'Danger zone',    icon: <AlertTriangle className="w-4 h-4" /> },
];

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab() {
  const { user, setUser } = useAuth();
  const token = getAccessToken() ?? '';
  const [name, setName] = React.useState(user?.name ?? '');

  React.useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const mutation = useMutation({
    mutationFn: () => authApi.updateProfile(token, { name: name.trim() }),
    onSuccess: (updated) => {
      setUser(updated);
      toast.success('Profile updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const hasChanges = name.trim() !== user?.name;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Personal information</CardTitle></CardHeader>
        <CardBody>
          <div className="flex items-center gap-5 mb-6 pb-6 border-b border-border">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-white font-bold text-2xl select-none">
              {user?.name?.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2) ?? '?'}
            </div>
            <div>
              <p className="text-xs text-ink-3 mt-1">Avatar is generated from your name initials.</p>
            </div>
          </div>

          <div className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink">Full name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink">Email address</label>
              <Input value={user?.email ?? ''} disabled className="opacity-60 cursor-not-allowed" />
              <p className="text-xs text-ink-3">Contact support to change your email.</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border flex gap-3">
            <Button
              onClick={() => mutation.mutate()}
              disabled={!hasChanges || mutation.isPending}
              isLoading={mutation.isPending}
            >
              Save changes
            </Button>
            <Button variant="ghost" onClick={() => setName(user?.name ?? '')} disabled={!hasChanges}>
              Cancel
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ── Security Tab ───────────────────────────────────────────────────────────────
function SecurityTab() {
  const { user, refreshUser } = useAuth();
  const token = getAccessToken() ?? '';
  const [totpEnabled, setTotpEnabled] = React.useState(user?.totpEnabled ?? false);
  const [setupOpen, setSetupOpen] = React.useState(false);
  const [disableOpen, setDisableOpen] = React.useState(false);
  const [totpCode, setTotpCode] = React.useState('');
  const [otpSecret, setOtpSecret] = React.useState('');
  const [otpUrl, setOtpUrl] = React.useState('');
  const [pwCurrent, setPwCurrent] = React.useState('');
  const [pwNew, setPwNew] = React.useState('');
  const [pwConfirm, setPwConfirm] = React.useState('');

  React.useEffect(() => {
    if (user) setTotpEnabled(user.totpEnabled);
  }, [user?.totpEnabled]);

  const enableTotpMutation = useMutation({
    mutationFn: () => authApi.enableTotp(token),
    onSuccess: ({ secret, otpauthUrl }) => {
      setOtpSecret(secret);
      setOtpUrl(otpauthUrl ?? '');
      setSetupOpen(true);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const confirmTotpMutation = useMutation({
    mutationFn: () => authApi.confirmTotp(token, totpCode),
    onSuccess: () => {
      setTotpEnabled(true);
      setSetupOpen(false);
      setTotpCode('');
      refreshUser();
      toast.success('Two-factor authentication enabled');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disableTotpMutation = useMutation({
    mutationFn: () => authApi.disableTotp(token, totpCode),
    onSuccess: () => {
      setTotpEnabled(false);
      setDisableOpen(false);
      setTotpCode('');
      refreshUser();
      toast.success('Two-factor authentication disabled');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pwMutation = useMutation({
    mutationFn: () => authApi.changePassword(token, { currentPassword: pwCurrent, newPassword: pwNew }),
    onSuccess: () => {
      toast.success('Password updated');
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pwValid = pwCurrent && pwNew.length >= 8 && pwNew === pwConfirm;

  const qrCodeUrl = otpUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(otpUrl)}`
    : null;

  return (
    <div className="space-y-6">
      {/* Password */}
      <Card>
        <CardHeader><CardTitle>Password</CardTitle></CardHeader>
        <CardBody>
          <div className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink">Current password</label>
              <Input type="password" placeholder="••••••••" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink">New password</label>
              <Input type="password" placeholder="8+ characters" value={pwNew} onChange={(e) => setPwNew(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink">Confirm new password</label>
              <Input type="password" placeholder="••••••••" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} />
              {pwConfirm && pwNew !== pwConfirm && (
                <p className="text-xs text-danger">Passwords do not match</p>
              )}
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-border">
            <Button
              onClick={() => pwMutation.mutate()}
              disabled={!pwValid || pwMutation.isPending}
              isLoading={pwMutation.isPending}
            >
              Update password
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* 2FA */}
      <Card>
        <CardHeader><CardTitle>Two-factor authentication</CardTitle></CardHeader>
        <CardBody>
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-bg-3 shrink-0">
              <Smartphone className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <div className="text-sm font-medium text-ink">Authenticator app</div>
                <Badge variant={totpEnabled ? 'active' : 'neutral'}>
                  {totpEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <p className="text-xs text-ink-3 mb-4">
                Protect your account with a time-based one-time password from Google Authenticator or Authy.
              </p>
              {totpEnabled ? (
                <Button variant="danger" size="sm" onClick={() => setDisableOpen(true)}>
                  Disable 2FA
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => enableTotpMutation.mutate()}
                  isLoading={enableTotpMutation.isPending}
                  disabled={enableTotpMutation.isPending}
                >
                  Enable 2FA
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Setup 2FA Dialog */}
      <Dialog open={setupOpen} onOpenChange={(v) => { if (!v) { setSetupOpen(false); setTotpCode(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enable two-factor authentication</DialogTitle></DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <p className="text-sm text-ink-2">
                Scan this QR code with your authenticator app, then enter the 6-digit code below.
              </p>
              <div className="flex justify-center">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="TOTP QR code" className="w-40 h-40 rounded-md" />
                ) : (
                  <div className="w-40 h-40 bg-bg-3 rounded-md flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-ink-3" />
                  </div>
                )}
              </div>
              {otpSecret && (
                <div className="text-center">
                  <p className="text-xs text-ink-3 mb-1">Manual entry key</p>
                  <code className="text-xs font-mono bg-bg-2 px-2 py-1 rounded text-ink">{otpSecret}</code>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Verification code</label>
                <Input
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center font-mono text-lg tracking-widest"
                  autoFocus
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setSetupOpen(false); setTotpCode(''); }}>Cancel</Button>
            <Button
              disabled={totpCode.length !== 6 || confirmTotpMutation.isPending}
              isLoading={confirmTotpMutation.isPending}
              onClick={() => confirmTotpMutation.mutate()}
            >
              Verify & enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <Dialog open={disableOpen} onOpenChange={(v) => { if (!v) { setDisableOpen(false); setTotpCode(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Disable two-factor authentication</DialogTitle></DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <p className="text-sm text-ink-2">
                Enter your current 2FA code to disable two-factor authentication.
              </p>
              <Input
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center font-mono text-lg tracking-widest"
                autoFocus
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDisableOpen(false); setTotpCode(''); }}>Cancel</Button>
            <Button
              variant="danger"
              disabled={totpCode.length !== 6 || disableTotpMutation.isPending}
              isLoading={disableTotpMutation.isPending}
              onClick={() => disableTotpMutation.mutate()}
            >
              Disable 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Notifications Tab ─────────────────────────────────────────────────────────
function NotificationsTab() {
  const [prefs, setPrefs] = React.useState({
    emailUsageAlert: true,
    emailInstanceDown: true,
    emailInvitations: true,
    emailInvoices: true,
    emailProductUpdates: false,
    browserUsageAlert: true,
    browserInstanceDown: true,
    browserInvitations: false,
  });
  const [saved, setSaved] = React.useState(false);

  const toggle = (key: keyof typeof prefs) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = () => {
    setSaved(true);
    toast.success('Notification preferences saved');
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Email notifications</CardTitle></CardHeader>
        <CardBody>
          <div className="space-y-4">
            {([
              { key: 'emailUsageAlert',    label: 'Usage alerts',       desc: 'When you approach or exceed plan limits' },
              { key: 'emailInstanceDown',  label: 'Instance alerts',    desc: 'When an instance becomes unavailable' },
              { key: 'emailInvitations',   label: 'Team invitations',   desc: 'When someone joins or leaves your workspace' },
              { key: 'emailInvoices',      label: 'Invoices & receipts', desc: 'Monthly billing statements' },
              { key: 'emailProductUpdates',label: 'Product updates',    desc: 'New features and announcements' },
            ] as const).map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-ink">{label}</div>
                  <div className="text-xs text-ink-3">{desc}</div>
                </div>
                <Toggle checked={prefs[key]} onChange={() => toggle(key)} />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Browser notifications</CardTitle></CardHeader>
        <CardBody>
          <div className="space-y-4">
            {([
              { key: 'browserUsageAlert',   label: 'Usage alerts',     desc: 'In-app notification when limits are approached' },
              { key: 'browserInstanceDown', label: 'Instance alerts',  desc: 'In-app notification when instances change status' },
              { key: 'browserInvitations',  label: 'Team invitations', desc: 'In-app notification for team changes' },
            ] as const).map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-ink">{label}</div>
                  <div className="text-xs text-ink-3">{desc}</div>
                </div>
                <Toggle checked={prefs[key]} onChange={() => toggle(key)} />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Button onClick={handleSave}>{saved ? '✓ Saved' : 'Save preferences'}</Button>
    </div>
  );
}

// ── Danger Zone Tab ────────────────────────────────────────────────────────────
function DangerTab() {
  const { workspaceId, workspace } = useWorkspace();
  const token = getAccessToken() ?? '';
  const [deleteConfirm, setDeleteConfirm] = React.useState('');
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => workspaceApi.delete(token, workspaceId!),
    onSuccess: () => {
      toast.success('Workspace deleted');
      window.location.href = '/onboarding';
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const expectedPhrase = workspace?.name ?? 'delete my workspace';

  return (
    <div className="space-y-6">
      <Card className="border-danger/30">
        <CardHeader><CardTitle className="text-danger">Delete workspace</CardTitle></CardHeader>
        <CardBody>
          <p className="text-sm text-ink-2 mb-4">
            Permanently delete this workspace and all associated instances, API keys, data, and team members.
            This action cannot be undone.
          </p>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="w-4 h-4 mr-1.5" />
            Delete workspace
          </Button>
        </CardBody>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={(v) => { if (!v) { setDeleteOpen(false); setDeleteConfirm(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete workspace</DialogTitle></DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-danger/10 border border-danger/20 text-sm text-danger">
                This will permanently delete <strong>{workspace?.name}</strong> and cannot be undone.
              </div>
              <p className="text-sm text-ink-2">
                Type <strong className="text-ink">{expectedPhrase}</strong> to confirm.
              </p>
              <Input
                placeholder={expectedPhrase}
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                autoFocus
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDeleteOpen(false); setDeleteConfirm(''); }}>Cancel</Button>
            <Button
              variant="danger"
              disabled={deleteConfirm !== expectedPhrase || deleteMutation.isPending}
              isLoading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Permanently delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = React.useState<Tab>('profile');

  const ActiveContent = React.useMemo(() => {
    switch (activeTab) {
      case 'profile':       return <ProfileTab />;
      case 'security':      return <SecurityTab />;
      case 'notifications': return <NotificationsTab />;
      case 'danger':        return <DangerTab />;
    }
  }, [activeTab]);

  return (
    <DashboardLayout>
      <Topbar title="Settings" />
      <PageWrapper>
        <div className="flex gap-8">
          <nav className="w-44 shrink-0 space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left',
                  activeTab === tab.id
                    ? tab.id === 'danger'
                      ? 'bg-danger/10 text-danger'
                      : 'bg-accent/10 text-accent'
                    : 'text-ink-2 hover:text-ink hover:bg-bg-2',
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="flex-1 min-w-0">{ActiveContent}</div>
        </div>
      </PageWrapper>
    </DashboardLayout>
  );
}
