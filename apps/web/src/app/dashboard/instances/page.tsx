'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Server, Pause, Play, Trash2, Globe, Loader2, AlertCircle } from 'lucide-react';
import { DashboardLayout, Topbar, PageWrapper } from '@/components/layout';
import {
  Button, Badge, Card, CardBody,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  Input, Select,
} from '@/components/ui';
import { instanceApi, type Instance } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { useAuth, useWorkspace } from '@/app/providers';
import { cn } from '@/lib/utils';

const REGION_LABELS: Record<string, string> = {
  US_EAST: '🇺🇸 US East',
  US_WEST: '🇺🇸 US West',
  EU_WEST: '🇮🇪 EU West',
  EU_CENTRAL: '🇩🇪 EU Central',
  APAC_EAST: '🇯🇵 APAC East',
};

const REGIONS = [
  { value: 'US_EAST', label: '🇺🇸 US East (N. Virginia)' },
  { value: 'US_WEST', label: '🇺🇸 US West (Oregon)' },
  { value: 'EU_WEST', label: '🇮🇪 EU West (Ireland)' },
  { value: 'EU_CENTRAL', label: '🇩🇪 EU Central (Frankfurt)' },
  { value: 'APAC_EAST', label: '🇯🇵 APAC East (Tokyo)' },
];

// Tiers with minimum required plan
const ALL_TIERS = [
  { value: 'NANO',   label: 'Nano — 0.25 vCPU · 50 MB mem · 100 MB storage', minPlan: 'FREE' },
  { value: 'MICRO',  label: 'Micro — 0.5 vCPU · 512 MB mem · 5 GB storage',  minPlan: 'STARTER' },
  { value: 'SMALL',  label: 'Small — 1 vCPU · 1 GB mem · 20 GB storage',      minPlan: 'BASIC' },
  { value: 'MEDIUM', label: 'Medium — 2 vCPU · 2 GB mem · 50 GB storage',     minPlan: 'BASIC' },
  { value: 'LARGE',  label: 'Large — 4 vCPU · 4 GB mem · 100 GB storage',     minPlan: 'PRO' },
  { value: 'XL',     label: 'XL — 8 vCPU · 8 GB mem · 500 GB storage',        minPlan: 'ENTERPRISE' },
];

const PLAN_TIER_ORDER: Record<string, number> = {
  FREE: 0, STARTER: 1, BASIC: 2, PRO: 3, ENTERPRISE: 4,
};

function tiersForPlan(plan: string) {
  const planRank = PLAN_TIER_ORDER[plan] ?? 0;
  return ALL_TIERS.filter((t) => (PLAN_TIER_ORDER[t.minPlan] ?? 0) <= planRank);
}

