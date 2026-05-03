import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateVectorCollectionDto, CreateVectorCollectionDtoType } from '@claw/common';
import { RequireRole } from '../../common/decorators/require-role.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { HostedVectorService } from './vector.service.js';

@ApiTags('vector')
@Controller('workspaces/:id/vector')
@UseGuards(JwtAuthGuard, TenantGuard, WorkspaceRoleGuard)
@ApiBearerAuth()
export class VectorController {
  constructor(private readonly vectorService: HostedVectorService) {}

  @Get('collections')
  @ApiOperation({ summary: 'List hosted vector collections' })
  async list(@Param('id') workspaceId: string) {
    return this.vectorService.getCollectionStats(workspaceId);
  }

  @Post('collections')
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create a hosted vector collection' })
  async create(
    @Param('id') workspaceId: string,
    @Body(new ZodValidationPipe(CreateVectorCollectionDto)) dto: CreateVectorCollectionDtoType,
  ) {
    await this.vectorService.createCollection(
      workspaceId,
      dto.name,
      dto.dimensions,
      dto.distanceMetric,
    );
    return { ok: true };
  }

  @Delete('collections/:name')
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Delete a hosted vector collection' })
  async delete(@Param('id') workspaceId: string, @Param('name') name: string) {
    await this.vectorService.deleteCollection(workspaceId, name);
    return { ok: true };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get hosted vector collection stats' })
  async stats(@Param('id') workspaceId: string) {
    return this.vectorService.getCollectionStats(workspaceId);
  }
}