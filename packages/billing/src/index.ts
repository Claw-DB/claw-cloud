// Stripe integration module — subscription management, invoice retrieval, usage metering
import Stripe from 'stripe';

export function createStripeClient(): Stripe {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(apiKey, { apiVersion: '2024-04-10' });
}

export { Stripe };
