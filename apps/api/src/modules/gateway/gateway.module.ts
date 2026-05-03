import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ApiKeysModule } from '../api-keys/api-keys.module.js';
import { GatewayController } from './gateway.controller.js';
import { GatewayService } from './gateway.service.js';

@Module({
  imports: [PrismaModule, ApiKeysModule],
  controllers: [GatewayController],
  providers: [GatewayService],
  exports: [GatewayService],
})
export class GatewayModule {}
