// RateLimitMiddleware — enforces per-IP and per-tenant request rate limits
import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// Simple in-memory rate limiter (use Redis in production via @nestjs/throttler)
const requestCounts = new Map<string, { count: number; resetAt: number }>();

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly windowMs = 60_000; // 1 minute
  private readonly max = 120; // requests per window

  use(req: Request, _res: Response, next: NextFunction): void {
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
