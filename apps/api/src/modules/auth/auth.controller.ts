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
  ForgotPasswordDto,
  ResetPasswordDto,
  MagicLinkDto,
  RegisterDtoType,
  LoginDtoType,
  ForgotPasswordDtoType,
  ResetPasswordDtoType,
  MagicLinkDtoType,
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

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Invalidate current session' })
  async logout(@CurrentUser() user: User & { sessionId: string }) {
    await this.authService.logout(user.sessionId);
  }

  @Post('forgot-password')
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
    const { passwordHash: _, ...safeUser } = user as User & { passwordHash?: string };
    return safeUser;
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
    @Req() req: Request & { user: { user: User; token: string } },
    @Res() res: Response,
  ) {
    const { token } = req.user;
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
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
    @Req() req: Request & { user: { user: User; token: string } },
    @Res() res: Response,
  ) {
    const { token } = req.user;
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  }

  // ─── Magic Link ───────────────────────────────────────────────────────────

  @Post('magic-link')
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

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    // Encode session token to prevent header injection in redirect
    const encodedToken = encodeURIComponent(session.token);
    res.redirect(`${frontendUrl}/auth/callback?session=${encodedToken}`);
  }
}
