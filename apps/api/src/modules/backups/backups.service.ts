import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Backup, BackupType } from '@prisma/client';
import { BACKUP_RETENTION_DAYS, BackupRestoreDtoType, JOB_NAMES, QUEUE_NAMES } from '@claw/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getQueue } from '../../common/infra/queue.js';

@Injectable()
export class BackupsService {
  private readonly backupQueue = getQueue(QUEUE_NAMES.BACKUP);
  private readonly s3 = new S3Client({
    region: process.env.AWS_REGION ?? 'us-east-1',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
  });

  constructor(private readonly prisma: PrismaService) {}

  async createBackup(instanceId: string, workspaceId: string, type: BackupType): Promise<Backup> {
    const instance = await this.prisma.instance.findFirst({ where: { id: instanceId, workspaceId } });
    if (!instance) {
      throw new NotFoundException('Instance not found');
    }

    const backup = await this.prisma.backup.create({
      data: {
        instanceId,
        workspaceId,
        type,
        status: 'PENDING',
        expiresAt: new Date(
          Date.now() + BACKUP_RETENTION_DAYS[instance.tier] * 24 * 60 * 60 * 1000,
        ),
      },
    });

    await this.backupQueue.add(JOB_NAMES.CREATE_BACKUP, {
      workspaceId,
      instanceId,
      backupId: backup.id,
      type,
    });

    return backup;
  }

  async listBackups(instanceId: string, workspaceId: string) {
    return this.prisma.backup.findMany({
      where: { instanceId, workspaceId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getBackup(id: string, workspaceId: string) {
    const backup = await this.prisma.backup.findFirst({ where: { id, workspaceId } });
    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    return backup;
  }

  async deleteBackup(id: string, workspaceId: string): Promise<void> {
    const backup = await this.getBackup(id, workspaceId);
    if (backup.storageKey && process.env.S3_BACKUPS_BUCKET) {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.S3_BACKUPS_BUCKET,
          Key: backup.storageKey,
        }),
      );
    }

    await this.prisma.backup.update({
      where: { id },
      data: { status: 'EXPIRED' },
    });
  }

  async restoreFromBackup(backupId: string, targetInstanceId: string, workspaceId: string): Promise<void> {
    const backup = await this.getBackup(backupId, workspaceId);
    if (backup.status !== 'COMPLETED') {
      throw new NotFoundException('Backup is not restorable');
    }

    const instance = await this.prisma.instance.findFirst({ where: { id: targetInstanceId, workspaceId } });
    if (!instance) {
      throw new NotFoundException('Target instance not found');
    }

    await this.backupQueue.add(JOB_NAMES.RESTORE_BACKUP, {
      workspaceId,
      instanceId: targetInstanceId,
      backupId,
      sourceInstanceId: backup.instanceId,
    });
  }
}