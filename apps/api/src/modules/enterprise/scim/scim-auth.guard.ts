import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ScimService } from './scim.service.js';

@Injectable()
export class ScimAuthGuard implements CanActivate {
  constructor(private readonly scimService: ScimService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; scim?: unknown }>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('SCIM token required');
    }

    const token = authorization.slice('Bearer '.length).trim();
    const validated = await this.scimService.validateToken(token);
    if (!validated) {
      throw new UnauthorizedException('Invalid SCIM token');
    }

    request.scim = validated;
    return true;
  }
}