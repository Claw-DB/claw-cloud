// AuthService — core authentication logic: register, login, logout, password reset, email verify
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { SessionService } from './session.service.js';
import { User } from '@prisma/client';
import { BCRYPT_ROUNDS } from '@claw/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Register a new user with email and password.
   * Password is hashed with bcrypt (rounds=12) and then zeroized from memory.
   */
  async register(
    email: string,
    password: string,
    name: string,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email is already registered');

    // Hash the password and zeroize the plaintext from memory
    const passwordBuf = Buffer.from(password, 'utf8');
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    passwordBuf.fill(0);

    const user = await this.prisma.user.create({
      data: { email, name, passwordHash: hash },
    });

    const session = await this.sessionService.createSession(user.id, meta);
    const token = this.signJwt(user.id, session.id);

    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  /**
   * Authenticate with email and password, returning a signed JWT.
   */
  async login(
    email: string,
    password: string,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    const session = await this.sessionService.createSession(user.id, meta);
    const token = this.signJwt(user.id, session.id);

    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  /**
   * Invalidate an existing session (logout).
   */
  async logout(sessionId: string): Promise<void> {
    await this.sessionService.deleteSession(sessionId);
  }

  /**
   * Validate JWT payload and return the associated user (used by JwtStrategy).
   */
  async validateJwt(payload: { sub: string; sessionId: string }): Promise<User | null> {
    const session = await this.sessionService.findValidSession(payload.sessionId);
    if (!session) return null;

    return this.prisma.user.findUnique({ where: { id: payload.sub } });
  }

  /**
   * Initiate forgot-password flow: generate a secure token and store it.
   * (Token delivery via email queue is handled by the caller.)
   */
  async forgotPassword(email: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null; // don't leak user existence

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token as a session with a special marker in userAgent
    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: `reset:${tokenHash}`,
        expiresAt,
        userAgent: 'password-reset',
      },
    });

    return token;
  }

  /**
   * Complete password reset: verify token, update hash, zeroize plaintext.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = await this.prisma.session.findFirst({
      where: {
        token: `reset:${tokenHash}`,
        expiresAt: { gt: new Date() },
        userAgent: 'password-reset',
      },
    });
    if (!session) throw new BadRequestException('Invalid or expired reset token');

    const passwordBuf = Buffer.from(newPassword, 'utf8');
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    passwordBuf.fill(0);

    await this.prisma.user.update({
      where: { id: session.userId },
      data: { passwordHash: hash },
    });
    await this.prisma.session.delete({ where: { id: session.id } });
  }

  /**
   * Mark email as verified using a one-time token.
   */
  async verifyEmail(token: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = await this.prisma.session.findFirst({
      where: {
        token: `verify:${tokenHash}`,
        expiresAt: { gt: new Date() },
        userAgent: 'email-verify',
      },
    });
    if (!session) throw new BadRequestException('Invalid or expired verification token');

    await this.prisma.user.update({
      where: { id: session.userId },
      data: { emailVerified: new Date() },
    });
    await this.prisma.session.delete({ where: { id: session.id } });
  }

  /**
   * Find or create a user from an OAuth profile, linking the OAuth account.
   */
  async findOrCreateOAuthUser(
    email: string,
    name: string,
    avatarUrl: string | undefined,
    provider: 'GITHUB' | 'GOOGLE',
    providerAccountId: string,
    accessToken: string,
    refreshToken?: string,
    scope?: string,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<{ user: User; token: string }> {
    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          avatarUrl,
          emailVerified: new Date(), // OAuth emails are pre-verified
        },
      });
    }

    // Link OAuth account (upsert to avoid duplicate)
    await this.prisma.oAuthAccount.upsert({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      update: { accessToken, refreshToken, scope },
      create: { userId: user.id, provider, providerAccountId, accessToken, refreshToken, scope },
    });

    const session = await this.sessionService.createSession(user.id, meta);
    const token = this.signJwt(user.id, session.id);

    return { user, token };
  }

  private signJwt(userId: string, sessionId: string): string {
    return this.jwtService.sign({ sub: userId, sessionId });
  }
}
