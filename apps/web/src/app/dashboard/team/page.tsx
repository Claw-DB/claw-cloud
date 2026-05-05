'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UserPlus, Crown, Shield, User, Trash2, Loader2, AlertCircle, Mail } from 'lucide-react';
import { DashboardLayout, Topbar, PageWrapper } from '@/components/layout';
import {
  Button, Badge, Card, CardBody, CardHeader, CardTitle,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  Input, Select,
} from '@/components/ui';
import { workspaceApi, type WorkspaceMember, type Invitation } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { useAuth, useWorkspace } from '@/app/providers';
import { cn } from '@/lib/utils';

type Role = 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'READONLY';

const ROLE_META: Record<Role, { icon: React.ReactNode; label: string; color: string }> = {
  OWNER:  { icon: <Crown className="w-3.5 h-3.5" />,  label: 'Owner',  color: 'text-amber-400' },
  ADMIN:  { icon: <Shield className="w-3.5 h-3.5" />, label: 'Admin',  color: 'text-accent' },
  DEVELOPER: { icon: <User className="w-3.5 h-3.5" />,   label: 'Developer', color: 'text-ink-2' },
  READONLY: { icon: <User className="w-3.5 h-3.5" />,   label: 'Read-only', color: 'text-ink-3' },
};

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Invite Dialog ──────────────────────────────────────────────────────────────
function InviteDialog({ open, onClose, onInvited }: {
  open: boolean; onClose: () => void; onInvited: () => void;
}) {
  const { workspaceId } = useWorkspace();
  const token = getAccessToken() ?? '';
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<Role>('DEVELOPER');

  const mutation = useMutation({
    mutationFn: () => workspaceApi.invite(token, workspaceId!, { email: email.trim(), role }),
    onSuccess: () => {
      toast.success(`Invitation sent to ${email.trim()}`);
      setEmail('');
      setRole('DEVELOPER');
      onInvited();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite team member</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <DialogBody>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Email address</label>
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Role</label>
                <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="ADMIN">Admin — full control except billing</option>
                  <option value="DEVELOPER">Developer — read/write access</option>
                  <option value="READONLY">Read-only — read-only access</option>
                </Select>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!email.trim() || mutation.isPending} isLoading={mutation.isPending}>
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Remove Member Dialog ───────────────────────────────────────────────────────
function RemoveMemberDialog({ member, onClose, onRemoved }: {
  member: WorkspaceMember | null; onClose: () => void; onRemoved: () => void;
}) {
  const { workspaceId } = useWorkspace();
  const token = getAccessToken() ?? '';

  const mutation = useMutation({
    mutationFn: () => workspaceApi.removeMember(token, workspaceId!, member!.userId),
    onSuccess: () => {
      toast.success(`${member?.user.name} removed from workspace`);
      onRemoved();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={!!member} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Remove member</DialogTitle></DialogHeader>
        <DialogBody>
          <p className="text-sm text-ink-2">
            Remove <strong className="text-ink">{member?.user.name}</strong> from this workspace?
            They will lose access immediately.
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
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const { workspaceId } = useWorkspace();
  const { user, loading } = useAuth();
  const token = getAccessToken() ?? '';
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [removeTarget, setRemoveTarget] = React.useState<WorkspaceMember | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['members', workspaceId] });

  const { data: members = [], isLoading, isError } = useQuery({
    queryKey: ['members', workspaceId],
    queryFn: () => workspaceApi.listMembers(token, workspaceId!),
    enabled: !loading && !!user && !!workspaceId && !!token,
    retry: 2,
  });

  const currentUserMember = members.find((m) => m.user.id === user?.id);
  const canManage = currentUserMember?.role === 'OWNER' || currentUserMember?.role === 'ADMIN';

  return (
    <DashboardLayout>
      <Topbar
        title="Team"
        actions={
          canManage && (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="w-4 h-4 mr-1.5" />
              Invite member
            </Button>
          )
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
              <AlertCircle className="w-4 h-4" /> Failed to load team members.
            </div>
          )}

          {!isLoading && !isError && (
            <Card>
              <CardHeader>
                <CardTitle>Members ({members.length})</CardTitle>
              </CardHeader>
              <CardBody className="p-0">
                {members.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-ink-3">
                    <Mail className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    No members yet. Invite your team.
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        {['Member', 'Role', 'Joined', ''].map((h, i) => (
                          <th key={i} className="px-5 py-3 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member) => {
                        const roleMeta = ROLE_META[member.role as Role] ?? ROLE_META.DEVELOPER;
                        const isCurrentUser = member.user.id === user?.id;
                        const isOwner = member.role === 'OWNER';

                        return (
                          <tr key={member.id} className="border-b border-border last:border-0 hover:bg-bg-2 transition-colors">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-bg-3 border border-border flex items-center justify-center text-xs font-bold text-ink-2 shrink-0">
                                  {initials(member.user.name)}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-ink flex items-center gap-2">
                                    {member.user.name}
                                    {isCurrentUser && <Badge variant="neutral">You</Badge>}
                                  </div>
                                  <div className="text-xs text-ink-3">{member.user.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className={cn('flex items-center gap-1.5 text-xs font-medium', roleMeta.color)}>
                                {roleMeta.icon}
                                {roleMeta.label}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm text-ink-3">{fmtDate(member.joinedAt)}</td>
                            <td className="px-5 py-4 text-right">
                              {canManage && !isOwner && !isCurrentUser && (
                                <button
                                  onClick={() => setRemoveTarget(member)}
                                  className="p-1.5 rounded hover:bg-bg-3 text-ink-3 hover:text-danger transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardBody>
            </Card>
          )}

          {/* Role permissions reference */}
          <Card>
            <CardHeader><CardTitle>Role permissions</CardTitle></CardHeader>
            <CardBody className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider">Permission</th>
                    {(['OWNER', 'ADMIN', 'DEVELOPER', 'READONLY'] as Role[]).map((r) => (
                      <th key={r} className={cn('px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider', ROLE_META[r].color)}>
                        {ROLE_META[r].label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Read memory & sync data', true, true, true, true],
                    ['Write memory & sync data', true, true, true, false],
                    ['Manage instances', true, true, false, false],
                    ['Manage API keys', true, true, false, false],
                    ['Invite & remove members', true, true, false, false],
                    ['Manage billing', true, false, false, false],
                    ['Delete workspace', true, false, false, false],
                  ].map(([label, ...perms]) => (
                    <tr key={String(label)} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 text-ink-2">{label}</td>
                      {perms.map((p, i) => (
                        <td key={i} className="px-5 py-3 text-center text-sm">
                          {p ? <span className="text-success">✓</span> : <span className="text-ink-3">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </div>
      </PageWrapper>

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={invalidate}
      />
      <RemoveMemberDialog
        member={removeTarget}
        onClose={() => setRemoveTarget(null)}
        onRemoved={invalidate}
      />
    </DashboardLayout>
  );
}
