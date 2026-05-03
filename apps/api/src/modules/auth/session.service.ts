// SessionService — manages database Session records (create, validate, delete)
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Session } from '@prisma/client';
import { SESSION_EXPIRY_MS } from '@claw/common';
import * as crypto from 'crypto';

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(
    userId: string,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<Session> {
    const token = crypto.randomBytes(48).toString('hex');
    return this.prisma.session.create({
      data: {
        userId,
        token,
        expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress,
      },
    });
  }

  async findValidSession(sessionId: string): Promise<Session | null> {
    return this.prisma.session.findFirst({
      where: { id: sessionId, expiresAt: { gt: new Date() } },
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}
