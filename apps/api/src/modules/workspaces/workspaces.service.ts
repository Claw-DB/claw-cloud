import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Invitation, MemberRole, Prisma, Workspace, WorkspaceMember } from '@prisma/client';
import crypto from 'node:crypto';
import {
  CreateWorkspaceDtoType,
  InviteMemberDtoType,
  INVITATION_EXPIRY_DAYS,
  JOB_NAMES,
  PLAN_LIMITS,
  QUEUE_NAMES,
  UpdateWorkspaceDtoType,
  WORKSPACE_TRIAL_DAYS,
} from '@claw/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getQueue } from '../../common/infra/queue.js';

@Injectable()
export class WorkspacesService {
  private readonly emailQueue = getQueue(QUEUE_NAMES.EMAIL);
  private readonly cleanupQueue = getQueue(QUEUE_NAMES.CLEANUP);

  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateWorkspaceDtoType): Promise<Workspace> {
    const existing = await this.prisma.workspace.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException('Workspace slug is already in use');
    }

    const workspace = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workspace.create({
        data: {
          ownerId,
          name: dto.name,
          slug: dto.slug,
          plan: 'FREE',
          trialEndsAt: new Date(Date.now() + WORKSPACE_TRIAL_DAYS * 24 * 60 * 60 * 1000),
          auditSecret: crypto.randomBytes(32).toString('hex'),
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: created.id,
          userId: ownerId,
          role: 'OWNER',
        },
      });

      return created;
    });

    await this.emailQueue.add(JOB_NAMES.WELCOME_EMAIL, {
      workspaceId: workspace.id,
      ownerId,
    });

    return workspace;
  }

  async listForUser(userId: string): Promise<Workspace[]> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId, active: true },
      include: { workspace: true },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((membership) => membership.workspace);
  }

  async findById(id: string): Promise<Workspace> {
    const workspace = await this.prisma.workspace.findUnique({ where: { id } });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }

  async findBySlug(slug: string): Promise<Workspace> {
    const workspace = await this.prisma.workspace.findUnique({ where: { slug } });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }

  async update(id: string, dto: UpdateWorkspaceDtoType): Promise<Workspace> {
    await this.findById(id);

    if (dto.slug) {
      const existing = await this.prisma.workspace.findFirst({
        where: {
          slug: dto.slug,
          NOT: { id },
        },
      });
      if (existing) {
        throw new ConflictException('Workspace slug is already in use');
      }
    }

    return this.prisma.workspace.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);

    await this.prisma.workspace.update({
      where: { id },
      data: { status: 'DELETED' },
    });

    await this.cleanupQueue.add(JOB_NAMES.WORKSPACE_CLEANUP, { workspaceId: id });
  }

  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    await this.findById(workspaceId);
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async addMember(
    workspaceId: string,
    userId: string,
    role: MemberRole,
    invitedBy?: string,
  ): Promise<WorkspaceMember> {
    const workspace = await this.findById(workspaceId);
    await this.assertMemberCapacity(workspaceId, workspace.plan);

    const existing = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (existing) {
      throw new ConflictException('User is already a workspace member');
    }

    return this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        role,
        invitedBy,
      },
    });
  }

  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: MemberRole,
  ): Promise<WorkspaceMember> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      throw new NotFoundException('Workspace member not found');
    }

    if (membership.role === 'OWNER' && role !== 'OWNER') {
      await this.assertOwnerCount(workspaceId, userId);
    }

    return this.prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId } },
      data: { role },
    });
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      throw new NotFoundException('Workspace member not found');
    }

    if (membership.role === 'OWNER') {
      await this.assertOwnerCount(workspaceId, userId);
    }

    await this.prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  }

  async inviteMember(
    workspaceId: string,
    email: string,
    role: MemberRole,
    invitedById: string,
  ): Promise<Invitation> {
    const workspace = await this.findById(workspaceId);
    await this.assertMemberCapacity(workspaceId, workspace.plan);

    const token = crypto.randomBytes(32).toString('base64url');
    const invitation = await this.prisma.invitation.create({
      data: {
        workspaceId,
        email,
        role,
        token,
        invitedById,
        expiresAt: new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    await this.emailQueue.add(JOB_NAMES.INVITATION_EMAIL, {
      workspaceId,
      invitationId: invitation.id,
      invitedById,
    });

    return invitation;
  }

  async acceptInvitation(token: string): Promise<WorkspaceMember> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { workspace: true },
    });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) {
      throw new NotFoundException('Invitation not found or expired');
    }

    await this.assertMemberCapacity(invitation.workspaceId, invitation.workspace.plan);

    return this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email: invitation.email } });
      if (!user) {
        user = await tx.user.create({
          data: {
            email: invitation.email,
            name: invitation.email.split('@')[0],
            emailVerified: new Date(),
          },
        });
      }

      const existing = await tx.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
      });
      if (existing) {
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        });
        return existing;
      }

      const membership = await tx.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId: user.id,
          role: invitation.role,
          invitedBy: invitation.invitedById,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      return membership;
    });
  }

  async getInvitationInfo(token: string): Promise<Invitation> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { workspace: true },
    });
    if (!invitation || invitation.expiresAt <= new Date()) {
      throw new NotFoundException('Invitation not found or expired');
    }

    return invitation;
  }

  async revokeInvitation(invitationId: string): Promise<void> {
    await this.prisma.invitation.delete({ where: { id: invitationId } });
  }

  private async assertOwnerCount(workspaceId: string, userId: string): Promise<void> {
    const ownerCount = await this.prisma.workspaceMember.count({
      where: {
        workspaceId,
        role: 'OWNER',
      },
    });

    if (ownerCount <= 1) {
      throw new ConflictException(`Cannot remove or demote the last OWNER (${userId})`);
    }
  }

  private async assertMemberCapacity(workspaceId: string, plan: Workspace['plan']): Promise<void> {
    const currentMembers = await this.prisma.workspaceMember.count({ where: { workspaceId } });
    const { maxMembers } = PLAN_LIMITS[plan];

    if (currentMembers >= maxMembers) {
      throw new ConflictException('Workspace member limit reached for current plan');
    }
  }
}