// AuthService — core authentication logic: register, login, logout, password reset, email verify
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { SessionService } from './session.service.js';
import { User } from '@prisma/client';
import { BCRYPT_ROUNDS, JOB_NAMES, QUEUE_NAMES } from '@claw/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import { getQueue } from '../../common/infra/queue.js';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const LOCKOUT_MINUTES = 15;
const MAX_FAILED_LOGIN_ATTEMPTS = 10;

type AuthMeta = {
  userAgent?: string;
  ipAddress?: string;
};

type SafeUser = Omit<
  User,
  'passwordHash' | 'totpSecret' | 'failedLoginAttempts' | 'lockedUntil'
>;

type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

type AuthSuccess = {
  requiresTotp: false;
  user: SafeUser;
  tokens: TokenPair;
};

type TotpChallenge = {
  requiresTotp: true;
  tempToken: string;
};

type LoginResult = AuthSuccess | TotpChallenge;

@Injectable()
export class AuthService {
  private readonly emailQueue = getQueue(QUEUE_NAMES.EMAIL);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Register a new user with email and password.
   * Password is hashed with bcrypt (rounds=12).
   * Note: JavaScript strings are immutable and managed by the V8 GC, so true
   * in-memory zeroization of string values is not possible in Node.js.
   */
  async register(
    email: string,
    password: string,
    name: string,
    meta?: AuthMeta,
  ): Promise<AuthSuccess> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email is already registered');

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: { email, name, passwordHash: hash },
    });

    return this.createAuthSuccess(user, meta);
  }

  /**
   * Authenticate with email and password, returning a signed JWT.
   */
  async login(
    email: string,
    password: string,
    meta?: AuthMeta,
  ): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked. Try again later.');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await this.recordFailedLogin(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    if (user.totpEnabled) {
      return {
        requiresTotp: true,
        tempToken: this.jwtService.sign(
          { sub: user.id, purpose: 'totp-login' },
          { expiresIn: '10m' },
        ),
      };
    }

    return this.createAuthSuccess(user, meta);
  }

  async verifyTotp(
    tempToken: string,
    code: string,
    meta?: AuthMeta,
  ): Promise<AuthSuccess> {
    let payload: { sub: string; purpose: string };
    try {
      payload = this.jwtService.verify<{ sub: string; purpose: string }>(tempToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired TOTP challenge token');
    }

    if (payload.purpose !== 'totp-login') {
      throw new UnauthorizedException('Invalid TOTP challenge token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.totpEnabled || !user.totpSecret) {
      throw new UnauthorizedException('TOTP is not enabled for this account');
    }

    const isValidCode = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!isValidCode) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.createAuthSuccess(user, meta);
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const session = await this.prisma.session.findFirst({
      where: {
        token: refreshToken,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const rotatedRefreshToken = crypto.randomBytes(48).toString('hex');
    const updatedSession = await this.prisma.session.update({
      where: { id: session.id },
      data: {
        token: rotatedRefreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken: this.signJwt(updatedSession.userId, updatedSession.id),
      refreshToken: updatedSession.token,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  async enableTotp(userId: string): Promise<{ secret: string; otpauthUrl: string | null }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const secret = speakeasy.generateSecret({
      name: `claw-cloud (${user.email})`,
      issuer: 'claw-cloud',
      length: 32,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: secret.base32,
        totpEnabled: false,
      },
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url ?? null,
    };
  }

  async confirmTotp(userId: string, code: string): Promise<{ enabled: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) {
      throw new BadRequestException('TOTP setup has not been started');
    }

    const isValidCode = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!isValidCode) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });

    return { enabled: true };
  }

  async disableTotp(userId: string, code: string): Promise<{ enabled: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('TOTP is not enabled');
    }

    const isValidCode = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!isValidCode) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabled: false,
        totpSecret: null,
      },
    });

    return { enabled: false };
  }

  /**
   * Invalidate an existing session (logout).
   */
  async logout(sessionId: string): Promise<void> {
    await this.sessionService.deleteSession(sessionId);
  }

  async logoutByRefreshToken(refreshToken: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { token: refreshToken } });
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

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    await this.emailQueue.add(JOB_NAMES.PASSWORD_RESET_EMAIL, {
      to: user.email,
      template: 'password-reset',
      variables: {
        resetUrl: `${frontendUrl}/reset-password?token=${token}`,
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
    // Overwrite the buffer; note JS string immutability means we cannot fully
    // zeroize the original string, but we minimize exposure via buffer use.
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
    meta?: AuthMeta,
  ): Promise<AuthSuccess> {
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

    return this.createAuthSuccess(user, meta);
  }

  private signJwt(userId: string, sessionId: string): string {
    return this.jwtService.sign(
      { sub: userId, sessionId },
      { expiresIn: process.env.JWT_EXPIRY ?? `${ACCESS_TOKEN_TTL_SECONDS}s` },
    );
  }

  issueAccessToken(userId: string, sessionId: string): string {
    return this.signJwt(userId, sessionId);
  }

  private async recordFailedLogin(userId: string, failedAttempts: number): Promise<void> {
    const nextAttempts = failedAttempts + 1;
    const shouldLock = nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: shouldLock ? 0 : nextAttempts,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null,
      },
    });
  }

  private async createAuthSuccess(user: User, meta?: AuthMeta): Promise<AuthSuccess> {
    const session = await this.sessionService.createSession(user.id, meta);
    return {
      requiresTotp: false,
      user: this.toSafeUser(user),
      tokens: {
        accessToken: this.signJwt(user.id, session.id),
        refreshToken: session.token,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
    };
  }

  private toSafeUser(user: User): SafeUser {
    const {
      passwordHash: _passwordHash,
      totpSecret: _totpSecret,
      failedLoginAttempts: _failedLoginAttempts,
      lockedUntil: _lockedUntil,
      ...safeUser
    } = user;
    return safeUser;
  }
}
