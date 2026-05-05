'use client';

import * as React from 'react';
import { AdminAuthGate } from '../../components/admin-auth-gate';
import { adminApi, type AdminIncidentList, type AdminIncidentRow } from '../../lib/admin-client';

type IncidentFilter = 'all' | 'critical' | 'warning';

function SeverityBadge({ severity }: { severity: 'critical' | 'warning' }) {
  const cfg: Record<'critical' | 'warning', string> = {
    critical: 'bg-[#f5656530] text-[#f56565] border border-[#f56565]',
    warning: 'bg-[#f6ad5520] text-[#f6ad55]',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${cfg[severity]}`}>{severity}</span>;
}

function TypeBadge({ type }: { type: AdminIncidentRow['type'] }) {
  const cfg: Record<AdminIncidentRow['type'], string> = {
    webhook_delivery_failed: 'bg-[#6c8fff20] text-[#6c8fff]',
    subscription_past_due: 'bg-[#f5656520] text-[#f56565]',
    replication_health: 'bg-[#f6ad5520] text-[#f6ad55]',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${cfg[type]}`}>{type}</span>;
}

function IncidentsTable({ token, refreshKey }: { token: string; refreshKey: number }) {
  const [filter, setFilter] = React.useState<IncidentFilter>('all');
  const [data, setData] = React.useState<AdminIncidentList | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');

    adminApi
      .listIncidents(token, 100)
      .then((result) => {
        if (!mounted) return;
        setData(result);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load incidents');
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [token, refreshKey]);

  const rows = (data?.data ?? []).filter((item) => (filter === 'all' ? true : item.severity === filter));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#e8eaf0]">Incident Console</h1>
          <p className="text-sm text-[#6c7a96] mt-0.5">
            {(data?.counts.critical ?? 0) > 0 ? (
              <span className="text-[#f56565]">{data?.counts.critical ?? 0} critical incidents</span>
            ) : (
              <span className="text-[#48bb78]">No critical incidents</span>
            )}
          </p>
        </div>
        <div className="flex gap-1.5">
          {(['all', 'critical', 'warning'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                filter === s
                  ? 'bg-[#6c8fff] text-white'
                  : 'bg-[#131720] text-[#9aa3b8] hover:text-[#e8eaf0]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="text-sm text-[#f56565]">{error}</div>}
      {loading && <div className="text-sm text-[#9aa3b8]">Loading incidents...</div>}

      <div className="bg-[#0d1018] border border-[#1e2433] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1e2433]">
              {['ID', 'Severity', 'Type', 'Title', 'Workspace', 'Occurred'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#6c7a96] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2433]">
            {rows.map((inc) => (
              <tr key={inc.id} className="hover:bg-[#131720] transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-[#9aa3b8]">{inc.id}</td>
                <td className="px-4 py-3"><SeverityBadge severity={inc.severity} /></td>
                <td className="px-4 py-3"><TypeBadge type={inc.type} /></td>
                <td className="px-4 py-3 text-sm text-[#e8eaf0] max-w-sm">{inc.title}</td>
                <td className="px-4 py-3 text-sm font-mono text-[#9aa3b8]">{inc.workspace.slug ?? 'N/A'}</td>
                <td className="px-4 py-3 text-xs text-[#6c7a96]">{new Date(inc.occurredAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-[#6c7a96]">No incidents match the selected filter.</div>
        )}
      </div>
    </div>
  );
}

export default function IncidentsPage() {
  return (
    <AdminAuthGate>
      {(token, refreshKey) => <IncidentsTable token={token} refreshKey={refreshKey} />}
    </AdminAuthGate>
  );
}
