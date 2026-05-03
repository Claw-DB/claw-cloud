import { Injectable, NotFoundException } from '@nestjs/common';
import crypto from 'node:crypto';
import { Prisma, AuditLog } from '@prisma/client';
import { AuditQueryDtoType, VerifyResult } from '@claw/common';
import { PrismaService } from '../../prisma/prisma.service.js';

interface CreateAuditLogDto {
  workspaceId: string;
  actorId?: string | null;
  actorType?: 'USER' | 'API_KEY' | 'SYSTEM';
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: CreateAuditLogDto): Promise<AuditLog> {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: entry.workspaceId } });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const payload = JSON.stringify({
      actorId: entry.actorId,
      actorType: entry.actorType ?? 'USER',
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      metadata: entry.metadata ?? {},
      ipAddress: entry.ipAddress,
    });
    const signature = crypto.createHmac('sha256', workspace.auditSecret ?? '').update(payload).digest('hex');

    return this.prisma.auditLog.create({
      data: {
        workspaceId: entry.workspaceId,
        actorId: entry.actorId,
        actorType: entry.actorType ?? 'USER',
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        metadata: (entry.metadata ?? {}) as Prisma.InputJsonValue,
        ipAddress: entry.ipAddress,
        signature,
      },
    });
  }

  async query(workspaceId: string, filters: AuditQueryDtoType) {
    const where: Prisma.AuditLogWhereInput = {
      workspaceId,
      actorId: filters.actorId,
      actorType: filters.actorType,
      action: filters.action,
      resourceType: filters.resourceType,
      resourceId: filters.resourceId,
      createdAt: {
        gte: filters.since,
        lte: filters.until,
      },
    };

    if (filters.cursor) {
      const [createdAt, id] = Buffer.from(filters.cursor, 'base64url').toString('utf8').split('|');
      where.OR = [
        { createdAt: { lt: new Date(createdAt) } },
        { createdAt: new Date(createdAt), id: { lt: id } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: filters.limit,
      }),
      this.prisma.auditLog.count({ where: { workspaceId } }),
    ]);
    const last = data.at(-1);
    const cursor = last
      ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`, 'utf8').toString('base64url')
      : '';
    return { data, total, cursor };
  }

  async export(workspaceId: string, filters: AuditQueryDtoType, format: 'json' | 'csv') {
    const { data } = await this.query(workspaceId, { ...filters, limit: 500 });
    if (format === 'csv') {
      const lines = [
        'id,createdAt,actorId,actorType,action,resourceType,resourceId,signature',
        ...data.map((row) =>
          [
            row.id,
            row.createdAt.toISOString(),
            row.actorId ?? '',
            row.actorType,
            row.action,
            row.resourceType,
            row.resourceId ?? '',
            row.signature ?? '',
          ].join(','),
        ),
      ];
      return Buffer.from(lines.join('\n'));
    }

    return Buffer.from(JSON.stringify(data));
  }

  async verifyIntegrity(workspaceId: string, fromId?: string, toId?: string): Promise<VerifyResult> {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const rows = await this.prisma.auditLog.findMany({
      where: {
        workspaceId,
        ...(fromId || toId
          ? {
              id: {
                gte: fromId,
                lte: toId,
              },
            }
          : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    for (const row of rows) {
      const payload = JSON.stringify({
        actorId: row.actorId,
        actorType: row.actorType,
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        metadata: row.metadata,
        ipAddress: row.ipAddress,
      });
      const signature = crypto.createHmac('sha256', workspace.auditSecret ?? '').update(payload).digest('hex');
      if (row.signature !== signature) {
        return { ok: false, totalChecked: rows.length, firstInvalidId: row.id };
      }
    }

    return { ok: true, totalChecked: rows.length, firstInvalidId: null };
  }
}