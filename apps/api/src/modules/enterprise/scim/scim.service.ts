import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import crypto from 'node:crypto';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ScimListResponse, ScimPatchOp, ScimUserDtoType } from '@claw/common';

const USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';

@Injectable()
export class ScimService {
  constructor(private readonly prisma: PrismaService) {}

  async generateToken(workspaceId: string) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hash(token);
    await this.prisma.scimToken.upsert({
      where: { workspaceId },
      create: { workspaceId, tokenHash },
      update: { tokenHash, revokedAt: null },
    });
    return { token };
  }

  async revokeToken(workspaceId: string): Promise<void> {
    await this.prisma.scimToken.updateMany({
      where: { workspaceId },
      data: { revokedAt: new Date() },
    });
  }

  async validateToken(token: string): Promise<{ workspaceId: string } | null> {
    const tokenHash = this.hash(token);
    const scimToken = await this.prisma.scimToken.findFirst({
      where: { tokenHash, revokedAt: null },
    });
    return scimToken ? { workspaceId: scimToken.workspaceId } : null;
  }

  async provisionUser(workspaceId: string, scimUser: ScimUserDtoType) {
    const email = this.extractEmail(scimUser);
    const existing = await this.prisma.scimIdentity.findFirst({
      where: { workspaceId, user: { email } },
    });
    if (existing && existing.scimId !== scimUser.id) {
      throw new ConflictException('Duplicate email');
    }

    return this.upsertProvisionedUser(workspaceId, scimUser.id ?? crypto.randomUUID(), scimUser);
  }

  async updateUser(workspaceId: string, scimId: string, scimUser: ScimUserDtoType) {
    return this.upsertProvisionedUser(workspaceId, scimId, scimUser);
  }

  async patchUser(workspaceId: string, scimId: string, ops: ScimPatchOp[]) {
    const identity = await this.prisma.scimIdentity.findFirst({
      where: { workspaceId, scimId },
      include: { user: true },
    });
    if (!identity) {
      throw new NotFoundException('SCIM user not found');
    }

    const disable = ops.some((op) => op.op === 'replace' && op.path === 'active' && op.value === false);
    if (disable) {
      await this.deprovisionUser(workspaceId, scimId);
    }

    return this.toScimResponse(identity.scimId, identity.user.email, identity.user.name, !disable);
  }

  async deprovisionUser(workspaceId: string, scimId: string): Promise<void> {
    const identity = await this.prisma.scimIdentity.findFirst({
      where: { workspaceId, scimId },
    });
    if (!identity) {
      throw new NotFoundException('SCIM user not found');
    }

    await this.prisma.$transaction([
      this.prisma.workspaceMember.deleteMany({ where: { workspaceId, userId: identity.userId } }),
      this.prisma.session.deleteMany({ where: { userId: identity.userId } }),
      this.prisma.scimIdentity.delete({ where: { id: identity.id } }),
    ]);
  }

  async listUsers(
    workspaceId: string,
    filter?: string,
    startIndex = 1,
    count = 100,
  ): Promise<ScimListResponse> {
    const where = filter?.includes('userName eq')
      ? { user: { email: filter.split('"')[1] } }
      : undefined;

    const [identities, totalResults] = await Promise.all([
      this.prisma.scimIdentity.findMany({
        where: { workspaceId, ...(where ?? {}) },
        include: { user: true },
        skip: Math.max(0, startIndex - 1),
        take: count,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.scimIdentity.count({ where: { workspaceId, ...(where ?? {}) } }),
    ]);

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults,
      startIndex,
      itemsPerPage: count,
      Resources: identities.map((identity) =>
        this.toScimResponse(identity.scimId, identity.user.email, identity.user.name, true),
      ),
    };
  }

  async getUser(workspaceId: string, scimId: string) {
    const identity = await this.prisma.scimIdentity.findFirst({
      where: { workspaceId, scimId },
      include: { user: true },
    });
    if (!identity) {
      throw new NotFoundException('SCIM user not found');
    }

    return this.toScimResponse(identity.scimId, identity.user.email, identity.user.name, true);
  }

  private async upsertProvisionedUser(workspaceId: string, scimId: string, scimUser: ScimUserDtoType) {
    const email = this.extractEmail(scimUser);
    const name =
      scimUser.name?.formatted ??
      ([scimUser.name?.givenName, scimUser.name?.familyName].filter(Boolean).join(' ') ||
        email.split('@')[0]);
    const role = this.roleFromGroups(scimUser.groups?.map((group) => group.value) ?? []);

    const user = await this.prisma.user.upsert({
      where: { email },
      create: { email, name, emailVerified: new Date() },
      update: { name },
    });

    await this.prisma.$transaction([
      this.prisma.scimIdentity.upsert({
        where: { workspaceId_scimId: { workspaceId, scimId } },
        create: { workspaceId, userId: user.id, scimId, externalId: scimUser.externalId },
        update: { userId: user.id, externalId: scimUser.externalId },
      }),
      this.prisma.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId, userId: user.id } },
        create: { workspaceId, userId: user.id, role, active: scimUser.active },
        update: { role, active: scimUser.active },
      }),
    ]);

    return this.toScimResponse(scimId, email, name, scimUser.active);
  }

  private toScimResponse(id: string, email: string, name: string, active: boolean) {
    return {
      schemas: [USER_SCHEMA],
      id,
      userName: email,
      active,
      name: { formatted: name },
      emails: [{ value: email, primary: true }],
    };
  }

  private extractEmail(scimUser: ScimUserDtoType) {
    return scimUser.emails.find((email) => email.primary)?.value ?? scimUser.emails[0]?.value ?? scimUser.userName;
  }

  private roleFromGroups(groups: string[]): MemberRole {
    if (groups.some((group) => /owner/i.test(group))) return 'OWNER';
    if (groups.some((group) => /admin/i.test(group))) return 'ADMIN';
    if (groups.some((group) => /read/i.test(group))) return 'READONLY';
    return 'DEVELOPER';
  }

  private hash(value: string) {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}