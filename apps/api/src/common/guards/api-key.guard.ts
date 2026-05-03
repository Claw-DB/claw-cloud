// ApiKeyGuard — authenticates requests using the X-Api-Key header and checks scopes
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../modules/prisma/prisma.service.js';
import { SCOPES_KEY } from '../decorators/require-scope.decorator.js';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      workspace?: unknown;
      apiKey?: unknown;
    }>();
    const rawKey = request.headers['x-api-key'];
    if (!rawKey) throw new UnauthorizedException('API key required');

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: { workspace: true },
    });

    if (!apiKey || apiKey.revokedAt || (apiKey.expiresAt && apiKey.expiresAt < new Date())) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    const requiredScopes = this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredScopes?.length) {
      const hasScope = requiredScopes.every((s) => apiKey.scopes.includes(s));
      if (!hasScope) throw new ForbiddenException('Insufficient API key scopes');
    }

    request.workspace = apiKey.workspace;
    request.apiKey = apiKey;

    // Update lastUsedAt asynchronously
    void this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return true;
  }
}
