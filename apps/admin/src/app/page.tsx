'use client';

import * as React from 'react';
import { AdminAuthGate } from '../components/admin-auth-gate';
import { adminApi, type AdminFlags, type AdminOverview } from '../lib/admin-client';

function fmtTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function OverviewContent({ token, refreshKey }: { token: string; refreshKey: number }) {
  const [overview, setOverview] = React.useState<AdminOverview | null>(null);
  const [flags, setFlags] = React.useState<AdminFlags | null>(null);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');

    Promise.all([adminApi.getOverview(token), adminApi.getFlags(token)])
      .then(([overviewData, flagsData]) => {
        if (!mounted) return;
        setOverview(overviewData);
        setFlags(flagsData);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load admin overview');
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [token, refreshKey]);

  if (loading) {
    return <div className="p-6 text-sm text-[#9aa3b8]">Loading platform overview...</div>;
  }

  if (error || !overview || !flags) {
    return <div className="p-6 text-sm text-[#f56565]">{error || 'Failed to load overview'}</div>;
  }

  const cards = [
    { label: 'Total Workspaces', value: overview.totals.workspaces },
    { label: 'Active Workspaces', value: overview.totals.activeWorkspaces },
    { label: 'Total Instances', value: overview.totals.instances },
    { label: 'Running Instances', value: overview.totals.runningInstances },
    { label: 'Failed Webhook Deliveries', value: overview.health.failedWebhookDeliveries },
    { label: 'Past Due Subscriptions', value: overview.health.pastDueSubscriptions },
    { label: 'Lagging Replication Links', value: overview.health.laggingReplicationLinks },
    { label: 'Broken Replication Links', value: overview.health.brokenReplicationLinks },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#e8eaf0]">Platform Overview</h1>
          <p className="text-sm text-[#6c7a96] mt-0.5">Live operational metrics from the admin API.</p>
        </div>
        <div className="text-xs text-[#6c7a96] bg-[#131720] border border-[#1e2433] px-3 py-1.5 rounded-md">
          Updated: {fmtTime(overview.generatedAt)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((item) => (
          <div key={item.label} className="bg-[#0d1018] border border-[#1e2433] rounded-xl p-4">
            <div className="text-xs text-[#6c7a96] uppercase tracking-wider mb-1">{item.label}</div>
            <div className="text-2xl font-bold text-[#e8eaf0]">{item.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#0d1018] border border-[#1e2433] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#e8eaf0] mb-3">Risk Flags</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between border border-[#1e2433] rounded-md px-3 py-2">
            <span className="text-[#9aa3b8]">Suspended workspaces</span>
            <span className="text-[#e8eaf0] font-mono">{flags.suspendedWorkspaces}</span>
          </div>
          <div className="flex justify-between border border-[#1e2433] rounded-md px-3 py-2">
            <span className="text-[#9aa3b8]">Past due subscriptions</span>
            <span className="text-[#e8eaf0] font-mono">{flags.pastDueSubscriptions}</span>
          </div>
          <div className="flex justify-between border border-[#1e2433] rounded-md px-3 py-2">
            <span className="text-[#9aa3b8]">Lagging replication links</span>
            <span className="text-[#e8eaf0] font-mono">{flags.laggingLinks}</span>
          </div>
          <div className="flex justify-between border border-[#1e2433] rounded-md px-3 py-2">
            <span className="text-[#9aa3b8]">Broken replication links</span>
            <span className="text-[#e8eaf0] font-mono">{flags.brokenLinks}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  return (
    <AdminAuthGate>
      {(token, refreshKey) => <OverviewContent token={token} refreshKey={refreshKey} />}
    </AdminAuthGate>
  );
}
