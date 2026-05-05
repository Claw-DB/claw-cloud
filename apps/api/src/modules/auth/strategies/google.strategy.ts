// GoogleStrategy — Passport OAuth strategy for Google authentication
import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { AuthService } from '../auth.service.js';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID ?? 'dev-google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? 'dev-google-client-secret',
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:4000/api/v1/auth/google/callback',
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
