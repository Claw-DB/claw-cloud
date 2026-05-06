import { Injectable, NotFoundException } from '@nestjs/common';
import crypto from 'node:crypto';
import { WorkspacePlan } from '@prisma/client';
import { JOB_NAMES, QUEUE_NAMES } from '@claw/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getQueue } from '../../common/infra/queue.js';

@Injectable()
export class BillingService {
  private readonly emailQueue = getQueue(QUEUE_NAMES.EMAIL);

  constructor(private readonly prisma: PrismaService) {}

  async createCheckoutSession(
    workspaceId: string,
    plan: Exclude<WorkspacePlan, 'FREE'>,
    successUrl: string,
    cancelUrl: string,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { billingSubscription: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const checkoutBaseUrl = this.resolveCheckoutUrl(plan);
    if (!checkoutBaseUrl) {
      throw new NotFoundException(`Lemon checkout URL is not configured for ${plan}`);
    }

    await this.prisma.billingSubscription.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        stripeCustomerId: workspace.billingSubscription?.stripeCustomerId ?? `lemon:${workspaceId}`,
        status: 'TRIALING',
      },
      update: {},
    });

    const url = new URL(checkoutBaseUrl);
    url.searchParams.set('checkout[success_url]', successUrl);
    url.searchParams.set('checkout[cancel_url]', cancelUrl);
    url.searchParams.set('checkout[custom][workspace_id]', workspaceId);
    url.searchParams.set('checkout[custom][plan]', plan);

    return { url: url.toString() };
  }

  async createPortalSession(workspaceId: string, returnUrl: string) {
    const portalUrl = process.env.LEMONSQUEEZY_BILLING_PORTAL_URL;
    if (!portalUrl) {
      throw new NotFoundException('LEMONSQUEEZY_BILLING_PORTAL_URL is not configured');
    }

    const url = new URL(portalUrl);
    url.searchParams.set('workspace_id', workspaceId);
    url.searchParams.set('return_url', returnUrl);

    return { url: url.toString() };
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret) {
      throw new NotFoundException('LEMONSQUEEZY_WEBHOOK_SECRET is not configured');
    }

    const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const headerValue = (signature ?? '').trim();
    const valid =
      digest.length === headerValue.length
      && crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(headerValue));

    if (!valid) {
      throw new NotFoundException('Invalid Lemon webhook signature');
    }

    const event = JSON.parse(rawBody.toString('utf-8')) as Record<string, any>;
    const eventName = event?.meta?.event_name as string | undefined;

    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated': {
        await this.syncLemonSubscription(event);
        break;
      }
      case 'subscription_cancelled':
      case 'subscription_expired': {
        await this.downgradeLemonSubscription(event);
        break;
      }
      case 'order_created': {
        await this.recordLemonInvoice(event);
        break;
      }
      default:
        break;
    }
  }

  async getCurrentSubscription(workspaceId: string) {
    const subscription = await this.prisma.billingSubscription.findUnique({ where: { workspaceId } });
    if (!subscription) {
      throw new NotFoundException('Billing subscription not found');
    }

    return subscription;
  }

  async cancelSubscription(workspaceId: string, immediately: boolean): Promise<void> {
    const subscription = await this.prisma.billingSubscription.findUnique({ where: { workspaceId } });
    if (!subscription) {
      throw new NotFoundException('Billing subscription not found');
    }

    await this.prisma.$transaction([
      this.prisma.billingSubscription.update({
        where: { workspaceId },
        data: {
          cancelAtPeriodEnd: !immediately,
          status: immediately ? 'CANCELED' : subscription.status,
        },
      }),
      ...(immediately
        ? [
            this.prisma.workspace.update({
              where: { id: workspaceId },
              data: { plan: 'FREE' },
            }),
          ]
        : []),
    ]);
  }

  async getInvoices(workspaceId: string) {
    return this.prisma.invoice.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async syncLemonSubscription(event: Record<string, any>) {
    const workspaceId = this.extractWorkspaceId(event);
    if (!workspaceId) {
      return;
    }

    const attributes = (event?.data?.attributes ?? {}) as Record<string, any>;
    const subscriptionId = String(event?.data?.id ?? attributes.subscription_id ?? '');
    const customerId = String(attributes.customer_id ?? `lemon:${workspaceId}`);
    const variantId = String(attributes.variant_id ?? attributes.first_subscription_item?.variant_id ?? '');
    const plan = this.resolvePlanFromVariantId(variantId, 'FREE');

    await this.prisma.$transaction([
      this.prisma.billingSubscription.upsert({
        where: { workspaceId },
        create: {
          workspaceId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId || null,
          stripePriceId: variantId || null,
          status: this.normalizeLemonSubscriptionStatus(String(attributes.status ?? '')),
          currentPeriodStart: this.parseDate(attributes.created_at),
          currentPeriodEnd: this.parseDate(attributes.renews_at ?? attributes.ends_at),
          cancelAtPeriodEnd: Boolean(attributes.cancelled),
        },
        update: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId || null,
          stripePriceId: variantId || null,
          status: this.normalizeLemonSubscriptionStatus(String(attributes.status ?? '')),
          currentPeriodStart: this.parseDate(attributes.created_at),
          currentPeriodEnd: this.parseDate(attributes.renews_at ?? attributes.ends_at),
          cancelAtPeriodEnd: Boolean(attributes.cancelled),
        },
      }),
      this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { plan, status: 'ACTIVE' },
      }),
    ]);
  }

  private async downgradeLemonSubscription(event: Record<string, any>) {
    const workspaceId = this.extractWorkspaceId(event);
    if (!workspaceId) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.billingSubscription.update({
        where: { workspaceId },
        data: {
          status: 'CANCELED',
          cancelAtPeriodEnd: false,
          currentPeriodEnd: this.parseDate(event?.data?.attributes?.ends_at) ?? new Date(),
        },
      }),
      this.prisma.workspace.update({ where: { id: workspaceId }, data: { plan: 'FREE' } }),
    ]);
  }

  private async recordLemonInvoice(event: Record<string, any>) {
    const workspaceId = this.extractWorkspaceId(event);
    if (!workspaceId) {
      return;
    }

    const data = event?.data ?? {};
    const attributes = (data?.attributes ?? {}) as Record<string, any>;
    const invoiceId = String(data?.id ?? attributes.identifier ?? attributes.order_number ?? '');
    if (!invoiceId) {
      return;
    }

    const amountCents = Number(attributes.total ?? attributes.subtotal ?? 0);
    const createdAt = this.parseDate(attributes.created_at) ?? new Date();
    const rawPdfUrl = attributes.urls?.invoice_url ?? attributes.urls?.receipt ?? null;
    const pdfUrl = typeof rawPdfUrl === 'string' && rawPdfUrl.length > 0 ? rawPdfUrl : null;

    await this.prisma.invoice.upsert({
      where: { stripeInvoiceId: invoiceId },
      create: {
        workspaceId,
        stripeInvoiceId: invoiceId,
        status: String(attributes.status ?? 'paid'),
        amountCents,
        currency: String(attributes.currency ?? 'usd').toLowerCase(),
        periodStart: createdAt,
        periodEnd: this.parseDate(attributes.renews_at ?? attributes.ends_at) ?? createdAt,
        pdfUrl,
      },
      update: {
        status: String(attributes.status ?? 'paid'),
        amountCents,
        pdfUrl,
      },
    });

    await this.emailQueue.add(JOB_NAMES.RECEIPT_EMAIL, {
      workspaceId,
      invoiceId,
    });
  }

  private resolvePlanFromVariantId(variantId: string | null, fallback: WorkspacePlan): WorkspacePlan {
    const map: Record<string, WorkspacePlan> = {
      [process.env.LEMONSQUEEZY_VARIANT_STARTER ?? '']: 'STARTER',
      [process.env.LEMONSQUEEZY_VARIANT_BASIC ?? '']: 'BASIC',
      [process.env.LEMONSQUEEZY_VARIANT_PRO ?? '']: 'PRO',
      [process.env.LEMONSQUEEZY_VARIANT_ENTERPRISE ?? '']: 'ENTERPRISE',
    };

    return (variantId && map[variantId]) || fallback;
  }

  private normalizeLemonSubscriptionStatus(status: string) {
    if (status === 'active') return 'ACTIVE';
    if (status === 'on_trial' || status === 'trialing') return 'TRIALING';
    if (status === 'past_due' || status === 'unpaid') return 'PAST_DUE';
    if (status === 'cancelled' || status === 'canceled' || status === 'expired') return 'CANCELED';
    return 'TRIALING';
  }

  private resolveCheckoutUrl(plan: Exclude<WorkspacePlan, 'FREE'>): string | null {
    const map: Record<Exclude<WorkspacePlan, 'FREE'>, string | undefined> = {
      STARTER: process.env.LEMONSQUEEZY_CHECKOUT_STARTER,
      BASIC: process.env.LEMONSQUEEZY_CHECKOUT_BASIC,
      PRO: process.env.LEMONSQUEEZY_CHECKOUT_PRO,
      ENTERPRISE: process.env.LEMONSQUEEZY_CHECKOUT_ENTERPRISE,
    };

    return map[plan] ?? null;
  }

  private extractWorkspaceId(event: Record<string, any>): string | null {
    const custom = event?.meta?.custom_data ?? event?.data?.attributes?.custom_data ?? {};
    return String(custom.workspace_id ?? custom.workspaceId ?? '').trim() || null;
  }

  private parseDate(value: unknown): Date | null {
    if (!value || typeof value !== 'string') return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}