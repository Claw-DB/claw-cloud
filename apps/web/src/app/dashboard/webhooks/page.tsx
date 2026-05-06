'use client';

import * as React from 'react';
import { toast } from 'sonner';
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
  const [formError, setFormError] = React.useState('');

  const webhooksQ = useQuery({
    queryKey: ['webhooks', workspaceId],
    queryFn: () => webhooksApi.list(token, workspaceId!),
    enabled: !!workspaceId && !!token,
    retry: false,
  });

  const createWebhook = useMutation({
    mutationFn: (payload: { url: string; events: string[] }) =>
      webhooksApi.create(token, workspaceId!, {
        url: payload.url,
        events: payload.events,
        enabled: true,
      }),
    onSuccess: (result) => {
      setLastSecret(result.secret ?? null);
      setUrl('');
      setEvents(['instance.created']);
      setFormError('');
      queryClient.invalidateQueries({ queryKey: ['webhooks', workspaceId] });
      toast.success('Webhook created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create webhook');
    },
  });

  const deleteWebhook = useMutation({
    mutationFn: (id: string) => webhooksApi.delete(token, workspaceId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', workspaceId] });
      toast.success('Webhook deleted');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete webhook'),
  });

  const rotateSecret = useMutation({
    mutationFn: (id: string) => webhooksApi.rotateSecret(token, workspaceId!, id),
    onSuccess: (result) => {
      setLastSecret(result.secret);
      toast.success('Webhook secret rotated');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to rotate secret'),
  });

  const toggleEvent = (eventName: string) => {
    setEvents((prev) =>
      prev.includes(eventName) ? prev.filter((eventItem) => eventItem !== eventName) : [...prev, eventName],
    );
  };

  const validateWebhookUrl = (value: string) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return 'Webhook URL must be a valid URL';
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return 'Webhook URL must use http:// or https://';
    }

    if ((window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') && parsed.protocol !== 'https:') {
      return 'Use HTTPS for webhook URLs in production';
    }

    return '';
  };

  const handleCreateWebhook = () => {
    const normalizedUrl = url.trim();
    const eventSet = Array.from(new Set(events));

    const validationError = validateWebhookUrl(normalizedUrl);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    if (eventSet.length === 0) {
      setFormError('Select at least one event');
      return;
    }

    setFormError('');
    createWebhook.mutate({ url: normalizedUrl, events: eventSet });
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
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (formError) setFormError('');
                }}
              />
              {formError && (
                <div className="text-xs text-danger">{formError}</div>
              )}
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
              <Button disabled={!url.trim() || events.length === 0 || createWebhook.isPending} onClick={handleCreateWebhook}>
                {createWebhook.isPending ? 'Creating...' : 'Create Webhook'}
              </Button>
              {lastSecret && (
                <div className="text-xs text-ink-2 break-all">Webhook signing secret (copy now): {lastSecret}</div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configured Webhooks</CardTitle>
            </CardHeader>
            <CardBody>
              {webhooksQ.isLoading ? (
                <p className="text-sm text-ink-3">Loading webhooks...</p>
              ) : webhooksQ.isError ? (
                <p className="text-sm text-danger">Failed to load webhooks. Check API connectivity and token validity.</p>
              ) : webhooks.length === 0 ? (
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
                        <Button variant="outline" size="sm" disabled={rotateSecret.isPending} onClick={() => rotateSecret.mutate(webhook.id)}>
                          {rotateSecret.isPending ? 'Rotating...' : 'Rotate Secret'}
                        </Button>
                        <Button variant="ghost" size="sm" disabled={deleteWebhook.isPending} onClick={() => deleteWebhook.mutate(webhook.id)}>
                          {deleteWebhook.isPending ? 'Deleting...' : 'Delete'}
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
