import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ScimPatchOpDto, ScimPatchOpDtoType, ScimUserDto, ScimUserDtoType } from '@claw/common';
import { ScimAuthGuard } from './scim-auth.guard.js';
import { ScimService } from './scim.service.js';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';

@ApiExcludeController()
@Controller('scim/v2/workspaces/:id')
@UseGuards(ScimAuthGuard)
export class ScimController {
  constructor(private readonly scimService: ScimService) {}

  @Get('Users')
  async list(
    @Param('id') workspaceId: string,
    @Query('filter') filter?: string,
    @Query('startIndex') startIndex?: string,
    @Query('count') count?: string,
  ) {
    return this.scimService.listUsers(
      workspaceId,
      filter,
      startIndex ? Number(startIndex) : 1,
      count ? Number(count) : 100,
    );
  }

  @Post('Users')
  async create(
    @Param('id') workspaceId: string,
    @Body(new ZodValidationPipe(ScimUserDto)) body: ScimUserDtoType,
  ) {
    return this.scimService.provisionUser(workspaceId, body);
  }

  @Get('Users/:scimId')
  async get(@Param('id') workspaceId: string, @Param('scimId') scimId: string) {
    return this.scimService.getUser(workspaceId, scimId);
  }

  @Put('Users/:scimId')
  async update(
    @Param('id') workspaceId: string,
    @Param('scimId') scimId: string,
    @Body(new ZodValidationPipe(ScimUserDto)) body: ScimUserDtoType,
  ) {
    return this.scimService.updateUser(workspaceId, scimId, body);
  }

  @Patch('Users/:scimId')
  async patch(
    @Param('id') workspaceId: string,
    @Param('scimId') scimId: string,
    @Body() body: { Operations: ScimPatchOpDtoType[] },
  ) {
    const operations = body.Operations.map((operation) => ScimPatchOpDto.parse(operation));
    return this.scimService.patchUser(workspaceId, scimId, operations);
  }

  @Delete('Users/:scimId')
  async delete(@Param('id') workspaceId: string, @Param('scimId') scimId: string) {
    await this.scimService.deprovisionUser(workspaceId, scimId);
    return { ok: true };
  }

  @Get('ServiceProviderConfig')
  async config() {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      patch: { supported: true },
      filter: { supported: true, maxResults: 100 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [{ type: 'oauthbearertoken', name: 'Bearer Token' }],
    };
  }
}