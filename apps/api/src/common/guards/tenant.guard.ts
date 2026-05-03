// TenantGuard — verifies the requesting user is a member of the target workspace
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service.js';
import { User } from '@prisma/client';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      params: Record<string, string>;
      user: User;
      workspace?: unknown;
      membership?: unknown;
    }>();
    const { workspaceId, slug } = request.params;
    const user = request.user;

    const workspace = await this.prisma.workspace.findFirst({
      where: workspaceId ? { id: workspaceId } : { slug },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    });
    if (!membership) throw new ForbiddenException('You are not a member of this workspace');

    request.workspace = workspace;
    request.membership = membership;
    return true;
  }
}
