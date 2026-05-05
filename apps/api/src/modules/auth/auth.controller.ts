// AuthController — HTTP endpoints for all authentication flows (email, OAuth, magic-link)
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { MagicLinkService } from './magic-link.service.js';
import { SessionService } from './session.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  RegisterDto,
  LoginDto,
  VerifyTotpDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  MagicLinkDto,
  ConfirmTotpDto,
  DisableTotpDto,
  RegisterDtoType,
  LoginDtoType,
  VerifyTotpDtoType,
  RefreshTokenDtoType,
  ForgotPasswordDtoType,
  ResetPasswordDtoType,
  MagicLinkDtoType,
  ConfirmTotpDtoType,
  DisableTotpDtoType,
} from '@claw/common';
import { User } from '@prisma/client';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly magicLinkService: MagicLinkService,
    private readonly sessionService: SessionService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new user account' })
  async register(
    @Body(new ZodValidationPipe(RegisterDto)) body: RegisterDtoType,
    @Req() req: Request,
  ) {
    return this.authService.register(body.email, body.password, body.name, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  async login(
    @Body(new ZodValidationPipe(LoginDto)) body: LoginDtoType,
    @Req() req: Request,
  ) {
    return this.authService.login(body.email, body.password, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Post('verify-totp')
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete login with a TOTP challenge code' })
  async verifyTotp(
    @Body(new ZodValidationPipe(VerifyTotpDto)) body: VerifyTotpDtoType,
    @Req() req: Request,
  ) {
    return this.authService.verifyTotp(body.tempToken, body.code, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange refresh token for a new access token pair' })
  async refresh(
    @Body(new ZodValidationPipe(RefreshTokenDto)) body: RefreshTokenDtoType,
  ) {
    return this.authService.refreshTokens(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Invalidate a refresh-token-backed session' })
  async logout(
    @Body(new ZodValidationPipe(RefreshTokenDto)) body: RefreshTokenDtoType,
  ) {
    await this.authService.logoutByRefreshToken(body.refreshToken);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  async forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordDto)) body: ForgotPasswordDtoType,
  ) {
    // Always return 200 to prevent email enumeration
    await this.authService.forgotPassword(body.email);
    return { message: 'If an account exists, a reset email has been sent.' };
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using a secure token' })
  async resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordDto)) body: ResetPasswordDtoType,
  ) {
    await this.authService.resetPassword(body.token, body.password);
    return { message: 'Password reset successfully.' };
  }

  @Get('verify-email/:token')
  @ApiOperation({ summary: 'Verify email address using a one-time token' })
  async verifyEmail(@Param('token') token: string) {
    await this.authService.verifyEmail(token);
    return { message: 'Email verified successfully.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the currently authenticated user' })
  async me(@CurrentUser() user: User) {
    const {
      passwordHash: _,
      totpSecret: __,
      failedLoginAttempts: ___,
      lockedUntil: ____,
      ...safeUser
    } = user as User & {
      passwordHash?: string;
      totpSecret?: string;
      failedLoginAttempts?: number;
      lockedUntil?: Date | null;
    };
    return safeUser;
  }

  @Post('enable-totp')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate TOTP secret and QR data for current user' })
  async enableTotp(@CurrentUser() user: User) {
    return this.authService.enableTotp(user.id);
  }

  @Post('confirm-totp')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm and enable TOTP using a one-time code' })
  async confirmTotp(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(ConfirmTotpDto)) body: ConfirmTotpDtoType,
  ) {
    return this.authService.confirmTotp(user.id, body.code);
  }

  @Post('disable-totp')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable TOTP after validating a one-time code' })
  async disableTotp(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(DisableTotpDto)) body: DisableTotpDtoType,
  ) {
    return this.authService.disableTotp(user.id, body.code);
  }

  // ─── OAuth: GitHub ────────────────────────────────────────────────────────

  @Get('github')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Redirect to GitHub OAuth' })
  githubAuth() {
    // Passport handles the redirect
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth callback — issues JWT and redirects to dashboard' })
  async githubCallback(
    @Req()
    req: Request & {
      user: { requiresTotp: false; user: User; tokens: { accessToken: string; refreshToken: string } };
    },
    @Res() res: Response,
  ) {
    const { accessToken, refreshToken } = req.user.tokens;
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    res.redirect(
      `${frontendUrl}/auth/callback?token=${encodeURIComponent(accessToken)}&refresh=${encodeURIComponent(refreshToken)}`,
    );
  }

  // ─── OAuth: Google ────────────────────────────────────────────────────────

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Redirect to Google OAuth' })
  googleAuth() {
    // Passport handles the redirect
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback — issues JWT and redirects to dashboard' })
  async googleCallback(
    @Req()
    req: Request & {
      user: { requiresTotp: false; user: User; tokens: { accessToken: string; refreshToken: string } };
    },
    @Res() res: Response,
  ) {
    const { accessToken, refreshToken } = req.user.tokens;
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    res.redirect(
      `${frontendUrl}/auth/callback?token=${encodeURIComponent(accessToken)}&refresh=${encodeURIComponent(refreshToken)}`,
    );
  }

  // ─── Magic Link ───────────────────────────────────────────────────────────

  @Post('magic-link')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a passwordless magic-link login email' })
  async requestMagicLink(
    @Body(new ZodValidationPipe(MagicLinkDto)) body: MagicLinkDtoType,
  ) {
    // Generate token regardless of whether user exists (prevent email enumeration)
    await this.magicLinkService.generateToken(body.email);
    // TODO: Enqueue MagicLinkEmailJob via BullMQ
    return { message: 'If an account exists, a magic link has been sent.' };
  }

  @Get('magic-link/verify')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify magic-link token and issue a JWT' })
  async verifyMagicLink(
    @Query('token') token: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    if (!token) throw new BadRequestException('Token is required');

    const email = await this.magicLinkService.consumeToken(token);
    if (!email) throw new NotFoundException('Magic link is invalid or has expired');

    // Find or create the user
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { email, name: email.split('@')[0], emailVerified: new Date() },
      });
    }

    const session = await this.sessionService.createSession(user.id, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    const accessToken = this.authService.issueAccessToken(user.id, session.id);
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const encodedToken = encodeURIComponent(accessToken);
    const encodedRefresh = encodeURIComponent(session.token);
    res.redirect(`${frontendUrl}/auth/callback?token=${encodedToken}&refresh=${encodedRefresh}`);
  }
}
