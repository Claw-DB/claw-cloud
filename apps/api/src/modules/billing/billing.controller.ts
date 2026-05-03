import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BillingCheckoutDto,
  BillingCheckoutDtoType,
  BillingPortalDto,
  BillingPortalDtoType,
  CancelSubscriptionDto,
  CancelSubscriptionDtoType,
} from '@claw/common';
import { User } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard.js';
import { RequireRole } from '../../common/decorators/require-role.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BillingService } from './billing.service.js';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a Stripe checkout session' })
  async checkout(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(BillingCheckoutDto)) dto: BillingCheckoutDtoType,
  ) {
    await this.assertMembership(dto.workspaceId, user.id);
    return this.billingService.createCheckoutSession(
      dto.workspaceId,
      dto.plan,
      dto.successUrl,
      dto.cancelUrl,
    );
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a Stripe billing portal session' })
  async portal(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(BillingPortalDto)) dto: BillingPortalDtoType,
  ) {
    await this.assertMembership(dto.workspaceId, user.id);
    return this.billingService.createPortalSession(dto.workspaceId, dto.returnUrl);
  }

  @Get('subscription/:workspaceId')
  @UseGuards(JwtAuthGuard, TenantGuard, WorkspaceRoleGuard)
  @RequireRole('OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get billing subscription state' })
  async subscription(@Param('workspaceId') workspaceId: string) {
    return this.billingService.getCurrentSubscription(workspaceId);
  }

  @Get('invoices/:workspaceId')
  @UseGuards(JwtAuthGuard, TenantGuard, WorkspaceRoleGuard)
  @RequireRole('OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List invoices for a workspace' })
  async invoices(@Param('workspaceId') workspaceId: string) {
    return this.billingService.getInvoices(workspaceId);
  }

  @Post('subscription/:workspaceId/cancel')
  @UseGuards(JwtAuthGuard, TenantGuard, WorkspaceRoleGuard)
  @RequireRole('OWNER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a workspace subscription' })
  async cancel(
    @Param('workspaceId') workspaceId: string,
    @Body(new ZodValidationPipe(CancelSubscriptionDto)) dto: CancelSubscriptionDtoType,
  ) {
    await this.billingService.cancelSubscription(workspaceId, dto.immediately);
    return { ok: true };
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  async webhook(@Req() req: Request & { rawBody?: Buffer }, @Headers('stripe-signature') signature: string) {
    await this.billingService.handleWebhook(req.rawBody ?? Buffer.from(''), signature);
    return { received: true };
  }

  private async assertMembership(workspaceId: string, userId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('User is not a member of the workspace');
    }
  }
}