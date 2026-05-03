// Backup queue — creates scheduled and manual backups of ClawDB instance data
import { Job } from 'bullmq';

export interface BackupJobData {
  instanceId: string;
  workspaceId: string;
  backupId: string;
  type: 'SCHEDULED' | 'MANUAL';
}

export async function processJob(job: Job<BackupJobData>): Promise<void> {
  const { instanceId, backupId, type } = job.data;
  console.log(`Creating ${type} backup ${backupId} for instance ${instanceId}`);
  // TODO: trigger clawdb-server backup RPC, upload to S3
}
