import Stripe from 'stripe';
import { CloudBillingError } from '@claw/common';

export const PLAN_PRICES = {
  FREE: null,
  STARTER: process.env.STRIPE_STARTER_PRICE_ID ?? null,
  PRO: process.env.STRIPE_PRO_PRICE_ID ?? null,
  ENTERPRISE: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? null,
} as const;

let stripeClient: Stripe | null = null;

export function createStripeClient(): Stripe {
  if (stripeClient) {
    return stripeClient;
  }

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new CloudBillingError('STRIPE_CONFIG_ERROR', 'STRIPE_SECRET_KEY is not configured');
  }

  stripeClient = new Stripe(apiKey, { apiVersion: '2024-04-10' as never });
  return stripeClient;
}

export function mapStripeError(error: unknown, fallbackMessage: string): CloudBillingError {
  if (error instanceof Stripe.errors.StripeError) {
    return new CloudBillingError(error.code ?? 'STRIPE_ERROR', error.message, error.statusCode ?? 502);
  }

  if (error instanceof CloudBillingError) {
    return error;
  }

  return new CloudBillingError('STRIPE_ERROR', fallbackMessage);
}

async function withStripe<T>(operation: () => Promise<T>, fallbackMessage: string): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw mapStripeError(error, fallbackMessage);
  }
}

export function getPriceIdForPlan(plan: keyof typeof PLAN_PRICES): string | null {
  return PLAN_PRICES[plan];
}

export async function upsertCustomer(params: {
  customerId?: string | null;
  email?: string | null;
  name: string;
  metadata: Record<string, string>;
}): Promise<Stripe.Customer> {
  const stripe = createStripeClient();

  if (params.customerId) {
    return withStripe(
      () => stripe.customers.update(params.customerId as string, {
        email: params.email ?? undefined,
        name: params.name,
        metadata: params.metadata,
      }),
      'Failed to update Stripe customer',
    );
  }

  return withStripe(
    () =>
      stripe.customers.create({
        email: params.email ?? undefined,
        name: params.name,
        metadata: params.metadata,
      }),
    'Failed to create Stripe customer',
  );
}

export async function createCheckoutSession(params: Stripe.Checkout.SessionCreateParams) {
  const stripe = createStripeClient();
  return withStripe(
    () => stripe.checkout.sessions.create(params),
    'Failed to create checkout session',
  );
}

export async function createBillingPortalSession(params: Stripe.BillingPortal.SessionCreateParams) {
  const stripe = createStripeClient();
  return withStripe(
    () => stripe.billingPortal.sessions.create(params),
    'Failed to create billing portal session',
  );
}

export async function constructWebhookEvent(payload: Buffer, signature: string, secret: string) {
  const stripe = createStripeClient();
  return withStripe(
    async () => stripe.webhooks.constructEvent(payload, signature, secret),
    'Failed to verify Stripe webhook signature',
  );
}

export async function retrieveSubscription(subscriptionId: string) {
  const stripe = createStripeClient();
  return withStripe(
    () => stripe.subscriptions.retrieve(subscriptionId, { expand: ['items.data.price'] }),
    'Failed to retrieve Stripe subscription',
  );
}

export async function cancelSubscription(subscriptionId: string, immediately: boolean) {
  const stripe = createStripeClient();
  return withStripe(
    () =>
      immediately
        ? stripe.subscriptions.cancel(subscriptionId)
        : stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true }),
    'Failed to cancel Stripe subscription',
  );
}

export async function listInvoices(customerId: string) {
  const stripe = createStripeClient();
  return withStripe(() => stripe.invoices.list({ customer: customerId, limit: 100 }), 'Failed to list invoices');
}

export async function createUsageRecord(
  subscriptionItemId: string,
  quantity: number,
  timestamp: number,
) {
  const stripe = createStripeClient();
  return withStripe(
    () =>
      stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
        action: 'set',
        quantity,
        timestamp,
      }),
    'Failed to create Stripe usage record',
  );
}

export { Stripe };