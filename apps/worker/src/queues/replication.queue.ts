// Replication queue — coordinates cross-region data synchronization between instances
import { Job } from 'bullmq';

export interface ReplicationJobData {
  linkId: string;
  sourceInstanceId: string;
  targetInstanceId: string;
  targetRegion: string;
}

export async function processJob(job: Job<ReplicationJobData>): Promise<void> {
  const { linkId, sourceInstanceId, targetInstanceId } = job.data;
  console.log(`Syncing replication link ${linkId}: ${sourceInstanceId} → ${targetInstanceId}`);
  // TODO: call claw-sync-server to trigger incremental sync
}
