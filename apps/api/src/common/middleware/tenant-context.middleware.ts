// TenantContextMiddleware — resolves workspace slug from subdomain or header and attaches to request
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request & { tenantSlug?: string }, _res: Response, next: NextFunction): void {
    // Support X-Workspace-Slug header or subdomain-based routing
    const slugHeader = req.headers['x-workspace-slug'];
    if (slugHeader && typeof slugHeader === 'string') {
      req.tenantSlug = slugHeader;
    } else {
      // Extract from subdomain: {slug}.api.claw.cloud
      const host = req.headers.host ?? '';
      const subdomain = host.split('.')[0];
      if (subdomain && subdomain !== 'api' && subdomain !== 'localhost') {
        req.tenantSlug = subdomain;
      }
    }
    next();
  }
}
