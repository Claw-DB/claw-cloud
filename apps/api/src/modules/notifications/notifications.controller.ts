import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { NotificationsService } from './notifications.service.js';

interface AuthRequest extends Request {
  user: { id: string };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /api/v1/notifications/stream
   * Server-Sent Events stream for real-time notifications.
   */
  @Get('stream')
  stream(@Req() req: AuthRequest, @Res() res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const cleanup = this.notificationsService.addClient(req.user.id, res);

    // Keep-alive ping every 30s
    const ping = setInterval(() => {
      try {
        res.write(`event: ping\ndata: {}\n\n`);
      } catch {
        clearInterval(ping);
      }
    }, 30_000);

    req.on('close', () => {
      clearInterval(ping);
      cleanup();
    });
  }

  /**
   * GET /api/v1/notifications
   * List recent notifications for the current user.
   */
  @Get()
  list(@Req() req: AuthRequest, @Query('workspaceId') workspaceId?: string) {
    return this.notificationsService.list(req.user.id, workspaceId);
  }

  /**
   * GET /api/v1/notifications/unread-count
   * Returns the number of unread notifications.
   */
  @Get('unread-count')
  async unreadCount(
    @Req() req: AuthRequest,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const count = await this.notificationsService.unreadCount(req.user.id, workspaceId);
    return { count };
  }

  /**
   * PATCH /api/v1/notifications/:id/read
   * Mark a single notification as read.
   */
  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.notificationsService.markRead(id, req.user.id);
  }

  /**
   * PATCH /api/v1/notifications/read-all
   * Mark all notifications as read.
   */
  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(
    @Req() req: AuthRequest,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.notificationsService.markAllRead(req.user.id, workspaceId);
  }
}
