'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout, Topbar, PageWrapper } from '@/components/layout';
import { Button, Card, CardBody, CardHeader, CardTitle, Input } from '@/components/ui';
import { getAccessToken } from '@/lib/auth';
import { useWorkspace } from '@/app/providers';
import { webhooksApi } from '@/lib/api-client';

const EVENT_OPTIONS = [
  'instance.created',
  'instance.status_changed',
  'instance.terminated',
  'backup.completed',
  'backup.failed',
  'replication.lagging',
  'replication.broken',
  'billing.subscription_updated',
  'billing.payment_failed',
  'billing.invoice_created',
  'security.access_denied',
  'member.joined',
  'member.removed',
] as const;

export default function WebhooksPage() {
  const token = getAccessToken() ?? '';
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [url, setUrl] = React.useState('');
  const [events, setEvents] = React.useState<string[]>(['instance.created']);
  const [lastSecret, setLastSecret] = React.useState<string | null>(null);

  const webhooksQ = useQuery({
    queryKey: ['webhooks', workspaceId],
    queryFn: () => webhooksApi.list(token, workspaceId!),
    enabled: !!workspaceId && !!token,
  });

  const createWebhook = useMutation({
    mutationFn: () =>
      webhooksApi.create(token, workspaceId!, {
        url,
        events,
        enabled: true,
      }),
    onSuccess: (result) => {
      setLastSecret(result.secret ?? null);
      setUrl('');
      setEvents(['instance.created']);
      queryClient.invalidateQueries({ queryKey: ['webhooks', workspaceId] });
    },
  });

  const deleteWebhook = useMutation({
    mutationFn: (id: string) => webhooksApi.delete(token, workspaceId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks', workspaceId] }),
  });

  const rotateSecret = useMutation({
    mutationFn: (id: string) => webhooksApi.rotateSecret(token, workspaceId!, id),
    onSuccess: (result) => {
      setLastSecret(result.secret);
    },
  });

  const toggleEvent = (eventName: string) => {
    setEvents((prev) =>
      prev.includes(eventName) ? prev.filter((eventItem) => eventItem !== eventName) : [...prev, eventName],
    );
  };

  const webhooks = webhooksQ.data ?? [];

  return (
    <DashboardLayout>
      <Topbar title="Webhooks" />
      <PageWrapper>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create Webhook</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                placeholder="https://example.com/webhooks/claw"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {EVENT_OPTIONS.map((eventName) => (
                  <label key={eventName} className="text-sm text-ink flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={events.includes(eventName)}
                      onChange={() => toggleEvent(eventName)}
                    />
                    <span>{eventName}</span>
                  </label>
                ))}
              </div>
              <Button disabled={!url || events.length === 0 || createWebhook.isPending} onClick={() => createWebhook.mutate()}>
                Create Webhook
              </Button>
              {lastSecret && (
                <div className="text-xs text-ink-2 break-all">Webhook secret: {lastSecret}</div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configured Webhooks</CardTitle>
            </CardHeader>
            <CardBody>
              {webhooks.length === 0 ? (
                <p className="text-sm text-ink-3">No webhooks configured.</p>
              ) : (
                <div className="space-y-3">
                  {webhooks.map((webhook) => (
                    <div key={webhook.id} className="border border-border rounded-md p-3 flex items-center justify-between gap-3">
                      <div className="text-sm">
                        <div className="text-ink font-medium">{webhook.url}</div>
                        <div className="text-ink-3">{webhook.events.join(', ')}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => rotateSecret.mutate(webhook.id)}>
                          Rotate Secret
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteWebhook.mutate(webhook.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </PageWrapper>
    </DashboardLayout>
  );
}
