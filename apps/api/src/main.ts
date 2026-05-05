// NestJS application bootstrap — configures global pipes, Swagger, and starts HTTP server
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor.js';
import { env } from './common/config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const messages = errors
          .map(
            (error) =>
              `${error.property}: ${Object.values(error.constraints || {}).join(', ')}`,
          )
          .join('; ');
        return new BadRequestException(messages);
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor(), new MetricsInterceptor());

  // CORS
  app.enableCors({
    origin: env.ALLOWED_ORIGINS.split(','),
    credentials: true,
  });

  // Global API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger API docs (non-production only)
  if (env.SWAGGER_ENABLED) {
    const config = new DocumentBuilder()
      .setTitle('Claw Cloud API')
      .setDescription('Managed ClawDB Platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    await app.close();
    process.exit(0);
  });

  await app.listen(env.PORT);
  console.log(`🚀 API server running on http://localhost:${env.PORT}`);
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap application:', err);
  process.exit(1);
});
