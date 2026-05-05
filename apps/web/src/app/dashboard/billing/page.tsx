'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ArrowUpRight, Receipt, Zap, Loader2 } from 'lucide-react';
import { DashboardLayout, Topbar, PageWrapper } from '@/components/layout';
import { Button, Badge, Card, CardBody, CardHeader, CardTitle, UsageBar } from '@/components/ui';
import { billingApi, usageApi, type Invoice } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { useWorkspace } from '@/app/providers';
import { cn } from '@/lib/utils';

type PlanId = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';

const PLANS: Array<{
  id: PlanId;
  name: string;
  price: string;
  period: string;
  highlight?: boolean;
  features: string[];
}> = [
  {
    id: 'FREE',
    name: 'Free',
    price: '$0',
    period: '/mo',
    features: ['1 instance (Nano)', '1M memory ops/mo', '5 GB storage', '3 team members', '3-day backups'],
  },
  {
    id: 'STARTER',
    name: 'Starter',
    price: '$29',
    period: '/mo',
    highlight: true,
    features: ['3 instances (up to Small)', '10M memory ops/mo', '50 GB storage', '10 team members', '7-day backups', 'Priority support'],
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: '$99',
    period: '/mo',
    features: ['10 instances (up to XL)', '100M memory ops/mo', '500 GB storage', '50 team members', '30-day backups', 'SSO / SAML', 'Dedicated support'],
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    features: ['Unlimited instances', 'Unlimited ops', 'Unlimited storage', 'Unlimited members', '90-day backups', 'On-prem option', 'SLA guarantee'],
  },
];

const PLAN_LIMITS: Record<string, { ops: number; storageGb: number }> = {
  FREE:       { ops: 1_000_000,   storageGb: 5 },
  STARTER:    { ops: 10_000_000,  storageGb: 50 },
  PRO:        { ops: 100_000_000, storageGb: 500 },
  ENTERPRISE: { ops: Infinity,    storageGb: Infinity },
};

function PlanCard({ plan, isCurrentPlan, onUpgrade }: {
  plan: (typeof PLANS)[number];
  isCurrentPlan: boolean;
  onUpgrade: (planId: string) => void;
}) {
  return (
    <div className={cn(
      'rounded-lg border p-5 flex flex-col gap-4 transition-all',
      plan.highlight ? 'border-accent bg-accent/5 ring-2 ring-accent/20' : 'border-border bg-bg-2',
      isCurrentPlan && 'ring-2 ring-green-500/30 border-green-500/40',
    )}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-ink">{plan.name}</div>
          <div className="flex items-baseline gap-0.5 mt-0.5">
            <span className="text-2xl font-bold text-ink">{plan.price}</span>
            <span className="text-sm text-ink-3">{plan.period}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isCurrentPlan && <Badge variant="active">Current</Badge>}
          {plan.highlight && !isCurrentPlan && <Badge variant="info">Popular</Badge>}
        </div>
      </div>

      <ul className="space-y-1.5 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-ink-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>

      <Button
        variant={isCurrentPlan ? 'ghost' : plan.id === 'ENTERPRISE' ? 'outline' : 'primary'}
        size="sm"
        className="w-full"
        disabled={isCurrentPlan}
        onClick={() => !isCurrentPlan && plan.id !== 'ENTERPRISE' && onUpgrade(plan.id)}
      >
        {isCurrentPlan ? 'Current plan' : plan.id === 'ENTERPRISE' ? 'Contact sales' : `Upgrade to ${plan.name}`}
      </Button>
    </div>
  );
}

