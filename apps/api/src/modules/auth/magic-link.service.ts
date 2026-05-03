// MagicLinkService — generates, stores, and validates passwordless magic-link tokens via Redis
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { MAGIC_LINK_TTL_SECONDS } from '@claw/common';

const MAGIC_LINK_PREFIX = 'magiclink:';

@Injectable()
export class MagicLinkService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Generate a magic-link token for an email address.
   * Stores sha256(token) → email in Redis with 15-minute TTL.
   * Returns the raw token to be included in the email link.
   */
  async generateToken(email: string): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await this.redis.set(
      `${MAGIC_LINK_PREFIX}${tokenHash}`,
      email,
      'EX',
      MAGIC_LINK_TTL_SECONDS,
    );
    return rawToken;
  }

  /**
   * Validate and consume a magic-link token.
   * Returns the email on success, null if expired or invalid.
   */
  async consumeToken(rawToken: string): Promise<string | null> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const key = `${MAGIC_LINK_PREFIX}${tokenHash}`;
    const email = await this.redis.get(key);
    if (email) await this.redis.del(key);
    return email;
  }
}
