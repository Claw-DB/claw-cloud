// BillingModule — stub module for billing feature
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
})
export class BillingModule {}