export default function BillingPage() {
  const { workspaceId, workspace } = useWorkspace();
  const token = getAccessToken() ?? '';
  const currentPlanId = (workspace?.plan ?? 'FREE') as PlanId;
  const limits = PLAN_LIMITS[currentPlanId] ?? PLAN_LIMITS.FREE;

  const billingQ = useQuery({
    queryKey: ['billing', workspaceId],
    queryFn: () => billingApi.getInfo(token, workspaceId!),
    enabled: !!workspaceId && !!token,
    retry: false,
  });

  const usageQ = useQuery({
    queryKey: ['usage', workspaceId],
    queryFn: () => usageApi.summary(token, workspaceId!),
    enabled: !!workspaceId && !!token,
  });

  const invoices: Invoice[] = billingQ.data?.invoices ?? [];
  const usage = usageQ.data;

  const handleUpgrade = async (planId: string) => {
    if (!workspaceId || !token) return;
    try {
      const { url } = await billingApi.createCheckout(token, workspaceId, {
        plan: planId,
        successUrl: `${window.location.origin}/dashboard/billing?upgraded=1`,
        cancelUrl: `${window.location.origin}/dashboard/billing`,
      });
      window.location.href = url;
    } catch {
      window.location.href = 'mailto:sales@clawdb.dev?subject=Upgrade%20request';
    }
  };

  const handleBillingPortal = async () => {
    if (!workspaceId || !token) return;
    try {
      const { url } = await billingApi.openPortal(token, workspaceId, { returnUrl: window.location.href });
      window.location.href = url;
    } catch {
      window.location.href = 'mailto:billing@clawdb.dev';
    }
  };

  return (
    <DashboardLayout>
      <Topbar title="Billing" />
      <PageWrapper>
        <div className="space-y-8">
          {/* Current plan summary */}
          <Card>
            <CardBody>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-accent/10">
                    <Zap className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <div className="text-sm text-ink-3">Current plan</div>
                    <div className="text-lg font-bold text-ink capitalize">
                      {currentPlanId.charAt(0) + currentPlanId.slice(1).toLowerCase()}
                    </div>
                    {workspace?.trialEndsAt && (
                      <div className="text-xs text-ink-3 mt-0.5">
                        Trial ends{' '}
                        <span className="text-amber-400 font-medium">
                          {new Date(workspace.trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleBillingPortal}>
                  <Receipt className="w-4 h-4 mr-1.5" />
                  Billing portal
                  <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Usage this period */}
          {usage && (
            <Card>
              <CardHeader><CardTitle>Usage this period</CardTitle></CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <UsageBar label="Memory Ops" used={usage.memoryOps} total={limits.ops} unit="ops" />
                  <UsageBar label="Storage" used={usage.storageGb} total={limits.storageGb} unit="GB" />
                </div>
                {billingQ.data?.currentPeriodEnd && (
                  <p className="text-xs text-ink-3 mt-4">
                    Usage resets on{' '}
                    <span className="text-ink font-medium">
                      {new Date(billingQ.data.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>.
                  </p>
                )}
              </CardBody>
            </Card>
          )}

          {/* Plans */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-ink">Plans</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {PLANS.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isCurrentPlan={plan.id === currentPlanId}
                  onUpgrade={handleUpgrade}
                />
              ))}
            </div>
          </div>

          {/* Invoice history */}
          <Card>
            <CardHeader><CardTitle>Invoice history</CardTitle></CardHeader>
            <CardBody className="p-0">
              {billingQ.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-ink-3" />
                </div>
              ) : invoices.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-ink-3">No invoices yet.</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {['Period', 'Date', 'Amount', 'Status', ''].map((h, i) => (
                        <th key={i} className="px-5 py-3 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-bg-2 transition-colors">
                        <td className="px-5 py-4 text-sm text-ink">
                          {new Date(inv.periodStart).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-4 text-sm text-ink-3">
                          {new Date(inv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-4 text-sm font-mono text-ink">
                          {(inv.amount / 100).toLocaleString('en-US', { style: 'currency', currency: inv.currency?.toUpperCase() ?? 'USD' })}
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant={inv.status === 'paid' ? 'active' : 'pending'}>{inv.status}</Badge>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {inv.pdfUrl && (
                            <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
                              Download PDF
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </div>
      </PageWrapper>
    </DashboardLayout>
  );
}
