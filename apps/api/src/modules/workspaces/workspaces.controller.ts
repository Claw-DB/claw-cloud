import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CreateWorkspaceDto,
  CreateWorkspaceDtoType,
  InviteMemberDto,
  InviteMemberDtoType,
  UpdateWorkspaceDto,
  UpdateWorkspaceDtoType,
} from '@claw/common';
import { User, Workspace } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireRole } from '../../common/decorators/require-role.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { WorkspacesService } from './workspaces.service.js';

type WorkspaceRequest = Request & {
  workspace?: Workspace;
};

@ApiTags('workspaces')
@Controller()
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post('workspaces')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a workspace' })
  async create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(CreateWorkspaceDto)) dto: CreateWorkspaceDtoType,
  ) {
    return this.workspacesService.create(user.id, dto);
  }

  @Get('workspaces')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List workspaces for the authenticated user' })
  async list(@CurrentUser() user: User) {
    return this.workspacesService.listForUser(user.id);
  }

  @Get('workspaces/:id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a workspace' })
  async get(@Req() req: WorkspaceRequest) {
    return req.workspace;
  }

  @Patch('workspaces/:id')
  @UseGuards(JwtAuthGuard, TenantGuard, WorkspaceRoleGuard)
  @RequireRole('OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a workspace' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateWorkspaceDto)) dto: UpdateWorkspaceDtoType,
  ) {
    return this.workspacesService.update(id, dto);
  }

  @Delete('workspaces/:id')
  @UseGuards(JwtAuthGuard, TenantGuard, WorkspaceRoleGuard)
  @RequireRole('OWNER')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a workspace' })
  async delete(@Param('id') id: string) {
    await this.workspacesService.delete(id);
  }

  @Get('workspaces/:id/members')
  @UseGuards(JwtAuthGuard, TenantGuard, WorkspaceRoleGuard)
  @RequireRole('OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List workspace members' })
  async members(@Param('id') id: string) {
    return this.workspacesService.getMembers(id);
  }

  @Post('workspaces/:id/members/invite')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard, TenantGuard, WorkspaceRoleGuard)
  @RequireRole('OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite a workspace member' })
  async invite(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(InviteMemberDto)) dto: InviteMemberDtoType,
  ) {
    return this.workspacesService.inviteMember(id, dto.email, dto.role, user.id);
  }

  @Delete('workspaces/:id/members/:userId')
  @UseGuards(JwtAuthGuard, TenantGuard, WorkspaceRoleGuard)
  @RequireRole('OWNER', 'ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a workspace member' })
  async removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    await this.workspacesService.removeMember(id, userId);
  }

  @Get('invitations/:token')
  @ApiOperation({ summary: 'Get invitation info' })
  async getInvitation(@Param('token') token: string) {
    return this.workspacesService.getInvitationInfo(token);
  }

  @Post('invitations/:token/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept an invitation' })
  async acceptInvitation(@Param('token') token: string) {
    return this.workspacesService.acceptInvitation(token);
  }
}