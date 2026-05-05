import { Injectable } from '@nestjs/common';
import {
  UsageBill,
  UsageLineItem,
  UsageMetrics,
  USAGE_INCLUDED_ALLOWANCES,
  USAGE_RATES_USD,
} from '@claw/common';
import { WorkspacePlan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { getRedis } from '../../common/infra/redis.js';

@Injectable()
export class UsageService {
  private readonly redis = getRedis();

  constructor(private readonly prisma: PrismaService) {}

  async increment(
    instanceId: string,
    workspaceId: string,
    metric: keyof UsageMetrics,
    value = 1,
  ): Promise<void> {
    const period = new Date().toISOString().slice(0, 7);
    const key = `cloud:usage:${workspaceId}:${instanceId}:${period}`;
    void this.redis.hincrbyfloat(key, metric, value);
  }

  async flushToDatabase(): Promise<void> {
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', 'cloud:usage:*', 'COUNT', '100');
      cursor = nextCursor;

      for (const key of keys) {
        const values = await this.redis.hgetall(key);
        const [, , workspaceId, instanceId, period] = key.split(':');
        const periodDate = new Date(`${period}-01T00:00:00.000Z`);

        const parsed = this.toMetrics(values);
        await this.prisma.usageRecord.upsert({
          where: {
            workspaceId_instanceId_period: {
              workspaceId,
              instanceId,
              period: periodDate,
            },
          },
          create: {
            workspaceId,
            instanceId,
            period: periodDate,
            ...parsed,
          },
          update: {
            memoryOpsCount: { increment: BigInt(parsed.memoryOpsCount) },
            storageGbHours: { increment: parsed.storageGbHours },
            vectorOpsCount: { increment: BigInt(parsed.vectorOpsCount) },
            syncOpsCount: { increment: BigInt(parsed.syncOpsCount) },
            bandwidthGb: { increment: parsed.bandwidthGb },
            reflectJobsCount: { increment: parsed.reflectJobsCount },
            computeMinutes: { increment: parsed.computeMinutes },
          },
        });

        await this.redis.del(key);
      }
    } while (cursor !== '0');
  }

  async getUsageForPeriod(workspaceId: string, period: Date) {
    return this.prisma.usageRecord.findMany({
      where: {
        workspaceId,
        period: new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth(), 1)),
      },
      orderBy: { instanceId: 'asc' },
    });
  }

  async calculateBill(workspaceId: string, period: Date): Promise<UsageBill> {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    const usageRecords = await this.getUsageForPeriod(workspaceId, period);
    const totals = usageRecords.reduce<UsageMetrics>(
      (acc, record) => ({
        memoryOpsCount: acc.memoryOpsCount + Number(record.memoryOpsCount),
        storageGbHours: acc.storageGbHours + record.storageGbHours,
        vectorOpsCount: acc.vectorOpsCount + Number(record.vectorOpsCount),
        syncOpsCount: acc.syncOpsCount + Number(record.syncOpsCount),
        bandwidthGb: acc.bandwidthGb + record.bandwidthGb,
        reflectJobsCount: acc.reflectJobsCount + record.reflectJobsCount,
        computeMinutes: acc.computeMinutes + record.computeMinutes,
      }),
      {
        memoryOpsCount: 0,
        storageGbHours: 0,
        vectorOpsCount: 0,
        syncOpsCount: 0,
        bandwidthGb: 0,
        reflectJobsCount: 0,
        computeMinutes: 0,
      },
    );

    const included = USAGE_INCLUDED_ALLOWANCES[workspace.plan as WorkspacePlan];
    const lineItems = (Object.keys(totals) as (keyof UsageMetrics)[]).map<UsageLineItem>((metric) => {
      const quantity = totals[metric];
      const includedQuantity = included[metric];
      const billableQuantity = Math.max(0, quantity - includedQuantity);
      const unitPriceUsd = USAGE_RATES_USD[metric];
      return {
        metric,
        quantity,
        included: includedQuantity,
        billableQuantity,
        unitPriceUsd,
        amountUsd: Number((billableQuantity * unitPriceUsd).toFixed(6)),
      };
    });

    return {
      workspaceId,
      period,
      currency: 'usd',
      lineItems,
      totalUsd: Number(lineItems.reduce((sum, item) => sum + item.amountUsd, 0).toFixed(6)),
    };
  }

  private toMetrics(values: Record<string, string>): UsageMetrics {
    return {
      memoryOpsCount: Number(values.memoryOpsCount ?? 0),
      storageGbHours: Number(values.storageGbHours ?? 0),
      vectorOpsCount: Number(values.vectorOpsCount ?? 0),
      syncOpsCount: Number(values.syncOpsCount ?? 0),
      bandwidthGb: Number(values.bandwidthGb ?? 0),
      reflectJobsCount: Number(values.reflectJobsCount ?? 0),
      computeMinutes: Number(values.computeMinutes ?? 0),
    };
  }
}