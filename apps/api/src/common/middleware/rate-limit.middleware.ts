import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { PLAN_LIMITS } from '@claw/common';
import { PrismaService } from '../../modules/prisma/prisma.service.js';
import { getRedis } from '../infra/redis.js';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly windowMs = 60_000;
  private readonly redis = getRedis();

  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = await this.resolveWorkspaceId(req);
      if (!workspaceId) {
        next();
        return;
      }

      const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
      if (!workspace) {
        next();
        return;
      }

      const limit = PLAN_LIMITS[workspace.plan].rpmLimit;
      const key = `cloud:ratelimit:${workspaceId}`;
      const now = Date.now();
      const pipeline = this.redis.multi();
      pipeline.zremrangebyscore(key, 0, now - this.windowMs);
      pipeline.zadd(key, `${now}`, `${now}-${crypto.randomUUID()}`);
      pipeline.zcard(key);
      pipeline.pexpire(key, this.windowMs);
      const results = await pipeline.exec();
      const count = Number(results?.[2]?.[1] ?? 0);

      if (count > limit) {
        res.setHeader('Retry-After', '60');
        throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
      }

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Rate limit middleware failed: ${String(error)}`);
      next();
    }
  }

  private async resolveWorkspaceId(req: Request): Promise<string | null> {
    const routeWorkspaceId = (req.params?.id ?? req.params?.workspaceId) as string | undefined;
    if (routeWorkspaceId) {
      return routeWorkspaceId;
    }

    if (!req.path.startsWith('/gateway')) {
      return null;
    }

    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }

    const rawKey = authorization.slice('Bearer '.length).trim();
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      select: { workspaceId: true },
    });

    return apiKey?.workspaceId ?? null;
  }
}
