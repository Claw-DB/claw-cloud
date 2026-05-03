import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard.js';
import { AuditController } from './audit/audit.controller.js';
import { AuditService } from './audit/audit.service.js';
import { ScimController } from './scim/scim.controller.js';
import { ScimAuthGuard } from './scim/scim-auth.guard.js';
import { ScimService } from './scim/scim.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AuditController, ScimController],
  providers: [AuditService, ScimService, ScimAuthGuard, TenantGuard, WorkspaceRoleGuard],
  exports: [AuditService, ScimService],
})
export class EnterpriseModule {}
