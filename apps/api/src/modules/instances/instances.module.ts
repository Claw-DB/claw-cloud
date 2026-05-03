import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard.js';
import { InstancesController } from './instances.controller.js';
import { InstancesService } from './instances.service.js';
import { KubeService } from './kube.service.js';
import { VectorController } from './vector.controller.js';
import { HostedVectorService } from './vector.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [InstancesController, VectorController],
  providers: [InstancesService, KubeService, HostedVectorService, TenantGuard, WorkspaceRoleGuard],
  exports: [InstancesService, KubeService, HostedVectorService],
})
export class InstancesModule {}
