// RateLimitMiddleware — enforces per-IP request rate limits as a development fallback.
// NOTE: In production, use @nestjs/throttler with Redis backend instead.
// This in-memory implementation is for single-instance local development only.
import { Injectable, NestMiddleware, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// Simple in-memory rate limiter — NOT suitable for multi-instance production deployments.
const requestCounts = new Map<string, { count: number; resetAt: number }>();

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly windowMs = 60_000; // 1 minute
  private readonly max = 120; // requests per window

  use(req: Request, _res: Response, next: NextFunction): void {
    if (process.env.NODE_ENV === 'production') {
      // In production, rely exclusively on @nestjs/throttler with Redis
      this.logger.warn(
        'In-memory RateLimitMiddleware is active in production — switch to @nestjs/throttler with Redis',
      );
    }

    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const record = requestCounts.get(key);

    if (!record || record.resetAt < now) {
      requestCounts.set(key, { count: 1, resetAt: now + this.windowMs });
    } else {
      record.count++;
      if (record.count > this.max) {
        throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
      }
    }
    next();
  }
}
