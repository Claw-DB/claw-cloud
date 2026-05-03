import { Injectable, NotFoundException } from '@nestjs/common';
import {
  cancelSubscription as cancelStripeSubscription,
  constructWebhookEvent,
  createBillingPortalSession,
  createCheckoutSession,
  getPriceIdForPlan,
  listInvoices,
  retrieveSubscription,
  Stripe,
  upsertCustomer,
} from '@claw/billing';
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
      include: { owner: true, billingSubscription: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const customer = await upsertCustomer({
      customerId: workspace.billingSubscription?.stripeCustomerId,
      email: workspace.owner.email,
      name: workspace.name,
      metadata: { workspaceId: workspace.id },
    });

    await this.prisma.billingSubscription.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        stripeCustomerId: customer.id,
        status: 'TRIALING',
      },
      update: {
        stripeCustomerId: customer.id,
      },
    });

    const priceId = getPriceIdForPlan(plan);
    if (!priceId) {
      throw new NotFoundException('Stripe price is not configured for plan');
    }

    const session = await createCheckoutSession({
      mode: 'subscription',
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { workspaceId, priceId },
      subscription_data: { metadata: { workspaceId, priceId } },
    });

    return { url: session.url };
  }

  async createPortalSession(workspaceId: string, returnUrl: string) {
    const subscription = await this.prisma.billingSubscription.findUnique({ where: { workspaceId } });
    if (!subscription) {
      throw new NotFoundException('Billing subscription not found');
    }

    const session = await createBillingPortalSession({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new NotFoundException('STRIPE_WEBHOOK_SECRET is not configured');
    }

    const event = await constructWebhookEvent(rawBody, signature, secret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.activateCheckoutSession(session);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.syncSubscription(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.downgradeSubscription(subscription);
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.recordInvoice(invoice);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.markPastDue(invoice);
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

    const stripeData = subscription.stripeSubscriptionId
      ? await retrieveSubscription(subscription.stripeSubscriptionId)
      : null;

    return { ...subscription, stripeData };
  }

  async cancelSubscription(workspaceId: string, immediately: boolean): Promise<void> {
    const subscription = await this.prisma.billingSubscription.findUnique({ where: { workspaceId } });
    if (!subscription?.stripeSubscriptionId) {
      throw new NotFoundException('Stripe subscription not found');
    }

    await cancelStripeSubscription(subscription.stripeSubscriptionId, immediately);
    await this.prisma.billingSubscription.update({
      where: { workspaceId },
      data: { cancelAtPeriodEnd: !immediately },
    });
  }

  async getInvoices(workspaceId: string) {
    return this.prisma.invoice.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async activateCheckoutSession(session: Stripe.Checkout.Session) {
    const workspaceId = session.metadata?.workspaceId;
    if (!workspaceId) {
      return;
    }

    const subscriptionId = session.subscription?.toString();
    const plan = this.resolvePlanFromPriceId(session.metadata?.priceId ?? null, 'STARTER');
    await this.prisma.$transaction([
      this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { plan, status: 'ACTIVE' },
      }),
      this.prisma.billingSubscription.update({
        where: { workspaceId },
        data: {
          stripeSubscriptionId: subscriptionId,
          status: 'ACTIVE',
        },
      }),
    ]);
  }

  private async syncSubscription(subscription: Stripe.Subscription) {
    const workspaceId = subscription.metadata.workspaceId;
    if (!workspaceId) {
      return;
    }

    const priceId = subscription.items.data[0]?.price.id ?? null;
    const plan = this.resolvePlanFromPriceId(priceId, 'FREE');
    await this.prisma.$transaction([
      this.prisma.billingSubscription.update({
        where: { workspaceId },
        data: {
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          status: this.normalizeSubscriptionStatus(subscription.status),
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      }),
      this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { plan },
      }),
    ]);
  }

  private async downgradeSubscription(subscription: Stripe.Subscription) {
    const workspaceId = subscription.metadata.workspaceId;
    if (!workspaceId) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.billingSubscription.update({
        where: { workspaceId },
        data: { status: 'CANCELED', stripeSubscriptionId: subscription.id },
      }),
      this.prisma.workspace.update({ where: { id: workspaceId }, data: { plan: 'FREE' } }),
    ]);
  }

  private async recordInvoice(invoice: Stripe.Invoice) {
    const subscription = await this.prisma.billingSubscription.findFirst({
      where: { stripeCustomerId: invoice.customer?.toString() },
    });
    if (!subscription) {
      return;
    }

    await this.prisma.invoice.upsert({
      where: { stripeInvoiceId: invoice.id },
      create: {
        workspaceId: subscription.workspaceId,
        stripeInvoiceId: invoice.id,
        status: invoice.status ?? 'paid',
        amountCents: invoice.amount_paid,
        currency: invoice.currency,
        periodStart: new Date(invoice.period_start * 1000),
        periodEnd: new Date(invoice.period_end * 1000),
        pdfUrl: invoice.invoice_pdf ?? null,
      },
      update: {
        status: invoice.status ?? 'paid',
        amountCents: invoice.amount_paid,
        pdfUrl: invoice.invoice_pdf ?? null,
      },
    });

    await this.emailQueue.add(JOB_NAMES.RECEIPT_EMAIL, {
      workspaceId: subscription.workspaceId,
      invoiceId: invoice.id,
    });
  }

  private async markPastDue(invoice: Stripe.Invoice) {
    const subscription = await this.prisma.billingSubscription.findFirst({
      where: { stripeCustomerId: invoice.customer?.toString() },
    });
    if (!subscription) {
      return;
    }

    await this.prisma.billingSubscription.update({
      where: { workspaceId: subscription.workspaceId },
      data: { status: 'PAST_DUE' },
    });

    await this.emailQueue.add(JOB_NAMES.DUNNING_EMAIL, {
      workspaceId: subscription.workspaceId,
      invoiceId: invoice.id,
    });
  }

  private resolvePlanFromPriceId(priceId: string | null, fallback: WorkspacePlan): WorkspacePlan {
    const map: Record<string, WorkspacePlan> = {
      [process.env.STRIPE_STARTER_PRICE_ID ?? '']: 'STARTER',
      [process.env.STRIPE_PRO_PRICE_ID ?? '']: 'PRO',
      [process.env.STRIPE_ENTERPRISE_PRICE_ID ?? '']: 'ENTERPRISE',
    };

    return (priceId && map[priceId]) || fallback;
  }

  private normalizeSubscriptionStatus(status: string) {
    if (status === 'active') return 'ACTIVE';
    if (status === 'past_due') return 'PAST_DUE';
    if (status === 'canceled') return 'CANCELED';
    return 'TRIALING';
  }
}