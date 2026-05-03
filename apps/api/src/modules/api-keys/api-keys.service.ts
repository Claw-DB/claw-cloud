import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApiKey, Workspace } from '@prisma/client';
import crypto from 'node:crypto';
import {
  API_KEY_LAST_USED_DEBOUNCE_MS,
  API_KEY_PREFIX_LENGTH,
  API_KEY_ROTATION_GRACE_PERIOD_SECONDS,
  CreateApiKeyDtoType,
} from '@claw/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getRedis } from '../../common/infra/redis.js';

@Injectable()
export class ApiKeysService {
  private readonly redis = getRedis();

  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, createdById: string, dto: CreateApiKeyDtoType) {
    const rawKey = `ck_live_${crypto.randomBytes(24).toString('base64url')}`;
    const keyHash = this.hashKey(rawKey);
    const expiresAt = this.resolveExpiry(dto.expiresIn);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        workspaceId,
        createdById,
        name: dto.name,
        keyHash,
        keyPrefix: rawKey.slice(0, API_KEY_PREFIX_LENGTH),
        scopes: dto.scopes,
        expiresAt,
      },
      select: {
        id: true,
        workspaceId: true,
        createdById: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        revokedAt: true,
      },
    });

    return { apiKey, rawKey };
  }

  async list(workspaceId: string) {
    return this.prisma.apiKey.findMany({
      where: { workspaceId },
      select: {
        id: true,
        workspaceId: true,
        createdById: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(id: string, workspaceId: string): Promise<void> {
    const apiKey = await this.prisma.apiKey.findFirst({ where: { id, workspaceId } });
    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    await this.redis.del(`cloud:gateway:key:${apiKey.keyHash}`);
  }

  async rotate(id: string, workspaceId: string) {
    const apiKey = await this.prisma.apiKey.findFirst({ where: { id, workspaceId } });
    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    const created = await this.create(workspaceId, apiKey.createdById, {
      name: apiKey.name,
      scopes: apiKey.scopes as CreateApiKeyDtoType['scopes'],
      expiresIn: 'never',
    });

    await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    await this.redis.set(
      `cloud:apikey:grace:${apiKey.keyHash}`,
      created.apiKey.id,
      'EX',
      API_KEY_ROTATION_GRACE_PERIOD_SECONDS,
    );
    await this.redis.del(`cloud:gateway:key:${apiKey.keyHash}`);

    return created;
  }

  async validate(rawKey: string): Promise<{ apiKey: ApiKey; workspace: Workspace } | null> {
    const keyHash = this.hashKey(rawKey);
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: { workspace: true },
    });

    if (!apiKey) {
      return null;
    }

    const inGrace = Boolean(await this.redis.exists(`cloud:apikey:grace:${keyHash}`));
    const revoked = apiKey.revokedAt && !inGrace;
    const expired = apiKey.expiresAt && apiKey.expiresAt <= new Date();
    if (revoked || expired) {
      return null;
    }

    const shouldUpdateLastUsed =
      !apiKey.lastUsedAt || Date.now() - apiKey.lastUsedAt.getTime() > API_KEY_LAST_USED_DEBOUNCE_MS;
    if (shouldUpdateLastUsed) {
      void this.prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      });
    }

    return { apiKey, workspace: apiKey.workspace };
  }

  private hashKey(rawKey: string) {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  private resolveExpiry(expiresIn: CreateApiKeyDtoType['expiresIn']) {
    if (expiresIn === 'never') {
      return null;
    }

    const days = Number(expiresIn.replace('d', ''));
    if (Number.isNaN(days)) {
      throw new ConflictException('Unsupported API key expiration');
    }

    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}