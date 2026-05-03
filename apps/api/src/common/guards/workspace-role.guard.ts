import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MemberRole, WorkspaceMember } from '@prisma/client';
import { WORKSPACE_ROLES_KEY } from '../decorators/require-role.decorator.js';

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<MemberRole[]>(WORKSPACE_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ membership?: WorkspaceMember }>();
    const membership = request.membership;

    if (!membership || !roles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient workspace role');
    }

    return true;
  }
}