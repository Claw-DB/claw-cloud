// Shared Zod schemas and validation DTOs used across the API
import { z } from 'zod';

// Reusable primitives
const email = z.string().email().max(254).transform((s) => s.toLowerCase().trim());
const password = z.string().min(8).max(128);
// Allows letters (including unicode), numbers, spaces, and common name punctuation
const displayName = z.string().min(1).max(100).regex(/^[\p{L}\p{N}\s\-'.]+$/u, 'Name contains invalid characters');
const safeString = (max: number) => z.string().min(1).max(max);
const url2048 = z.string().url().max(2048);

export const RegisterDto = z.object({
  email,
  password,
  name: displayName,
});

export const LoginDto = z.object({
  email,
  password,
});

export const VerifyTotpDto = z.object({
  tempToken: z.string().min(1).max(512),
  code: z.string().regex(/^\d{6}$/),
});

export const RefreshTokenDto = z.object({
  refreshToken: z.string().min(1).max(512),
});

export const ForgotPasswordDto = z.object({
  email,
});

export const ResetPasswordDto = z.object({
  token: z.string().min(1).max(512),
  password,
});

export const MagicLinkDto = z.object({
  email,
});

export const ConfirmTotpDto = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export const DisableTotpDto = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export const CreateWorkspaceDto = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
});

