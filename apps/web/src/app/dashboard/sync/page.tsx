'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
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
    retry: false,
  });

  const linksQ = useQuery({
    queryKey: ['replication-links', workspaceId],
    queryFn: () => replicationApi.list(token, workspaceId!),
    enabled: !!workspaceId && !!token,
    retry: false,
    refetchInterval: 15_000,
  });

  const createLink = useMutation({
    mutationFn: (payload: { sourceInstanceId: string; targetInstanceId: string }) =>
      replicationApi.create(token, workspaceId!, {
        sourceInstanceId: payload.sourceInstanceId,
        targetInstanceId: payload.targetInstanceId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['replication-links', workspaceId] });
      setSourceInstanceId('');
      setTargetInstanceId('');
      toast.success('Replication link created');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to create replication link'),
  });

  const toggleLink = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      status === 'ACTIVE'
        ? replicationApi.pause(token, workspaceId!, id)
        : replicationApi.resume(token, workspaceId!, id),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['replication-links', workspaceId] });
      toast.success(vars.status === 'ACTIVE' ? 'Replication paused' : 'Replication resumed');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update replication state'),
  });

  const deleteLink = useMutation({
    mutationFn: (id: string) => replicationApi.delete(token, workspaceId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['replication-links', workspaceId] });
      toast.success('Replication link deleted');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete replication link'),
  });

  const instances = React.useMemo(
    () => (instancesQ.data ?? []).filter((instance) => instance.status === 'RUNNING'),
    [instancesQ.data],
  );
  const links = linksQ.data ?? [];
  const selectedSameInstance = sourceInstanceId && targetInstanceId && sourceInstanceId === targetInstanceId;

  const handleCreateLink = () => {
    if (!sourceInstanceId || !targetInstanceId) {
      toast.error('Select both source and target instances');
      return;
    }
    if (sourceInstanceId === targetInstanceId) {
      toast.error('Source and target instances must be different');
      return;
    }
    createLink.mutate({ sourceInstanceId, targetInstanceId });
  };

  const formatDate = (value: string | null) => {
    if (!value) return 'Never';
    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <DashboardLayout>
      <Topbar
        title="Sync Hub"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void linksQ.refetch();
              void instancesQ.refetch();
            }}
            disabled={linksQ.isFetching || instancesQ.isFetching}
          >
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
        }
      />
      <PageWrapper>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create Replication Link</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {instancesQ.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-ink-3">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading instances...
                </div>
              ) : instancesQ.isError ? (
                <div className="flex items-center gap-2 text-sm text-danger">
                  <AlertCircle className="w-4 h-4" /> Failed to load instances.
                </div>
              ) : instances.length < 2 ? (
                <p className="text-sm text-ink-3">You need at least two running instances to create a replication link.</p>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select value={sourceInstanceId} onChange={(e) => setSourceInstanceId(e.target.value)}>
                  <option value="">Select source instance</option>
                  {instances.map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.region})</option>
                  ))}
                </Select>
                <Select value={targetInstanceId} onChange={(e) => setTargetInstanceId(e.target.value)}>
                  <option value="">Select target instance</option>
                  {instances.map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.region})</option>
                  ))}
                </Select>
              </div>
              {selectedSameInstance && (
                <p className="text-xs text-danger">Source and target must be different instances.</p>
              )}
              <Button
                disabled={!sourceInstanceId || !targetInstanceId || selectedSameInstance || createLink.isPending || instances.length < 2}
                onClick={handleCreateLink}
              >
                {createLink.isPending ? 'Creating...' : 'Create Link'}
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Replication Links</CardTitle>
            </CardHeader>
            <CardBody>
              {linksQ.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-ink-3">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading replication links...
                </div>
              ) : linksQ.isError ? (
                <div className="flex items-center gap-2 text-sm text-danger">
                  <AlertCircle className="w-4 h-4" /> Failed to load replication links.
                </div>
              ) : links.length === 0 ? (
                <p className="text-sm text-ink-3">No replication links yet.</p>
              ) : (
                <div className="space-y-3">
                  {links.map((link) => (
                    <div key={link.id} className="border border-border rounded-md p-3 flex items-center justify-between gap-3">
                      <div className="text-sm">
                        <div className="text-ink font-medium">
                          {(link.sourceInstance?.name ?? link.sourceInstanceId)} → {(link.targetInstance?.name ?? link.targetInstanceId)}
                        </div>
                        <div className="text-ink-3">
                          Status: {link.status} · Lag: {link.lagMs ?? 0}ms · Last sync: {formatDate(link.lastSyncAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleLink.mutate({ id: link.id, status: link.status })}
                          disabled={toggleLink.isPending}
                        >
                          {toggleLink.isPending ? 'Updating...' : link.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteLink.mutate(link.id)}
                          disabled={deleteLink.isPending}
                        >
                          {deleteLink.isPending ? 'Deleting...' : 'Delete'}
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
