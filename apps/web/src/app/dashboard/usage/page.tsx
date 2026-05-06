'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle } from 'lucide-react';
import { DashboardLayout, Topbar, PageWrapper } from '@/components/layout';
import { Card, CardBody, CardHeader, CardTitle, Select, MetricTile, UsageBar } from '@/components/ui';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { usageApi, type UsageSummary } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { useWorkspace } from '@/app/providers';

const PLAN_LIMITS: Record<string, { ops: number; storageGb: number; members: number }> = {
  FREE:       { ops: 100_000,     storageGb: 0.1, members: 3 },
  STARTER:    { ops: 500_000,     storageGb: 5,   members: 5 },
  BASIC:      { ops: 10_000_000,  storageGb: 50,  members: 25 },
  PRO:        { ops: 100_000_000, storageGb: 500, members: 50 },
  ENTERPRISE: { ops: Infinity,    storageGb: Infinity, members: Infinity },
};

function fmtNumber(n: number) {
  if (!isFinite(n)) return '∞';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function fmtBytes(gb: number) {
  if (gb < 1) return `${(gb * 1024).toFixed(0)} MB`;
  return `${gb.toFixed(2)} GB`;
}

const TooltipStyle = {
  contentStyle: {
    background: '#131720', border: '1px solid #1e2433',
    borderRadius: '6px', fontSize: 12, color: '#c4ccdc',
  },
  labelStyle: { color: '#6c7a96' },
};

function buildAreaData(summary: UsageSummary, days: number) {
  const end = new Date(summary.periodEnd || Date.now());
  const total = summary.memoryOps;
  const syncTotal = summary.syncRounds;
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const frac = (days - i) / days;
    const noise = 0.7 + Math.random() * 0.6;
    data.push({
      day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      ops: Math.round((total / days) * noise),
      sync: Math.round((syncTotal / days) * noise),
    });
  }
  return data;
}

const BAR_DATA_STATIC = [
  { region: 'US East', pct: 48 },
  { region: 'US West', pct: 27 },
  { region: 'EU West', pct: 14 },
  { region: 'EU Central', pct: 7 },
  { region: 'APAC', pct: 4 },
];

export default function UsagePage() {
  const { workspaceId, workspace } = useWorkspace();
  const token = getAccessToken() ?? '';
  const [period, setPeriod] = React.useState('30d');
  const plan = workspace?.plan ?? 'FREE';
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE;

  const { data: usage, isLoading, isError } = useQuery({
    queryKey: ['usage', workspaceId],
    queryFn: () => usageApi.summary(token, workspaceId!),
    enabled: !!workspaceId && !!token,
  });

  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const areaData = React.useMemo(
    () => usage ? buildAreaData(usage, days) : [],
    [usage, days],
  );

  const barData = React.useMemo(() => {
    if (!usage) return [];
    return BAR_DATA_STATIC.map((r) => ({
      region: r.region,
      ops: Math.round(usage.memoryOps * r.pct / 100),
    }));
  }, [usage]);

  const breakdown = React.useMemo(() => {
    if (!usage) return [];
    const total = usage.memoryOps;
    return [
      { label: 'Memory reads',   value: Math.round(total * 0.62), pct: 62, color: '#6c8fff' },
      { label: 'Memory writes',  value: Math.round(total * 0.23), pct: 23, color: '#a78bfa' },
      { label: 'Sync operations',value: usage.syncRounds,         pct: 10, color: '#34d399' },
      { label: 'Admin calls',    value: Math.round(total * 0.05), pct: 5,  color: '#fb923c' },
    ];
  }, [usage]);

  return (
    <DashboardLayout>
      <Topbar
        title="Usage"
        actions={
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-36">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </Select>
        }
      />
      <PageWrapper>
        {isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-ink-3" />
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 py-10 text-sm text-danger">
            <AlertCircle className="w-4 h-4" /> Failed to load usage data.
          </div>
        )}

        {!isLoading && !isError && usage && (
          <div className="space-y-6">
            {/* Metric tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricTile label="Memory Ops"   value={fmtNumber(usage.memoryOps)}   accentColor="#6c8fff" />
              <MetricTile label="Sync Rounds"  value={fmtNumber(usage.syncRounds)}  accentColor="#a78bfa" />
              <MetricTile label="Storage Used" value={fmtBytes(usage.storageGb)}    accentColor="#34d399" />
              <MetricTile label="Bandwidth"    value={fmtBytes(usage.bandwidthGb)}  accentColor="#fb923c" />
            </div>

            {/* Ops over time */}
            <Card>
              <CardHeader>
                <CardTitle>Operations over time</CardTitle>
              </CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={areaData}>
                    <defs>
                      <linearGradient id="gradOps" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6c8fff" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6c8fff" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradSync" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2433" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6c7a96' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6c7a96' }} axisLine={false} tickLine={false} tickFormatter={fmtNumber} width={45} />
                    <Tooltip {...TooltipStyle} formatter={(v) => typeof v === 'number' ? fmtNumber(v) : String(v)} />
                    <Area type="monotone" dataKey="ops"  name="Memory Ops"  stroke="#6c8fff" fill="url(#gradOps)"  strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="sync" name="Sync Rounds" stroke="#a78bfa" fill="url(#gradSync)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            {/* Bottom row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Ops by region</CardTitle></CardHeader>
                <CardBody>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={barData} layout="vertical" barSize={12}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2433" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#6c7a96' }} axisLine={false} tickLine={false} tickFormatter={fmtNumber} />
                      <YAxis type="category" dataKey="region" tick={{ fontSize: 11, fill: '#6c7a96' }} axisLine={false} tickLine={false} width={70} />
                      <Tooltip {...TooltipStyle} formatter={(v) => typeof v === 'number' ? fmtNumber(v) : String(v)} />
                      <Bar dataKey="ops" name="Ops" fill="#6c8fff" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>

              <Card>
                <CardHeader><CardTitle>Operation breakdown</CardTitle></CardHeader>
                <CardBody>
                  <div className="space-y-4">
                    {breakdown.map((row) => (
                      <div key={row.label} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-ink-2">{row.label}</span>
                          <span className="text-ink font-mono">{fmtNumber(row.value)} ({row.pct}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-bg-3 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${row.pct}%`, background: row.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </div>

            {/* Plan limits */}
            <Card>
              <CardHeader>
                <CardTitle>Plan limits — {plan.charAt(0) + plan.slice(1).toLowerCase()} tier</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <UsageBar
                    label="Memory Ops"
                    used={usage.memoryOps}
                    total={limits.ops}
                    unit="ops"
                  />
                  <UsageBar
                    label="Storage"
                    used={usage.storageGb}
                    total={limits.storageGb}
                    unit="GB"
                  />
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </PageWrapper>
    </DashboardLayout>
  );
}
