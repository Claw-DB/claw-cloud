// @RequireScope() decorator — marks endpoints that require specific API key scopes
import { SetMetadata } from '@nestjs/common';

export const SCOPES_KEY = 'scopes';
export const RequireScope = (...scopes: string[]) => SetMetadata(SCOPES_KEY, scopes);
