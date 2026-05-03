// Billing queue — aggregates usage data and triggers Stripe invoice generation
import { Job } from 'bullmq';

export interface BillingJobData {
  workspaceId: string;
  period: string; // ISO date string for billing period start
}

export async function processJob(job: Job<BillingJobData>): Promise<void> {
  const { workspaceId, period } = job.data;
  console.log(`Aggregating usage for workspace ${workspaceId}, period ${period}`);
  // TODO: query UsageRecord, compute totals, create Stripe usage record
}
