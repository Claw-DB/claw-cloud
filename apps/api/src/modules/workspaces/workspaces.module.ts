import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard.js';
import { WorkspacesController } from './workspaces.controller.js';
import { WorkspacesService } from './workspaces.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, TenantGuard, WorkspaceRoleGuard],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
