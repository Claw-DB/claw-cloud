// JwtStrategy — validates Bearer tokens, checks session validity, and attaches user to request
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
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
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_PUBLIC_KEY')?.replace(/\\n/g, '\n'),
      algorithms: ['RS256'],
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
