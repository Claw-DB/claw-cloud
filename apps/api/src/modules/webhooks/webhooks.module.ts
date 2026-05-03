import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard.js';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, TenantGuard, WorkspaceRoleGuard],
  exports: [WebhooksService],
})
export class WebhooksModule {}
