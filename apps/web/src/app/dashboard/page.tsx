'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Server, Key, ArrowUpRight, Loader2, AlertCircle } from 'lucide-react';
import { DashboardLayout, Topbar, PageWrapper } from '@/components/layout';
import { MetricTile, Card, CardHeader, CardTitle, CardBody, UsageBar, Button } from '@/components/ui';
import { useAuth, useWorkspace } from '@/app/providers';
import { usageApi, instanceApi, apiKeyApi } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import Link from 'next/link';

function fmtNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtBytes(gb: number) {
  if (gb < 1) return `${(gb * 1024).toFixed(0)} MB`;
  return `${gb.toFixed(2)} GB`;
}

const PLAN_LIMITS: Record<string, { ops: number; storageGb: number; members: number }> = {
  FREE:       { ops: 100_000,     storageGb: 0.1, members: 3 },
  STARTER:    { ops: 500_000,     storageGb: 5,   members: 5 },
  BASIC:      { ops: 10_000_000,  storageGb: 50,  members: 25 },
  PRO:        { ops: 100_000_000, storageGb: 500, members: 50 },
  ENTERPRISE: { ops: Infinity,    storageGb: Infinity, members: Infinity },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { workspaceId, workspace } = useWorkspace();
  const token = getAccessToken() ?? '';
  const plan = workspace?.plan ?? 'FREE';
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE;

  const usageQ = useQuery({
    queryKey: ['usage', workspaceId],
    queryFn: () => usageApi.summary(token, workspaceId!),
    enabled: !!workspaceId && !!token,
  });

  const instancesQ = useQuery({
    queryKey: ['instances', workspaceId],
    queryFn: () => instanceApi.list(token, workspaceId!),
    enabled: !!workspaceId && !!token,
  });

  const keysQ = useQuery({
    queryKey: ['api-keys', workspaceId],
    queryFn: () => apiKeyApi.list(token, workspaceId!),
    enabled: !!workspaceId && !!token,
  });

  const usage = usageQ.data;
  const instances = instancesQ.data ?? [];
  const keys = (keysQ.data ?? []).filter((k) => !k.revokedAt);
  const runningInstances = instances.filter((i) => i.status === 'RUNNING').length;

  return (
    <DashboardLayout>
      <Topbar title="Dashboard" />
      <PageWrapper>
        <div className="space-y-7">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricTile
              label="Memory Ops"
              value={usage ? fmtNumber(usage.memoryOps) : '—'}
              accentColor="#6c8fff"
            />
            <MetricTile
              label="Sync Rounds"
              value={usage ? fmtNumber(usage.syncRounds) : '—'}
              accentColor="#22c55e"
            />
            <MetricTile
              label="Storage Used"
              value={usage ? fmtBytes(usage.storageGb) : '—'}
              accentColor="#f59e0b"
            />
            <MetricTile
              label="Active Instances"
              value={instancesQ.isLoading ? '—' : String(runningInstances)}
              accentColor="#a78bfa"
            />
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-12 gap-4">
            {/* Left — Instances overview */}
            <div className="col-span-12 lg:col-span-7">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Instances</CardTitle>
                  <Link href="/dashboard/instances">
                    <Button variant="ghost" size="sm">
                      View all
                      <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardBody className="p-0">
                  {instancesQ.isLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-5 h-5 animate-spin text-ink-3" />
                    </div>
                  ) : instancesQ.isError ? (
                    <div className="flex items-center gap-2 px-5 py-8 text-sm text-ink-3">
                      <AlertCircle className="w-4 h-4 text-danger" />
                      Failed to load instances
                    </div>
                  ) : instances.length === 0 ? (
                    <div className="flex flex-col items-center py-10 gap-3 text-sm text-ink-3">
                      <Server className="w-8 h-8 opacity-30" />
                      <p>No instances yet</p>
                      <Link href="/dashboard/instances">
                        <Button size="sm">Launch first instance</Button>
                      </Link>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          {['Name', 'Region', 'Tier', 'Status'].map((h) => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {instances.slice(0, 5).map((inst) => (
                          <tr key={inst.id} className="border-b border-border last:border-0 hover:bg-bg-2 transition-colors">
                            <td className="px-5 py-3 text-sm font-medium text-ink">{inst.name}</td>
                            <td className="px-5 py-3 text-xs text-ink-3 font-mono">{inst.region}</td>
                            <td className="px-5 py-3 text-xs text-ink-3">{inst.tier}</td>
                            <td className="px-5 py-3">
                              <span className={`text-xs font-medium ${
                                inst.status === 'RUNNING' ? 'text-success' :
                                inst.status === 'PAUSED'  ? 'text-ink-3' :
                                inst.status === 'ERROR'   ? 'text-danger' : 'text-warning'
                              }`}>
                                {inst.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardBody>
              </Card>
            </div>

            {/* Right — Quick Connect + Usage */}
            <div className="col-span-12 lg:col-span-5 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Connect</CardTitle>
                </CardHeader>
                <CardBody className="space-y-3">
                  {keysQ.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-ink-3">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading keys…
                    </div>
                  ) : keys.length === 0 ? (
                    <p className="text-sm text-ink-3">No active API keys.</p>
                  ) : (
                    <div>
                      <p className="text-xs text-ink-3 mb-2">Active API Key</p>
                      <code className="text-xs font-mono bg-bg-2 px-3 py-2 rounded block truncate">
                        {keys[0].keyPrefix}••••••••••••
                      </code>
                    </div>
                  )}
                  <Link href="/dashboard/api-keys" className="block">
                    <Button variant="primary" className="w-full">
                      <Key className="w-4 h-4 mr-1.5" />
                      Manage Keys
                    </Button>
                  </Link>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Usage this period</CardTitle>
                </CardHeader>
                <CardBody className="space-y-4">
                  {usageQ.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-ink-3">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                    </div>
                  ) : (
                    <>
                      <UsageBar
                        label="Memory Ops"
                        used={usage?.memoryOps ?? 0}
                        total={limits.ops}
                        unit="ops"
                        colorClass="bg-accent"
                      />
                      <UsageBar
                        label="Storage"
                        used={usage?.storageGb ?? 0}
                        total={limits.storageGb}
                        unit="GB"
                        colorClass="bg-warning"
                      />
                    </>
                  )}
                  <div className="pt-1">
                    <span className="text-xs font-medium text-ink capitalize">{plan}</span>
                    <span className="text-xs text-ink-3"> plan</span>
                    {workspace?.trialEndsAt && (
                      <span className="text-xs text-warning ml-2">
                        · trial ends {new Date(workspace.trialEndsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      </PageWrapper>
    </DashboardLayout>
  );
}
