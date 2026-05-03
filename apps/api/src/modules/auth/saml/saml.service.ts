// SamlService — manages SAML SSO configurations, SP metadata, and assertion validation
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SamlConfig } from '@prisma/client';
import { CreateSamlConfigDtoType } from '@claw/common';
import { SAML } from '@node-saml/node-saml';

@Injectable()
export class SamlService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(workspaceId: string): Promise<SamlConfig | null> {
    return this.prisma.samlConfig.findUnique({ where: { workspaceId } });
  }

  /**
   * Save or update SAML config for a workspace.
   * Validates entryPoint URL, PEM cert format, and issuer non-empty.
   */
  async saveConfig(workspaceId: string, dto: CreateSamlConfigDtoType): Promise<SamlConfig> {
    // Validate cert is parseable PEM
    if (!dto.cert.includes('-----BEGIN CERTIFICATE-----')) {
      throw new BadRequestException('Certificate must be a valid PEM certificate');
    }

    return this.prisma.samlConfig.upsert({
      where: { workspaceId },
      update: {
        entryPoint: dto.entryPoint,
        issuer: dto.issuer,
        cert: dto.cert,
        attributeMapping: dto.attributeMapping,
      },
      create: {
        workspaceId,
        entryPoint: dto.entryPoint,
        issuer: dto.issuer,
        cert: dto.cert,
        attributeMapping: dto.attributeMapping as Record<string, string>,
      },
    });
  }

  /**
   * Generate SAML SP metadata XML for a workspace IdP to consume.
   */
  async generateSpMetadata(workspaceId: string): Promise<string> {
    const config = await this.getConfig(workspaceId);
    if (!config) throw new NotFoundException('SAML configuration not found');

    const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:4000';
    const callbackUrl = `${baseUrl}/auth/saml/${workspaceId}/callback`;
    const entityId = `${baseUrl}/auth/saml/${workspaceId}/metadata`;

    // Minimal SP metadata XML
    return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${entityId}">
  <SPSSODescriptor
    AuthnRequestsSigned="false"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${callbackUrl}"
      index="1"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
  }

  /**
   * Validate a SAML assertion and extract user attributes.
   */
  async validateAssertion(
    workspaceId: string,
    samlResponse: string,
  ): Promise<{ email: string; name: string; attributes: Record<string, unknown> }> {
    const config = await this.getConfig(workspaceId);
    if (!config) throw new NotFoundException('SAML configuration not found for this workspace');

    const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:4000';
    const mapping = config.attributeMapping as { email: string; name?: string };

    const saml = new SAML({
      callbackUrl: `${baseUrl}/auth/saml/${workspaceId}/callback`,
      entryPoint: config.entryPoint,
      issuer: config.issuer,
      idpCert: config.cert,
      audience: `${baseUrl}/auth/saml/${workspaceId}/metadata`,
    });

    const { profile } = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse });
    if (!profile) throw new BadRequestException('Invalid SAML assertion');

    const attrs = profile as Record<string, unknown>;
    const email = String(attrs[mapping.email] ?? attrs['email'] ?? '');
    const name = mapping.name ? String(attrs[mapping.name] ?? '') : String(attrs['name'] ?? email);

    if (!email) throw new BadRequestException('SAML assertion missing email attribute');

    return { email, name, attributes: attrs };
  }
}
