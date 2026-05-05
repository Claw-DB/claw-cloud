'use client';

import * as React from 'react';
import { AdminAuthGate } from '../../components/admin-auth-gate';
import { adminApi, type AdminInstanceList } from '../../lib/admin-client';

type InstanceStatus = 'PROVISIONING' | 'RUNNING' | 'SCALING' | 'PAUSED' | 'TERMINATING' | 'TERMINATED' | 'ERROR';

function InstanceStatusBadge({ status }: { status: InstanceStatus }) {
  const cfg: Record<InstanceStatus, { cls: string; label: string }> = {
    PROVISIONING: { cls: 'bg-[#f6ad5520] text-[#f6ad55]', label: 'Provisioning' },
    RUNNING: { cls: 'bg-[#48bb7820] text-[#48bb78]', label: 'Running' },
    SCALING: { cls: 'bg-[#6c8fff20] text-[#6c8fff]', label: 'Scaling' },
    PAUSED: { cls: 'bg-[#1e2433] text-[#9aa3b8]', label: 'Paused' },
    TERMINATING: { cls: 'bg-[#f6ad5520] text-[#f6ad55]', label: 'Terminating' },
    TERMINATED: { cls: 'bg-[#1e2433] text-[#6c7a96]', label: 'Terminated' },
    ERROR: { cls: 'bg-[#f5656520] text-[#f56565]', label: 'Error' },
  };
  const { cls, label } = cfg[status];
  return <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}>{label}</span>;
}

function InstancesTable({ token, refreshKey }: { token: string; refreshKey: number }) {
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [region, setRegion] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<AdminInstanceList | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.listInstances(token, {
        status: status || undefined,
        region: region || undefined,
        page,
        limit: 25,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load instances');
    } finally {
      setLoading(false);
    }
  }, [token, status, region, page]);

  React.useEffect(() => {
    load();
  }, [load, refreshKey]);

  const rows = (data?.data ?? []).filter((row) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return row.name.toLowerCase().includes(needle) || row.workspace.slug.toLowerCase().includes(needle);
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#e8eaf0]">Global Instances</h1>
          <p className="text-sm text-[#6c7a96] mt-0.5">{(data?.total ?? 0).toLocaleString()} instances across all tenants</p>
        </div>
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Search by name or workspace"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 px-3 py-1.5 rounded-lg border border-[#1e2433] bg-[#131720] text-sm text-[#e8eaf0] placeholder:text-[#6c7a96] focus:outline-none focus:border-[#6c8fff]"
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg border border-[#1e2433] bg-[#131720] text-sm text-[#e8eaf0]"
          >
            <option value="">All status</option>
            <option value="PROVISIONING">Provisioning</option>
            <option value="RUNNING">Running</option>
            <option value="SCALING">Scaling</option>
            <option value="PAUSED">Paused</option>
            <option value="TERMINATING">Terminating</option>
            <option value="TERMINATED">Terminated</option>
            <option value="ERROR">Error</option>
          </select>
          <select
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg border border-[#1e2433] bg-[#131720] text-sm text-[#e8eaf0]"
          >
            <option value="">All regions</option>
            <option value="US_EAST">US_EAST</option>
            <option value="US_WEST">US_WEST</option>
            <option value="EU_WEST">EU_WEST</option>
            <option value="EU_CENTRAL">EU_CENTRAL</option>
            <option value="APAC_EAST">APAC_EAST</option>
          </select>
        </div>
      </div>

      {error && <div className="text-sm text-[#f56565]">{error}</div>}
      {loading && <div className="text-sm text-[#9aa3b8]">Loading instances...</div>}

      <div className="bg-[#0d1018] border border-[#1e2433] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1e2433]">
              {['Instance', 'Workspace', 'Tier', 'Region', 'CPU', 'Memory', 'Storage', 'Status', 'Updated'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#6c7a96] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2433]">
            {rows.map((inst) => (
              <tr key={inst.id} className="hover:bg-[#131720] transition-colors">
                <td className="px-4 py-3 font-mono text-sm text-[#e8eaf0]">{inst.name}</td>
                <td className="px-4 py-3 text-sm text-[#9aa3b8]">{inst.workspace.slug}</td>
                <td className="px-4 py-3 text-xs font-mono text-[#6c7a96]">{inst.tier}</td>
                <td className="px-4 py-3 text-xs text-[#9aa3b8]">{inst.region}</td>
                <td className="px-4 py-3 text-xs text-[#9aa3b8]">{inst.cpuMillicores}m</td>
                <td className="px-4 py-3 text-xs text-[#9aa3b8]">{inst.memoryMb} MB</td>
                <td className="px-4 py-3 text-xs text-[#9aa3b8]">{inst.storageGb} GB</td>
                <td className="px-4 py-3"><InstanceStatusBadge status={inst.status} /></td>
                <td className="px-4 py-3 text-xs text-[#6c7a96]">{new Date(inst.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-[#6c7a96]">No instances match your search.</div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-[#6c7a96]">
          Page {data?.page ?? 1} of {data?.totalPages ?? 1}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={(data?.page ?? 1) <= 1}
            className="text-xs px-2.5 py-1 rounded-md border border-[#1e2433] text-[#9aa3b8] disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => ((data && prev < data.totalPages) ? prev + 1 : prev))}
            disabled={Boolean(data && data.page >= data.totalPages)}
            className="text-xs px-2.5 py-1 rounded-md border border-[#1e2433] text-[#9aa3b8] disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminInstancesPage() {
  return (
    <AdminAuthGate>
      {(token, refreshKey) => <InstancesTable token={token} refreshKey={refreshKey} />}
    </AdminAuthGate>
  );
}
