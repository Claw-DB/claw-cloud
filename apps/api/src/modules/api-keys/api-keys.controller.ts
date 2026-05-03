import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateApiKeyDto, CreateApiKeyDtoType } from '@claw/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireRole } from '../../common/decorators/require-role.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ApiKeysService } from './api-keys.service.js';

@ApiTags('api-keys')
@Controller('workspaces/:id/api-keys')
@UseGuards(JwtAuthGuard, TenantGuard, WorkspaceRoleGuard)
@ApiBearerAuth()
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create a workspace API key' })
  async create(
    @Param('id') workspaceId: string,
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(CreateApiKeyDto)) dto: CreateApiKeyDtoType,
  ) {
    return this.apiKeysService.create(workspaceId, user.id, dto);
  }

  @Get()
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'List workspace API keys' })
  async list(@Param('id') workspaceId: string) {
    return this.apiKeysService.list(workspaceId);
  }

  @Delete(':keyId')
  @RequireRole('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an API key' })
  async revoke(@Param('id') workspaceId: string, @Param('keyId') keyId: string) {
    await this.apiKeysService.revoke(keyId, workspaceId);
  }

  @Post(':keyId/rotate')
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Rotate an API key' })
  async rotate(@Param('id') workspaceId: string, @Param('keyId') keyId: string) {
    return this.apiKeysService.rotate(keyId, workspaceId);
  }
}