const STATUS_MAP: Record<string, { label: string; variant: 'active' | 'pending' | 'neutral' | 'error' }> = {
  RUNNING:      { label: 'Running',      variant: 'active' },
  PROVISIONING: { label: 'Provisioning', variant: 'pending' },
  PAUSED:       { label: 'Paused',       variant: 'neutral' },
  ERROR:        { label: 'Error',        variant: 'error' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, variant: 'neutral' as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

// ── Create Instance Dialog ─────────────────────────────────────────────────────
function CreateInstanceDialog({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { workspaceId, workspace } = useWorkspace();
  const token = getAccessToken() ?? '';
  const [name, setName] = React.useState('');
  const [region, setRegion] = React.useState('US_EAST');
  const [tier, setTier] = React.useState('NANO');

  const plan = workspace?.plan ?? 'FREE';
  const availableTiers = tiersForPlan(plan);

  // Reset tier if the current value is not available for this plan
  React.useEffect(() => {
    if (!availableTiers.find((t) => t.value === tier)) {
      setTier(availableTiers[0]?.value ?? 'NANO');
    }
  }, [plan, availableTiers, tier]);

  const mutation = useMutation({
    mutationFn: () =>
      instanceApi.create(token, workspaceId!, { name: name.trim(), region, tier, version: 'latest' }),
    onSuccess: () => {
      toast.success(`Instance "${name.trim()}" is provisioning`);
      setName('');
      setRegion('US_EAST');
      setTier(availableTiers[0]?.value ?? 'NANO');
      onCreated();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Launch instance</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Instance name</label>
                <Input
                  placeholder="e.g. prod-eu"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Region</label>
                <Select value={region} onChange={(e) => setRegion(e.target.value)}>
                  {REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Tier</label>
                <Select value={tier} onChange={(e) => setTier(e.target.value)}>
                  {availableTiers.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
                {plan === 'FREE' && (
                  <p className="text-xs text-ink-3 mt-1">
                    Free plan includes Nano only. <a href="/dashboard/billing" className="text-accent hover:underline">Upgrade</a> for larger instances.
                  </p>
                )}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || mutation.isPending} isLoading={mutation.isPending}>
              Launch
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Confirmation Dialog ─────────────────────────────────────────────────
function DeleteDialog({
  instance, onClose, onDeleted,
}: {
  instance: Instance | null;
  onClose: () => void;
  onDeleted: (instanceId: string) => void;
}) {
  const { workspaceId } = useWorkspace();
  const token = getAccessToken() ?? '';
  const [confirm, setConfirm] = React.useState('');

  const mutation = useMutation({
    mutationFn: () => instanceApi.delete(token, workspaceId!, instance!.id),
    onSuccess: () => {
      toast.success(`Instance "${instance?.name}" deleted`);
      setConfirm('');
      if (instance?.id) onDeleted(instance.id);
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={!!instance} onOpenChange={(v) => { if (!v) { setConfirm(''); onClose(); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete instance</DialogTitle></DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-danger/10 border border-danger/20 text-sm text-danger">
              This will permanently destroy the instance and all its data.
            </div>
            <p className="text-sm text-ink-2">
              Type <strong className="text-ink">{instance?.name}</strong> to confirm.
            </p>
            <Input
              placeholder={instance?.name}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoFocus
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setConfirm(''); onClose(); }}>Cancel</Button>
          <Button
            variant="danger"
            disabled={confirm !== instance?.name || mutation.isPending}
            isLoading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function InstancesPage() {
  const { workspaceId } = useWorkspace();
  const { user, loading } = useAuth();
  const token = getAccessToken() ?? '';
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Instance | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['instances', workspaceId] });

  const { data: instances = [], isLoading, isError } = useQuery({
    queryKey: ['instances', workspaceId],
    queryFn: () => instanceApi.list(token, workspaceId!),
    enabled: !loading && !!user && !!workspaceId && !!token,
    retry: 2,
    refetchInterval: (q) =>
      q.state.data?.some((i) => i.status === 'PROVISIONING') ? 5000 : false,
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => instanceApi.pause(token, workspaceId!, id),
    onSuccess: (inst) => { toast.success(`"${inst.name}" paused`); invalidate(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => instanceApi.resume(token, workspaceId!, id),
    onSuccess: (inst) => { toast.success(`"${inst.name}" resumed`); invalidate(); },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <DashboardLayout>
      <Topbar
        title="Instances"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            New instance
          </Button>
        }
      />
      <PageWrapper>
        <div className="space-y-4">
          {isLoading && (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-ink-3" />
            </div>
          )}

          {isError && (
            <div className="flex items-center gap-2 py-8 text-sm text-danger">
              <AlertCircle className="w-4 h-4" /> Failed to load instances.
            </div>
          )}

          {!isLoading && !isError && instances.map((inst) => (
            <Card key={inst.id}>
              <CardBody>
                <div className="flex items-start gap-5">
                  <div className="mt-0.5 p-2.5 rounded-md bg-bg-3 shrink-0">
                    <Server className="w-5 h-5 text-accent" />
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-ink">{inst.name}</span>
                      <StatusBadge status={inst.status} />
                      <span className="text-xs text-ink-3 font-mono">v{inst.version}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <div className="text-ink-3 mb-0.5">Region</div>
                        <div className="text-ink font-medium">{REGION_LABELS[inst.region] ?? inst.region}</div>
                      </div>
                      <div>
                        <div className="text-ink-3 mb-0.5">Tier</div>
                        <div className="text-ink font-medium">{inst.tier}</div>
                      </div>
                      <div>
                        <div className="text-ink-3 mb-0.5">Resources</div>
                        <div className="text-ink font-mono">{inst.cpuMillicores}m · {inst.memoryMb} MB</div>
                      </div>
                      <div>
                        <div className="text-ink-3 mb-0.5">Storage</div>
                        <div className="text-ink font-medium">{inst.storageGb} GB</div>
                      </div>
                    </div>

                    {inst.endpoint && (
                      <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-ink-3 shrink-0" />
                        <span className="text-xs font-mono text-ink-2">{inst.endpoint}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {inst.status === 'RUNNING' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => pauseMutation.mutate(inst.id)}
                        disabled={pauseMutation.isPending}
                      >
                        <Pause className="w-4 h-4 mr-1" />
                        Pause
                      </Button>
                    )}
                    {inst.status === 'PAUSED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resumeMutation.mutate(inst.id)}
                        disabled={resumeMutation.isPending}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Resume
                      </Button>
                    )}
                    <button
                      onClick={() => setDeleteTarget(inst)}
                      className="p-1.5 rounded hover:bg-bg-3 text-ink-3 hover:text-danger transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}

          {!isLoading && !isError && instances.length === 0 && (
            <div className="text-center py-16 text-ink-3">
              <Server className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No instances yet</p>
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                Launch your first instance
              </Button>
            </div>
          )}
        </div>
      </PageWrapper>

      <CreateInstanceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={invalidate}
      />
      <DeleteDialog
        instance={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(instanceId) => {
          qc.setQueryData<Instance[]>(['instances', workspaceId], (prev) =>
            (prev ?? []).filter((item) => item.id !== instanceId),
          );
          invalidate();
        }}
      />
    </DashboardLayout>
  );
}
