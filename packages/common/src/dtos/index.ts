// Shared Zod schemas and validation DTOs used across the API
import { z } from 'zod';

export const RegisterDto = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
});

export const LoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const ForgotPasswordDto = z.object({
  email: z.string().email(),
});

export const ResetPasswordDto = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export const MagicLinkDto = z.object({
  email: z.string().email(),
});

export const CreateWorkspaceDto = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
});

export const CreateInstanceDto = z.object({
  name: z.string().min(1).max(100),
  region: z.enum(['US_EAST', 'US_WEST', 'EU_WEST', 'EU_CENTRAL', 'APAC_EAST']),
  tier: z.enum(['NANO', 'MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'XL']),
  version: z.string().min(1),
});

export const CreateSamlConfigDto = z.object({
  entryPoint: z.string().url(),
  issuer: z.string().min(1),
  cert: z.string().startsWith('-----BEGIN CERTIFICATE-----'),
  attributeMapping: z.object({
    email: z.string(),
    name: z.string().optional(),
  }),
});

export type RegisterDtoType = z.infer<typeof RegisterDto>;
export type LoginDtoType = z.infer<typeof LoginDto>;
export type ForgotPasswordDtoType = z.infer<typeof ForgotPasswordDto>;
export type ResetPasswordDtoType = z.infer<typeof ResetPasswordDto>;
export type MagicLinkDtoType = z.infer<typeof MagicLinkDto>;
export type CreateWorkspaceDtoType = z.infer<typeof CreateWorkspaceDto>;
export type CreateInstanceDtoType = z.infer<typeof CreateInstanceDto>;
export type CreateSamlConfigDtoType = z.infer<typeof CreateSamlConfigDto>;
