// AuthModule — wires JWT, Passport, OAuth, magic-link, and SAML authentication providers
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { LocalStrategy } from './strategies/local.strategy.js';
import { GithubStrategy } from './strategies/github.strategy.js';
import { GoogleStrategy } from './strategies/google.strategy.js';
import { SessionService } from './session.service.js';
import { MagicLinkService } from './magic-link.service.js';
import { SamlModule } from './saml/saml.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.get<string>('JWT_EXPIRY') ?? '15m',
        },
      }),
    }),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'single',
        url: config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
      }),
    }),
    SamlModule,
  ],
  providers: [
    AuthService,
    SessionService,
    MagicLinkService,
    JwtStrategy,
    LocalStrategy,
    GithubStrategy,
    GoogleStrategy,
  ],
  controllers: [AuthController],
  exports: [AuthService, SessionService, JwtModule],
})
export class AuthModule {}
