import { SetMetadata } from '@nestjs/common';
import { MemberRole } from '@prisma/client';

export const WORKSPACE_ROLES_KEY = 'workspace_roles';
export const RequireRole = (...roles: MemberRole[]) => SetMetadata(WORKSPACE_ROLES_KEY, roles);