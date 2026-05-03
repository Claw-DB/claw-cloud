// Cleanup queue — removes expired trial workspaces, orphaned resources, and stale sessions
import { Job } from 'bullmq';
import { prisma } from '@claw/db';

export interface CleanupJobData {
  type: 'expired-trials' | 'orphan-resources' | 'stale-sessions';
}

export async function processJob(job: Job<CleanupJobData>): Promise<void> {
  const { type } = job.data;

  switch (type) {
    case 'stale-sessions': {
      const result = await prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      console.log(`Deleted ${result.count} expired sessions`);
      break;
    }
    case 'expired-trials': {
      const result = await prisma.workspace.updateMany({
        where: {
          plan: 'FREE',
          trialEndsAt: { lt: new Date() },
          status: 'ACTIVE',
        },
        data: { status: 'SUSPENDED' },
      });
      console.log(`Suspended ${result.count} expired trial workspaces`);
      break;
    }
    case 'orphan-resources':
      console.log('Orphan resource GC: not yet implemented');
      break;
  }
}
