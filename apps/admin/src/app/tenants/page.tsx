'use client';

import * as React from 'react';
import { AdminAuthGate } from '../../components/admin-auth-gate';
import { adminApi, type AdminWorkspaceList, type AdminWorkspaceRow } from '../../lib/admin-client';

type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

function StatusBadge({ status }: { status: TenantStatus }) {
  if (status === 'ACTIVE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-[#48bb7820] text-[#48bb78]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#48bb78]" />Active
      </span>
    );
  }
  if (status === 'SUSPENDED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-[#f5656520] text-[#f56565]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#f56565]" />Suspended
      </span>
    );
  }
  return <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-[#1e2433] text-[#9aa3b8]">Deleted</span>;
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    FREE: 'bg-[#1e2433] text-[#9aa3b8]',
    STARTER: 'bg-[#6c8fff20] text-[#6c8fff]',
    PRO: 'bg-[#f6ad5520] text-[#f6ad55]',
    ENTERPRISE: 'bg-[#b794f420] text-[#b794f4]',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${colors[plan] ?? 'bg-[#1e2433] text-[#9aa3b8]'}`}>{plan}</span>;
}

function TenantsTable({ token, refreshKey, onRefresh }: { token: string; refreshKey: number; onRefresh: () => void }) {
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<string>('');
  const [plan, setPlan] = React.useState<string>('');
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<AdminWorkspaceList | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [busyWorkspaceId, setBusyWorkspaceId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.listWorkspaces(token, {
        search,
        status: status || undefined,
        plan: plan || undefined,
        page,
        limit: 25,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, [token, search, status, plan, page]);

  React.useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function toggleSuspend(workspace: AdminWorkspaceRow) {
    if (workspace.status === 'DELETED') return;
    setBusyWorkspaceId(workspace.id);
    setError('');
    try {
      if (workspace.status === 'ACTIVE') {
        await adminApi.suspendWorkspace(token, workspace.id);
      } else {
        await adminApi.reactivateWorkspace(token, workspace.id);
      }
      await load();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update workspace status');
    } finally {
      setBusyWorkspaceId(null);
    }
  }

  const rows = data?.data ?? [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#e8eaf0]">Tenants</h1>
          <p className="text-sm text-[#6c7a96] mt-0.5">{(data?.total ?? 0).toLocaleString()} total workspaces</p>
        </div>
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Search by name, slug, or owner"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
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
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DELETED">Deleted</option>
          </select>
          <select
            value={plan}
            onChange={(e) => {
              setPlan(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg border border-[#1e2433] bg-[#131720] text-sm text-[#e8eaf0]"
          >
            <option value="">All plans</option>
            <option value="FREE">Free</option>
            <option value="STARTER">Starter</option>
            <option value="PRO">Pro</option>
            <option value="ENTERPRISE">Enterprise</option>
          </select>
        </div>
      </div>

      {error && <div className="text-sm text-[#f56565]">{error}</div>}
      {loading && <div className="text-sm text-[#9aa3b8]">Loading tenants...</div>}

      <div className="bg-[#0d1018] border border-[#1e2433] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1e2433]">
              {['Workspace', 'Owner', 'Plan', 'Members', 'Instances', 'Status', 'Created', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#6c7a96] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2433]">
            {rows.map((t) => (
              <tr key={t.id} className="hover:bg-[#131720] transition-colors">
                <td className="px-4 py-3 font-mono text-sm text-[#e8eaf0]">{t.slug}</td>
                <td className="px-4 py-3 text-sm text-[#9aa3b8]">{t.owner.email}</td>
                <td className="px-4 py-3"><PlanBadge plan={t.plan} /></td>
                <td className="px-4 py-3 text-sm text-[#9aa3b8]">{t._count.members}</td>
                <td className="px-4 py-3 text-sm text-[#9aa3b8]">{t._count.instances}</td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-3 text-sm text-[#6c7a96]">{new Date(t.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleSuspend(t)}
                    disabled={t.status === 'DELETED' || busyWorkspaceId === t.id}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-colors disabled:opacity-50 ${t.status === 'ACTIVE' ? 'border-[#f56565] text-[#f56565] hover:bg-[#f5656520]' : 'border-[#48bb78] text-[#48bb78] hover:bg-[#48bb7820]'}`}
                  >
                    {busyWorkspaceId === t.id ? 'Saving...' : t.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-[#6c7a96]">No tenants match your search.</div>
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

export default function TenantsPage() {
  return (
    <AdminAuthGate>
      {(token, refreshKey, onRefresh) => (
        <TenantsTable token={token} refreshKey={refreshKey} onRefresh={onRefresh} />
      )}
    </AdminAuthGate>
  );
}
