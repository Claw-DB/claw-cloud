import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { ChatbotService } from './chatbot.service.js';
import { IsString, IsNotEmpty, IsUUID, IsOptional, MaxLength } from 'class-validator';

class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message!: string;

  @IsUUID()
  @IsNotEmpty()
  sessionId!: string;

  @IsUUID()
  @IsOptional()
  workspaceId?: string;
}

interface AuthRequest extends Request {
  user: { id: string; workspaceId?: string };
}

@Controller('chatbot')
@UseGuards(JwtAuthGuard)
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  /**
   * POST /api/v1/chatbot/stream
   * Streams an AI response as Server-Sent Events.
   */
  @Post('stream')
  async stream(
    @Body() dto: SendMessageDto,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.chatbotService.streamChat(
      req.user.id,
      dto.workspaceId,
      dto.sessionId,
      dto.message,
      res,
    );
  }

  /**
   * GET /api/v1/chatbot/history/:sessionId
   * Returns message history for a session.
   */
  @Get('history/:sessionId')
  async history(@Param('sessionId') sessionId: string, @Req() req: AuthRequest) {
    return this.chatbotService.getHistory(sessionId, req.user.id);
  }

  /**
   * DELETE /api/v1/chatbot/history/:sessionId
   * Clears message history for a session.
   */
  @Delete('history/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearHistory(@Param('sessionId') sessionId: string, @Req() req: AuthRequest) {
    await this.chatbotService.clearHistory(sessionId, req.user.id);
  }
}
