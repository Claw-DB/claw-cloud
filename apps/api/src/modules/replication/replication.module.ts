import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard.js';
import { ReplicationController } from './replication.controller.js';
import { ReplicationService } from './replication.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ReplicationController],
  providers: [ReplicationService, TenantGuard, WorkspaceRoleGuard],
  exports: [ReplicationService],
})
export class ReplicationModule {}
