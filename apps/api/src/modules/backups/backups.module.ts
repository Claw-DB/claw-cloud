import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard.js';
import { BackupsController } from './backups.controller.js';
import { BackupsService } from './backups.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [BackupsController],
  providers: [BackupsService, TenantGuard, WorkspaceRoleGuard],
  exports: [BackupsService],
})
export class BackupsModule {}
