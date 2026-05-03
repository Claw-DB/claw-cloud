import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { UsageService } from './usage.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [BillingController],
  providers: [BillingService, UsageService, TenantGuard, WorkspaceRoleGuard],
  exports: [BillingService, UsageService],
})
export class BillingModule {}
