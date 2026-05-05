import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller.js';
import { ChatbotService } from './chatbot.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ChatbotController],
  providers: [ChatbotService],
})
export class ChatbotModule {}
