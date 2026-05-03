// Provision queue — processes Kubernetes pod provisioning jobs for new ClawDB instances
import { Job } from 'bullmq';

export interface ProvisionJobData {
  instanceId: string;
  workspaceId: string;
  region: string;
  tier: string;
  version: string;
}

export async function processJob(job: Job<ProvisionJobData>): Promise<void> {
  const { instanceId, region, tier, version } = job.data;
  console.log(`Provisioning instance ${instanceId} in ${region} (${tier} / ${version})`);
  // TODO: call Kubernetes API to create pod
  await job.updateProgress(100);
}
