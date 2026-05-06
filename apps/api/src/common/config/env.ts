import { z } from 'zod';

const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().url().optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Server
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_DATABASE_URL: z.string().url().optional(),
  
  // Redis
  REDIS_URL: z.string().url(),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('30d'),
  
  // Sessions
  SESSION_SECRET: z.string().min(32),
  
  // OAuth
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  
  // LemonSqueezy Billing
  LEMONSQUEEZY_WEBHOOK_SECRET: z.string().optional(),
  LEMONSQUEEZY_CHECKOUT_STARTER: optionalUrl,
  LEMONSQUEEZY_CHECKOUT_BASIC: optionalUrl,
  LEMONSQUEEZY_CHECKOUT_PRO: optionalUrl,
  LEMONSQUEEZY_CHECKOUT_ENTERPRISE: optionalUrl,
  LEMONSQUEEZY_BILLING_PORTAL_URL: optionalUrl,
  LEMONSQUEEZY_VARIANT_STARTER: z.string().optional(),
  LEMONSQUEEZY_VARIANT_BASIC: z.string().optional(),
  LEMONSQUEEZY_VARIANT_PRO: z.string().optional(),
  LEMONSQUEEZY_VARIANT_ENTERPRISE: z.string().optional(),
  
  // Email
  RESEND_API_KEY: z.string().optional(),
  
  // AI
  ANTHROPIC_API_KEY: z.string().optional(),
  
  // Application
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:4000'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  
  // Features
  SWAGGER_ENABLED: z.string().default('false').transform(v => v === 'true'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, any>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten());
    process.exit(1);
  }
  return parsed.data;
}

export const env = validateEnv(process.env);
