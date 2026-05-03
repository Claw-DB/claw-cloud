// GoogleStrategy — Passport OAuth strategy for Google authentication
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service.js';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') ?? '',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') ?? '',
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL') ?? 'http://localhost:4000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value ?? `${profile.id}@noreply.claw.cloud`;
    const name = profile.displayName ?? 'Google User';
    const avatarUrl = profile.photos?.[0]?.value;

    const result = await this.authService.findOrCreateOAuthUser(
      email,
      name,
      avatarUrl,
      'GOOGLE',
      profile.id,
      accessToken,
      refreshToken,
    );

    done(null, result);
  }
}
