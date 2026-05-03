// SamlController — HTTP endpoints for SAML SSO metadata, assertion callback, and config management
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  Res,
  UseGuards,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { SamlService } from './saml.service.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../../common/guards/tenant.guard.js';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import { CreateSamlConfigDto, CreateSamlConfigDtoType } from '@claw/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SessionService } from '../session.service.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { User, Workspace } from '@prisma/client';

@ApiTags('saml')
@Controller()
export class SamlController {
  constructor(
    private readonly samlService: SamlService,
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  // ─── SP Metadata ─────────────────────────────────────────────────────────

  @Get('auth/saml/:workspaceSlug/metadata')
  @Header('Content-Type', 'application/xml')
  @ApiOperation({ summary: 'Return SP metadata XML for IdP configuration' })
  async getMetadata(@Param('workspaceSlug') slug: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { slug } });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return this.samlService.generateSpMetadata(workspace.id);
  }

  // ─── Assertion Consumer Service ───────────────────────────────────────────

  @Post('auth/saml/:workspaceSlug/callback')
  @HttpCode(HttpStatus.FOUND)
  @ApiOperation({ summary: 'SAML assertion consumer — validates assertion and issues session' })
  async handleCallback(
    @Param('workspaceSlug') slug: string,
    @Body('SAMLResponse') samlResponse: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const workspace = await this.prisma.workspace.findUnique({ where: { slug } });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const { email, name } = await this.samlService.validateAssertion(workspace.id, samlResponse);

    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { email, name, emailVerified: new Date() },
      });
    }

    const session = await this.sessionService.createSession(user.id, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    // Encode the session token to prevent header injection in redirect
    const encodedToken = encodeURIComponent(session.token);
    res.redirect(`${frontendUrl}/auth/callback?session=${encodedToken}`);
  }

  // ─── SAML Config Management ───────────────────────────────────────────────

  @Post('workspaces/:id/saml')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update SAML SSO configuration for workspace' })
  async createConfig(
    @Param('id') workspaceId: string,
    @Body(new ZodValidationPipe(CreateSamlConfigDto)) dto: CreateSamlConfigDtoType,
    @CurrentUser() _user: User,
  ) {
    return this.samlService.saveConfig(workspaceId, dto);
  }

  @Get('workspaces/:id/saml')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get SAML SSO configuration (cert is masked)' })
  async getConfig(@Param('id') workspaceId: string) {
    const config = await this.samlService.getConfig(workspaceId);
    if (!config) throw new NotFoundException('SAML configuration not found');

    // Mask the certificate for display
    return {
      ...config,
      cert: config.cert.substring(0, 60) + '...[masked]',
    };
  }

  @Delete('workspaces/:id/saml')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove SAML SSO configuration' })
  async deleteConfig(@Param('id') workspaceId: string) {
    await this.prisma.samlConfig.deleteMany({ where: { workspaceId } });
  }

  // ─── Dev-only: IdP test endpoint ──────────────────────────────────────────

  @Post('auth/saml/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[DEV ONLY] Simulate IdP assertion for testing' })
  async testAssertion(@Body() body: { workspaceId: string; email: string; name: string }) {
    // This endpoint is completely disabled outside of development environments
    if (process.env.NODE_ENV !== 'development') {
      throw new NotFoundException();
    }
    return {
      message: 'Test SAML assertion endpoint (dev only)',
      workspaceId: body.workspaceId,
      email: body.email,
      name: body.name,
    };
  }
}
