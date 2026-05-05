import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../api/src/modules/prisma/prisma.module.js';
import { InstancesModule } from '../../api/src/modules/instances/instances.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    PrismaModule,
    InstancesModule,
  ],
})
export class WorkerModule {}
