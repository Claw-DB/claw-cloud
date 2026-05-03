import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard.js';
import { ApiKeysController } from './api-keys.controller.js';
import { ApiKeysService } from './api-keys.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, TenantGuard, WorkspaceRoleGuard],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
