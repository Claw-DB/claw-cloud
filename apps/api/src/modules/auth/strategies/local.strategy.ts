// LocalStrategy — Passport local strategy for email/password authentication
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service.js';
import { User } from '@prisma/client';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<Omit<User, 'passwordHash'>> {
    const result = await this.authService.login(email, password).catch(() => null);
    if (!result) throw new UnauthorizedException('Invalid email or password');
    return result.user;
  }
}
