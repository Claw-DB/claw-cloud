import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { AdminGuard } from './admin.guard.js';
import { AdminService } from './admin.service.js';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get platform overview metrics' })
  async overview() {
    return this.adminService.getOverview();
  }

  @Get('workspaces')
  @ApiOperation({ summary: 'List workspaces with admin filters' })
  async workspaces(
    @Query('search') search?: string,
    @Query('status') status?: 'ACTIVE' | 'SUSPENDED' | 'DELETED',
    @Query('plan') plan?: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE',
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.adminService.listWorkspaces({
      search,
      status,
      plan,
      page: Math.max(1, page ?? 1),
      limit: Math.max(1, Math.min(100, limit ?? 25)),
    });
  }

  @Get('instances')
  @ApiOperation({ summary: 'List instances with admin filters' })
  async instances(
    @Query('status') status?:
      | 'PROVISIONING'
      | 'RUNNING'
      | 'SCALING'
      | 'PAUSED'
      | 'TERMINATING'
      | 'TERMINATED'
      | 'ERROR',
    @Query('region') region?: 'US_EAST' | 'US_WEST' | 'EU_WEST' | 'EU_CENTRAL' | 'APAC_EAST',
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.adminService.listInstances({
      status,
      region,
      page: Math.max(1, page ?? 1),
      limit: Math.max(1, Math.min(100, limit ?? 25)),
    });
  }

  @Get('incidents')
  @ApiOperation({ summary: 'List active operational incidents' })
  async incidents(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.adminService.listIncidents(Math.max(1, Math.min(200, limit ?? 50)));
  }

  @Get('flags')
  @ApiOperation({ summary: 'Get top-level platform risk flags' })
  async flags() {
    return this.adminService.listPlatformFlags();
  }
}
