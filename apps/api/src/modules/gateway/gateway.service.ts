import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKey, Instance, Workspace } from '@prisma/client';
import crypto from 'node:crypto';
import { UsageMetrics } from '@claw/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ApiKeysService } from '../api-keys/api-keys.service.js';
import { getRedis } from '../../common/infra/redis.js';

interface GatewayResolution {
  instance: Instance;
  workspace: Workspace;
  keyRecord: ApiKey;
}

@Injectable()
export class GatewayService {
  private readonly redis = getRedis();

  constructor(
    private readonly prisma: PrismaService,
    private readonly apiKeysService: ApiKeysService,
  ) {}

  async resolveInstance(apiKey: string): Promise<GatewayResolution> {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const cacheKey = `cloud:gateway:key:${keyHash}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as GatewayResolution;
    }

    const validated = await this.apiKeysService.validate(apiKey);
    if (!validated) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    if (validated.workspace.status !== 'ACTIVE') {
      throw new ServiceUnavailableException('Workspace is not active');
    }

    const instance = await this.prisma.instance.findFirst({
      where: { workspaceId: validated.workspace.id, status: 'RUNNING' },
      orderBy: { createdAt: 'asc' },
    });
    if (!instance) {
      throw new NotFoundException('No running instance available for workspace');
    }

    const resolution: GatewayResolution = {
      instance,
      workspace: validated.workspace,
      keyRecord: validated.apiKey,
    };

    await this.redis.set(cacheKey, JSON.stringify(resolution), 'EX', 30);
    return resolution;
  }

  async recordUsage(instanceId: string, workspaceId: string, metrics: Partial<UsageMetrics>): Promise<void> {
    const period = new Date().toISOString().slice(0, 7);
    const key = `cloud:usage:${workspaceId}:${instanceId}:${period}`;
    const pipeline = this.redis.multi();

    for (const [metric, value] of Object.entries(metrics)) {
      pipeline.hincrbyfloat(key, metric, Number(value ?? 0));
    }

    pipeline.expire(key, 60 * 60 * 24 * 40);
    await pipeline.exec();
  }
}