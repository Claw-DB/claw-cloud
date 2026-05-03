// JwtAuthGuard — extends Passport JWT guard with descriptive error messages
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(err: Error | null, user: TUser | false): TUser {
    if (err || !user) {
      throw new UnauthorizedException(
        err?.message ?? 'Invalid or expired authentication token. Please log in again.',
      );
    }
    return user;
  }
}
