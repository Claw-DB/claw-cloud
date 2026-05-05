// JwtStrategy — validates Bearer tokens, checks session validity, and attaches user to request
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service.js';
import { User } from '@prisma/client';

interface JwtPayload {
  sub: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
  ) {
    const jwtSecret = process.env.JWT_SECRET ?? 'change-me-in-production-min-32-chars';
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<User & { sessionId: string }> {
    const user = await this.authService.validateJwt(payload);
    if (!user) {
      throw new UnauthorizedException('Session expired or invalid. Please log in again.');
    }
    return { ...user, sessionId: payload.sessionId };
  }
}
