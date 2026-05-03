// @ApiKeyAuth() decorator — marks endpoints that accept API key authentication
import { applyDecorators } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';

export const ApiKeyAuth = () => applyDecorators(ApiSecurity('api-key'));
