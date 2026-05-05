// LocalStrategy — Passport local strategy for email/password authentication
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service.js';
import { User } from '@prisma/client';

type LocalSafeUser = Omit<
  User,
  'passwordHash' | 'totpSecret' | 'failedLoginAttempts' | 'lockedUntil'
>;

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<LocalSafeUser> {
    const result = await this.authService.login(email, password).catch(() => null);
    if (!result) throw new UnauthorizedException('Invalid email or password');
    if (result.requiresTotp) {
      throw new UnauthorizedException('TOTP verification required');
    }
    return result.user;
  }
}
