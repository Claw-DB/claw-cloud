// GithubStrategy — Passport OAuth strategy for GitHub authentication
import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { AuthService } from '../auth.service.js';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {
    super({
      clientID: process.env.GITHUB_CLIENT_ID ?? 'dev-github-client-id',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? 'dev-github-client-secret',
      callbackURL:
        process.env.GITHUB_CALLBACK_URL ?? 'http://localhost:4000/api/v1/auth/github/callback',
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: Error | null, user: unknown) => void,
  ): Promise<void> {
    const email =
      profile.emails?.[0]?.value ?? `${profile.id}@noreply.claw.cloud`;
    const name = profile.displayName ?? profile.username ?? 'GitHub User';
    const avatarUrl = profile.photos?.[0]?.value;

    const result = await this.authService.findOrCreateOAuthUser(
      email,
      name,
      avatarUrl,
      'GITHUB',
      profile.id,
      accessToken,
      refreshToken,
    );

    done(null, result);
  }
}