export const UpdateWorkspaceDto = z
  .object({
    name: z.string().min(1).max(100).optional(),
    slug: z
      .string()
      .min(3)
      .max(50)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    metadata: z.record(z.union([z.string().max(1024), z.number(), z.boolean()])).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const CreateInstanceDto = z.object({
  name: z.string().min(1).max(64),
  region: z.enum(['US_EAST', 'US_WEST', 'EU_WEST', 'EU_CENTRAL', 'APAC_EAST']),
  tier: z.enum(['NANO', 'MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'XL']),
  version: z.string().default('latest'),
});

export const ScaleInstanceDto = z.object({
  tier: z.enum(['NANO', 'MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'XL']),
});

export const CreateApiKeyDto = z.object({
  name: z.string().min(1).max(64),
  scopes: z.array(
    z.enum(['read:memory', 'write:memory', 'manage:branches', 'manage:sync', 'admin']),
  ),
  expiresIn: z.enum(['never', '7d', '30d', '90d', '365d']).default('never'),
});

export const InviteMemberDto = z.object({
  email,
  role: z.enum(['OWNER', 'ADMIN', 'DEVELOPER', 'READONLY']),
});

export const UpdateMemberRoleDto = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'DEVELOPER', 'READONLY']),
});

export const CreateReplicationLinkDto = z.object({
  sourceInstanceId: z.string().uuid(),
  targetInstanceId: z.string().uuid(),
});

export const CreateWebhookDto = z.object({
  url: url2048,
  events: z.array(
    z.enum([
      'instance.created',
      'instance.status_changed',
      'instance.terminated',
      'backup.completed',
      'backup.failed',
      'replication.lagging',
      'replication.broken',
      'billing.subscription_updated',
      'billing.payment_failed',
      'billing.invoice_created',
      'security.access_denied',
      'member.joined',
      'member.removed',
    ]),
  ).min(1),
  enabled: z.boolean().default(true),
});

export const UpdateWebhookDto = CreateWebhookDto.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field is required',
);

export const BillingCheckoutDto = z.object({
  workspaceId: z.string().uuid(),
  plan: z.enum(['STARTER', 'BASIC', 'PRO', 'ENTERPRISE']),
  successUrl: url2048,
  cancelUrl: url2048,
});

export const BillingPortalDto = z.object({
  workspaceId: z.string().uuid(),
  returnUrl: url2048,
});

export const CancelSubscriptionDto = z.object({
  immediately: z.boolean().default(false),
});

export const CreateVectorCollectionDto = z.object({
  name: z.string().min(1).max(63).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  dimensions: z.number().int().min(1).max(4096),
  distanceMetric: z.enum(['cosine', 'l2', 'ip']).default('cosine'),
});

export const AuditQueryDto = z.object({
  actorId: z.string().uuid().optional(),
  actorType: z.enum(['USER', 'API_KEY', 'SYSTEM']).optional(),
  action: safeString(256).optional(),
  resourceType: safeString(256).optional(),
  resourceId: z.string().max(256).optional(),
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  cursor: z.string().max(512).optional(),
});

// SCIM patch value restricted to primitive types and flat record — z.any() is too broad
const scimPatchValue = z.union([
  z.string().max(1024),
  z.boolean(),
  z.number(),
  z.null(),
  z.record(z.union([z.string().max(1024), z.boolean(), z.number(), z.null()])),
]).optional();

export const ScimPatchOpDto = z.object({
  op: z.enum(['add', 'replace', 'remove']),
  path: z.string().max(256).optional(),
  value: scimPatchValue,
});

export const ScimUserDto = z.object({
  id: z.string().max(256).optional(),
  externalId: z.string().max(256).optional(),
  userName: email,
  active: z.boolean().default(true),
  name: z
    .object({
      givenName: z.string().max(256).optional(),
      familyName: z.string().max(256).optional(),
      formatted: z.string().max(512).optional(),
    })
    .optional(),
  emails: z.array(
    z.object({
      value: email,
      primary: z.boolean().optional(),
    }),
  ),
  groups: z.array(z.object({ value: z.string().max(256) })).optional(),
});

export const BackupRestoreDto = z.object({
  targetInstanceId: z.string().uuid(),
});

export const CreateSamlConfigDto = z.object({
  entryPoint: url2048,
  issuer: z.string().min(1).max(256),
  cert: z
    .string()
    .startsWith('-----BEGIN CERTIFICATE-----')
    .endsWith('-----END CERTIFICATE-----'),
  attributeMapping: z.object({
    email: z.string().max(256),
    name: z.string().max(256).optional(),
  }),
});

export type RegisterDtoType = z.infer<typeof RegisterDto>;
export type LoginDtoType = z.infer<typeof LoginDto>;
export type VerifyTotpDtoType = z.infer<typeof VerifyTotpDto>;
export type RefreshTokenDtoType = z.infer<typeof RefreshTokenDto>;
export type ForgotPasswordDtoType = z.infer<typeof ForgotPasswordDto>;
export type ResetPasswordDtoType = z.infer<typeof ResetPasswordDto>;
export type MagicLinkDtoType = z.infer<typeof MagicLinkDto>;
export type ConfirmTotpDtoType = z.infer<typeof ConfirmTotpDto>;
export type DisableTotpDtoType = z.infer<typeof DisableTotpDto>;
export type CreateWorkspaceDtoType = z.infer<typeof CreateWorkspaceDto>;
export type UpdateWorkspaceDtoType = z.infer<typeof UpdateWorkspaceDto>;
export type CreateInstanceDtoType = z.infer<typeof CreateInstanceDto>;
export type ScaleInstanceDtoType = z.infer<typeof ScaleInstanceDto>;
export type CreateApiKeyDtoType = z.infer<typeof CreateApiKeyDto>;
export type InviteMemberDtoType = z.infer<typeof InviteMemberDto>;
export type UpdateMemberRoleDtoType = z.infer<typeof UpdateMemberRoleDto>;
export type CreateReplicationLinkDtoType = z.infer<typeof CreateReplicationLinkDto>;
export type CreateWebhookDtoType = z.infer<typeof CreateWebhookDto>;
export type UpdateWebhookDtoType = z.infer<typeof UpdateWebhookDto>;
export type BillingCheckoutDtoType = z.infer<typeof BillingCheckoutDto>;
export type BillingPortalDtoType = z.infer<typeof BillingPortalDto>;
export type CancelSubscriptionDtoType = z.infer<typeof CancelSubscriptionDto>;
export type CreateVectorCollectionDtoType = z.infer<typeof CreateVectorCollectionDto>;
export type AuditQueryDtoType = z.infer<typeof AuditQueryDto>;
export type ScimPatchOpDtoType = z.infer<typeof ScimPatchOpDto>;
export type ScimUserDtoType = z.infer<typeof ScimUserDto>;
export type BackupRestoreDtoType = z.infer<typeof BackupRestoreDto>;
export type CreateSamlConfigDtoType = z.infer<typeof CreateSamlConfigDto>;
