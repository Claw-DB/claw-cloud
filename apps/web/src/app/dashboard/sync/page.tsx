'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout, Topbar, PageWrapper } from '@/components/layout';
import { Button, Card, CardBody, CardHeader, CardTitle, Select } from '@/components/ui';
import { getAccessToken } from '@/lib/auth';
import { useWorkspace } from '@/app/providers';
import { instanceApi, replicationApi } from '@/lib/api-client';

export default function SyncPage() {
  const token = getAccessToken() ?? '';
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [sourceInstanceId, setSourceInstanceId] = React.useState('');
  const [targetInstanceId, setTargetInstanceId] = React.useState('');

  const instancesQ = useQuery({
    queryKey: ['instances', workspaceId],
    queryFn: () => instanceApi.list(token, workspaceId!),
    enabled: !!workspaceId && !!token,
  });

  const linksQ = useQuery({
    queryKey: ['replication-links', workspaceId],
    queryFn: () => replicationApi.list(token, workspaceId!),
    enabled: !!workspaceId && !!token,
  });

  const createLink = useMutation({
    mutationFn: () =>
      replicationApi.create(token, workspaceId!, {
        sourceInstanceId,
        targetInstanceId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['replication-links', workspaceId] });
      setSourceInstanceId('');
      setTargetInstanceId('');
    },
  });

  const toggleLink = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      status === 'ACTIVE'
        ? replicationApi.pause(token, workspaceId!, id)
        : replicationApi.resume(token, workspaceId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['replication-links', workspaceId] }),
  });

  const deleteLink = useMutation({
    mutationFn: (id: string) => replicationApi.delete(token, workspaceId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['replication-links', workspaceId] }),
  });

  const instances = instancesQ.data ?? [];
  const links = linksQ.data ?? [];

  return (
    <DashboardLayout>
      <Topbar title="Sync Hub" />
      <PageWrapper>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create Replication Link</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select value={sourceInstanceId} onChange={(e) => setSourceInstanceId(e.target.value)}>
                  <option value="">Select source instance</option>
                  {instances.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </Select>
                <Select value={targetInstanceId} onChange={(e) => setTargetInstanceId(e.target.value)}>
                  <option value="">Select target instance</option>
                  {instances.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </Select>
              </div>
              <Button
                disabled={!sourceInstanceId || !targetInstanceId || createLink.isPending}
                onClick={() => createLink.mutate()}
              >
                Create Link
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Replication Links</CardTitle>
            </CardHeader>
            <CardBody>
              {links.length === 0 ? (
                <p className="text-sm text-ink-3">No replication links yet.</p>
              ) : (
                <div className="space-y-3">
                  {links.map((link) => (
                    <div key={link.id} className="border border-border rounded-md p-3 flex items-center justify-between gap-3">
                      <div className="text-sm">
                        <div className="text-ink font-medium">{link.sourceInstanceId} → {link.targetInstanceId}</div>
                        <div className="text-ink-3">Status: {link.status} · Lag: {link.lagMs ?? 0}ms</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleLink.mutate({ id: link.id, status: link.status })}
                          disabled={toggleLink.isPending}
                        >
                          {link.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteLink.mutate(link.id)}
                          disabled={deleteLink.isPending}
                        >
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
