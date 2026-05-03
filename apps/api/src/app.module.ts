// Root NestJS module — wires all feature modules together
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module.js';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.js';
import { InstancesModule } from './modules/instances/instances.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { ApiKeysModule } from './modules/api-keys/api-keys.module.js';
import { WebhooksModule } from './modules/webhooks/webhooks.module.js';
import { BackupsModule } from './modules/backups/backups.module.js';
import { ReplicationModule } from './modules/replication/replication.module.js';
import { TelemetryModule } from './modules/telemetry/telemetry.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { EnterpriseModule } from './modules/enterprise/enterprise.module.js';
import { GatewayModule } from './modules/gateway/gateway.module.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware.js';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    WorkspacesModule,
    InstancesModule,
    BillingModule,
    ApiKeysModule,
    WebhooksModule,
    BackupsModule,
    ReplicationModule,
    TelemetryModule,
    AdminModule,
    EnterpriseModule,
    GatewayModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware, RateLimitMiddleware).forRoutes('*');
  }
}
