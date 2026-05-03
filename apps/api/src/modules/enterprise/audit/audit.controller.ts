import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuditQueryDto, AuditQueryDtoType } from '@claw/common';
import { RequireRole } from '../../../common/decorators/require-role.decorator.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../../common/guards/tenant.guard.js';
import { WorkspaceRoleGuard } from '../../../common/guards/workspace-role.guard.js';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import { AuditService } from './audit.service.js';

@ApiTags('audit')
@Controller('workspaces/:id/audit-logs')
@UseGuards(JwtAuthGuard, TenantGuard, WorkspaceRoleGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Query workspace audit logs' })
  async query(
    @Param('id') workspaceId: string,
    @Query(new ZodValidationPipe(AuditQueryDto)) filters: AuditQueryDtoType,
  ) {
    return this.auditService.query(workspaceId, filters);
  }

  @Get('export')
  @RequireRole('OWNER')
  @ApiOperation({ summary: 'Export workspace audit logs' })
  async export(
    @Param('id') workspaceId: string,
    @Query(new ZodValidationPipe(AuditQueryDto)) filters: AuditQueryDtoType,
    @Query('format') format: 'json' | 'csv',
    @Res() res: Response,
  ) {
    const buffer = await this.auditService.export(workspaceId, filters, format ?? 'json');
    res.type(format === 'csv' ? 'text/csv' : 'application/json');
    res.send(buffer);
  }

  @Get('verify')
  @RequireRole('OWNER')
  @ApiOperation({ summary: 'Verify audit log integrity' })
  async verify(
    @Param('id') workspaceId: string,
    @Query('fromId') fromId?: string,
    @Query('toId') toId?: string,
  ) {
    return this.auditService.verifyIntegrity(workspaceId, fromId, toId);
  }
}