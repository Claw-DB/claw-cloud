import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BackupRestoreDto, BackupRestoreDtoType } from '@claw/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard.js';
import { RequireRole } from '../../common/decorators/require-role.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { BackupsService } from './backups.service.js';

@ApiTags('backups')
@Controller('workspaces/:id')
@UseGuards(JwtAuthGuard, TenantGuard, WorkspaceRoleGuard)
@ApiBearerAuth()
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Post('instances/:instanceId/backups')
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create a backup' })
  async create(@Param('id') workspaceId: string, @Param('instanceId') instanceId: string) {
    return this.backupsService.createBackup(instanceId, workspaceId, 'MANUAL');
  }

  @Get('instances/:instanceId/backups')
  @ApiOperation({ summary: 'List backups for an instance' })
  async list(@Param('id') workspaceId: string, @Param('instanceId') instanceId: string) {
    return this.backupsService.listBackups(instanceId, workspaceId);
  }

  @Get('backups/:backupId')
  @ApiOperation({ summary: 'Get a backup' })
  async get(@Param('id') workspaceId: string, @Param('backupId') backupId: string) {
    return this.backupsService.getBackup(backupId, workspaceId);
  }

  @Delete('backups/:backupId')
  @RequireRole('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a backup' })
  async delete(@Param('id') workspaceId: string, @Param('backupId') backupId: string) {
    await this.backupsService.deleteBackup(backupId, workspaceId);
  }

  @Post('backups/:backupId/restore')
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Restore a backup into an instance' })
  async restore(
    @Param('id') workspaceId: string,
    @Param('backupId') backupId: string,
    @Body(new ZodValidationPipe(BackupRestoreDto)) dto: BackupRestoreDtoType,
  ) {
    await this.backupsService.restoreFromBackup(backupId, dto.targetInstanceId, workspaceId);
    return { accepted: true };
  }
}