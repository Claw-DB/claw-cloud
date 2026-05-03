// GithubStrategy — Passport OAuth strategy for GitHub authentication
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service.js';
import { User } from '@prisma/client';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.get<string>('GITHUB_CLIENT_ID') ?? '',
      clientSecret: config.get<string>('GITHUB_CLIENT_SECRET') ?? '',
      callbackURL: config.get<string>('GITHUB_CALLBACK_URL') ?? 'http://localhost:4000/auth/github/callback',
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
      profile.emails?.[0]?.value ?? `${profile.id}@github.noreply.example`;
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

    done(null, result as unknown as User);
  }
}
