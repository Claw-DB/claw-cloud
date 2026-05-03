import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateInstanceDto,
  CreateInstanceDtoType,
  ScaleInstanceDto,
  ScaleInstanceDtoType,
} from '@claw/common';
import { RequireRole } from '../../common/decorators/require-role.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { InstancesService } from './instances.service.js';

@ApiTags('instances')
@Controller('workspaces/:id/instances')
@UseGuards(JwtAuthGuard, TenantGuard, WorkspaceRoleGuard)
@ApiBearerAuth()
export class InstancesController {
  constructor(private readonly instancesService: InstancesService) {}

  @Post()
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create a hosted ClawDB instance' })
  async create(
    @Param('id') workspaceId: string,
    @Body(new ZodValidationPipe(CreateInstanceDto)) dto: CreateInstanceDtoType,
  ) {
    return this.instancesService.create(workspaceId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List instances for a workspace' })
  async list(@Param('id') workspaceId: string) {
    return this.instancesService.findAll(workspaceId);
  }

  @Get(':instanceId')
  @ApiOperation({ summary: 'Get an instance' })
  async get(@Param('id') workspaceId: string, @Param('instanceId') instanceId: string) {
    return this.instancesService.findById(instanceId, workspaceId);
  }

  @Get(':instanceId/status')
  @ApiOperation({ summary: 'Get merged DB and pod status for an instance' })
  async status(@Param('id') workspaceId: string, @Param('instanceId') instanceId: string) {
    return this.instancesService.getStatus(instanceId, workspaceId);
  }

  @Post(':instanceId/scale')
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Scale an instance' })
  async scale(
    @Param('id') workspaceId: string,
    @Param('instanceId') instanceId: string,
    @Body(new ZodValidationPipe(ScaleInstanceDto)) dto: ScaleInstanceDtoType,
  ) {
    return this.instancesService.scale(instanceId, workspaceId, dto);
  }

  @Post(':instanceId/pause')
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Pause an instance' })
  async pause(@Param('id') workspaceId: string, @Param('instanceId') instanceId: string) {
    return this.instancesService.pause(instanceId, workspaceId);
  }

  @Post(':instanceId/resume')
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Resume an instance' })
  async resume(@Param('id') workspaceId: string, @Param('instanceId') instanceId: string) {
    return this.instancesService.resume(instanceId, workspaceId);
  }

  @Delete(':instanceId')
  @RequireRole('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Terminate an instance' })
  async terminate(@Param('id') workspaceId: string, @Param('instanceId') instanceId: string) {
    await this.instancesService.terminate(instanceId, workspaceId);
  }

  @Get(':instanceId/connection')
  @ApiOperation({ summary: 'Get connection details for an instance' })
  async connection(@Param('id') workspaceId: string, @Param('instanceId') instanceId: string) {
    return this.instancesService.getConnectionInfo(instanceId, workspaceId);
  }

  @Get(':instanceId/health')
  @ApiOperation({ summary: 'Run an on-demand health check' })
  async health(@Param('id') workspaceId: string, @Param('instanceId') instanceId: string) {
    return this.instancesService.healthCheck(instanceId, workspaceId);
  }
}