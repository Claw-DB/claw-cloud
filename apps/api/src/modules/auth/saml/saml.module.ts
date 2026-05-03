// SamlModule — enterprise SAML SSO authentication module
import { Module } from '@nestjs/common';
import { SamlService } from './saml.service.js';
import { SamlController } from './saml.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  providers: [SamlService],
  controllers: [SamlController],
  exports: [SamlService],
})
export class SamlModule {}
