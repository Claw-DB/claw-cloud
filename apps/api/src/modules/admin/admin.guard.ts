import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@prisma/client';

type AdminRequest = {
  user?: User;
};

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const user = request.user;

    if (!user?.email) {
      throw new UnauthorizedException('Authenticated user is required');
    }

    const configured = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (configured.length && configured.includes(user.email.toLowerCase())) {
      return true;
    }

    const allowedDomain = (process.env.ADMIN_EMAIL_DOMAIN ?? '').trim().toLowerCase();
    if (allowedDomain && user.email.toLowerCase().endsWith(`@${allowedDomain}`)) {
      return true;
    }

    throw new ForbiddenException('Admin access is restricted');
  }
}
