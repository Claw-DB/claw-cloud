import { Controller, Delete, Get, Param, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateReplicationLinkDto, CreateReplicationLinkDtoType } from '@claw/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard.js';
import { RequireRole } from '../../common/decorators/require-role.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ReplicationService } from './replication.service.js';

@ApiTags('replication')
@Controller('workspaces/:id/replication/links')
@UseGuards(JwtAuthGuard, TenantGuard, WorkspaceRoleGuard)
@ApiBearerAuth()
export class ReplicationController {
  constructor(private readonly replicationService: ReplicationService) {}

  @Post()
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create a replication link' })
  async create(
    @Param('id') workspaceId: string,
    @Body(new ZodValidationPipe(CreateReplicationLinkDto)) dto: CreateReplicationLinkDtoType,
  ) {
    return this.replicationService.createLink(dto.sourceInstanceId, dto.targetInstanceId, workspaceId);
  }

  @Get()
  @ApiOperation({ summary: 'List replication links' })
  async list(@Param('id') workspaceId: string) {
    return this.replicationService.listLinks(workspaceId);
  }

  @Delete(':linkId')
  @RequireRole('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a replication link' })
  async delete(@Param('id') workspaceId: string, @Param('linkId') linkId: string) {
    await this.replicationService.deleteLink(linkId, workspaceId);
  }

  @Post(':linkId/pause')
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Pause a replication link' })
  async pause(@Param('id') workspaceId: string, @Param('linkId') linkId: string) {
    return this.replicationService.pauseLink(linkId, workspaceId);
  }

  @Post(':linkId/resume')
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Resume a replication link' })
  async resume(@Param('id') workspaceId: string, @Param('linkId') linkId: string) {
    return this.replicationService.resumeLink(linkId, workspaceId);
  }

  @Get(':linkId/status')
  @ApiOperation({ summary: 'Get replication link status' })
  async status(@Param('id') workspaceId: string, @Param('linkId') linkId: string) {
    return this.replicationService.getStatus(linkId, workspaceId);
  }
}