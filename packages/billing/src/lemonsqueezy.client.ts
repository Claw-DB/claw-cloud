import crypto from 'node:crypto';

export const LEMON_VARIANTS = {
  FREE: null,
  STARTER: process.env.LEMONSQUEEZY_VARIANT_STARTER ?? null,
  BASIC: process.env.LEMONSQUEEZY_VARIANT_BASIC ?? null,
  PRO: process.env.LEMONSQUEEZY_VARIANT_PRO ?? null,
  ENTERPRISE: process.env.LEMONSQUEEZY_VARIANT_ENTERPRISE ?? null,
} as const;

export function getVariantForPlan(plan: keyof typeof LEMON_VARIANTS): string | null {
  return LEMON_VARIANTS[plan];
}

export function buildCheckoutUrl(params: {
  baseUrl: string;
  workspaceId: string;
  plan: Exclude<keyof typeof LEMON_VARIANTS, 'FREE'>;
  successUrl: string;
  cancelUrl: string;
}): string {
  const url = new URL(params.baseUrl);
  url.searchParams.set('checkout[success_url]', params.successUrl);
  url.searchParams.set('checkout[cancel_url]', params.cancelUrl);
  url.searchParams.set('checkout[custom][workspace_id]', params.workspaceId);
  url.searchParams.set('checkout[custom][plan]', params.plan);
  return url.toString();
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signature.trim();
  if (digest.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(provided));
}
