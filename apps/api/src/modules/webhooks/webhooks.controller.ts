import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateWebhookDto, CreateWebhookDtoType, UpdateWebhookDto, UpdateWebhookDtoType } from '@claw/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard.js';
import { RequireRole } from '../../common/decorators/require-role.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { WebhooksService } from './webhooks.service.js';

@ApiTags('webhooks')
@Controller('workspaces/:id/webhooks')
@UseGuards(JwtAuthGuard, TenantGuard, WorkspaceRoleGuard)
@ApiBearerAuth()
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create a webhook endpoint' })
  async create(
    @Param('id') workspaceId: string,
    @Body(new ZodValidationPipe(CreateWebhookDto)) dto: CreateWebhookDtoType,
  ) {
    return this.webhooksService.create(workspaceId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List webhooks' })
  async list(@Param('id') workspaceId: string) {
    return this.webhooksService.list(workspaceId);
  }

  @Patch(':webhookId')
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update a webhook endpoint' })
  async update(
    @Param('id') workspaceId: string,
    @Param('webhookId') webhookId: string,
    @Body(new ZodValidationPipe(UpdateWebhookDto)) dto: UpdateWebhookDtoType,
  ) {
    return this.webhooksService.update(webhookId, workspaceId, dto);
  }

  @Delete(':webhookId')
  @RequireRole('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a webhook endpoint' })
  async delete(@Param('id') workspaceId: string, @Param('webhookId') webhookId: string) {
    await this.webhooksService.delete(webhookId, workspaceId);
  }

  @Post(':webhookId/rotate-secret')
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Rotate a webhook secret' })
  async rotate(@Param('id') workspaceId: string, @Param('webhookId') webhookId: string) {
    return this.webhooksService.rotateSecret(webhookId, workspaceId);
  }

  @Post(':webhookId/redeliver/:deliveryId')
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Redeliver a webhook delivery' })
  async redeliver(@Param('deliveryId') deliveryId: string) {
    return this.webhooksService.redeliver(deliveryId);
  }
}